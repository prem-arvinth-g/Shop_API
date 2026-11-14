import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, firstValueFrom } from 'rxjs';
import { Banner, BannerInput, Category, ORDER_STATUSES, Order, Product, ProductInput } from '../../models/models';
import { AdminService } from '../../services/admin.service';
import { CatalogService } from '../../services/catalog.service';
import { ToastService } from '../../services/toast.service';
import { ProductImage } from '../../components/product-image/product-image';

const EMPTY: ProductInput = { name: '', description: '', price: 0, stock: 1, imageUrl: null, isActive: true, categoryId: 0 };

@Component({
  selector: 'app-admin',
  imports: [FormsModule, DecimalPipe, DatePipe, ProductImage],
  templateUrl: './admin.html',
})
export class Admin {
  private admin = inject(AdminService);
  private catalog = inject(CatalogService);
  private toast = inject(ToastService);

  protected tab = signal<'products' | 'categories' | 'orders' | 'banner'>('products');
  protected banners = signal<Banner[]>([]);
  protected products = signal<Product[]>([]);
  protected categories = signal<Category[]>([]);
  protected orders = signal<Order[]>([]);
  protected statuses = ORDER_STATUSES;
  protected loaded = signal(false);   // false until the first product list arrives

  // Product form: editingId null = closed, 0 = new product, >0 = editing that product
  protected editingId = signal<number | null>(null);
  protected form: ProductInput = { ...EMPTY };
  protected uploading = signal(false);
  protected newCategory = '';

  // Banner form: same idea as the product form (null = closed, 0 = new, >0 = editing)
  protected bannerEditingId = signal<number | null>(null);
  protected bannerForm: BannerInput = { text: '', imageUrl: null, link: null, sortOrder: 0, isActive: true };

  constructor() {
    this.load();
  }

  // Three separate requests: each tab fills in as soon as its own data arrives,
  // instead of the whole page waiting for the slowest one.
  load() {
    const fail = (e: unknown) => this.toast.error(e);
    this.admin.products().subscribe({ next: p => { this.products.set(p); this.loaded.set(true); }, error: fail });
    this.catalog.categories().subscribe({ next: c => this.categories.set(c), error: fail });
    this.admin.orders().subscribe({ next: o => this.orders.set(o), error: fail });
    this.admin.banners().subscribe({ next: b => this.banners.set(b), error: fail });
  }

  // ---------- Products ----------
  newProduct() {
    this.form = { ...EMPTY, categoryId: this.categories()[0]?.id ?? 0 };
    this.editingId.set(0);
  }

  edit(p: Product) {
    const { name, description, price, stock, imageUrl, isActive, categoryId } = p;
    this.form = { name, description, price, stock, imageUrl, isActive, categoryId };
    this.editingId.set(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async save() {
    const id = this.editingId();
    const ok = await this.run(id ? this.admin.updateProduct(id, this.form) : this.admin.createProduct(this.form), 'Product saved');
    if (ok) this.editingId.set(null);
  }

  async remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? Tip: untick "Visible" instead to just hide it.`)) return;
    await this.run(this.admin.deleteProduct(p.id), 'Product deleted');
  }

  async upload(event: Event, target: { imageUrl: string | null } = this.form) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      target.imageUrl = (await firstValueFrom(this.admin.upload(file))).url;
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.uploading.set(false);
    }
  }

  // ---------- Categories ----------
  async addCategory() {
    if (!this.newCategory.trim()) return;
    if (await this.run(this.admin.createCategory(this.newCategory.trim()), 'Category added')) this.newCategory = '';
  }

  async renameCategory(c: Category) {
    const name = prompt('New name', c.name)?.trim();
    if (name && name !== c.name) await this.run(this.admin.updateCategory(c.id, name), 'Category renamed');
  }

  async removeCategory(c: Category) {
    if (confirm(`Delete category "${c.name}"?`)) await this.run(this.admin.deleteCategory(c.id), 'Category deleted');
  }

  // ---------- Banner (moving strip) ----------
  newBanner() {
    const next = Math.max(0, ...this.banners().map(b => b.sortOrder)) + 1;
    this.bannerForm = { text: '', imageUrl: null, link: null, sortOrder: next, isActive: true };
    this.bannerEditingId.set(0);
  }

  editBanner(b: Banner) {
    const { text, imageUrl, link, sortOrder, isActive } = b;
    this.bannerForm = { text, imageUrl, link, sortOrder, isActive };
    this.bannerEditingId.set(b.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async saveBanner() {
    const id = this.bannerEditingId();
    const call = id ? this.admin.updateBanner(id, this.bannerForm) : this.admin.createBanner(this.bannerForm);
    if (await this.run(call, 'Banner saved')) this.bannerEditingId.set(null);
  }

  async removeBanner(b: Banner) {
    if (confirm(`Delete "${b.text}" from the moving strip? Tip: untick "Show" instead to just hide it.`))
      await this.run(this.admin.deleteBanner(b.id), 'Banner item deleted');
  }

  // ---------- Orders ----------
  async setStatus(o: Order, status: string) {
    await this.run(this.admin.setStatus(o.id, status), `Order #${o.id} marked ${status}`);
  }

  // Runs one API call, shows the pop-up, reloads the lists.
  private async run(call: Observable<unknown>, success: string): Promise<boolean> {
    try {
      await firstValueFrom(call);
      this.toast.show(success);
      this.load();
      return true;
    } catch (e) {
      this.toast.error(e);
      return false;
    }
  }
}
