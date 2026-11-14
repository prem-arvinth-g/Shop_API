import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Banner, BannerInput, Order, Product, ProductInput } from '../models/models';

// Admin-only API: backend/Controllers/AdminController.cs (403 for non-admins)
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = '/api/admin';

  products() { return this.http.get<Product[]>(`${this.base}/products`); }
  createProduct(p: ProductInput) { return this.http.post<number>(`${this.base}/products`, p); }
  updateProduct(id: number, p: ProductInput) { return this.http.put(`${this.base}/products/${id}`, p); }
  deleteProduct(id: number) { return this.http.delete(`${this.base}/products/${id}`); }

  createCategory(name: string) { return this.http.post<number>(`${this.base}/categories`, { name }); }
  updateCategory(id: number, name: string) { return this.http.put(`${this.base}/categories/${id}`, { name }); }
  deleteCategory(id: number) { return this.http.delete(`${this.base}/categories/${id}`); }

  orders() { return this.http.get<Order[]>(`${this.base}/orders`); }
  setStatus(id: number, status: string) { return this.http.put(`${this.base}/orders/${id}/status`, { status }); }

  banners() { return this.http.get<Banner[]>(`${this.base}/banners`); }
  createBanner(b: BannerInput) { return this.http.post<number>(`${this.base}/banners`, b); }
  updateBanner(id: number, b: BannerInput) { return this.http.put(`${this.base}/banners/${id}`, b); }
  deleteBanner(id: number) { return this.http.delete(`${this.base}/banners/${id}`); }

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.base}/upload`, form);
  }
}
