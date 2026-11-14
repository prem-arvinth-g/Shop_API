import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { ProductCard } from '../../components/product-card/product-card';

// /shop?category=3&q=green  — the URL is the single source of truth for the filters.
@Component({
  selector: 'app-shop',
  imports: [RouterLink, ProductCard],
  templateUrl: './shop.html',
})
export class Shop {
  private catalog = inject(CatalogService);
  private route = inject(ActivatedRoute);

  protected categories = toSignal(this.catalog.categories(), { initialValue: [] });

  protected filter = toSignal(
    this.route.queryParamMap.pipe(map(p => ({ category: Number(p.get('category')) || null, q: p.get('q') }))),
    { requireSync: true });

  // Every time the URL filters change, call the API again (switchMap cancels the older request).
  protected products = toSignal(
    this.route.queryParamMap.pipe(switchMap(p => this.catalog.products(Number(p.get('category')) || null, p.get('q')))),
    { initialValue: null });

  protected title = computed(() => {
    const f = this.filter();
    if (f.q) return `Results for “${f.q}”`;
    return this.categories().find(c => c.id === f.category)?.name ?? 'All sarees';
  });
}
