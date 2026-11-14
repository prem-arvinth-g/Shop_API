import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Banner, Category, Product } from '../models/models';

// Public catalog API: backend/Controllers/CatalogController.cs
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);

  categories() {
    return this.http.get<Category[]>('/api/categories');
  }

  products(categoryId?: number | null, q?: string | null) {
    let params = new HttpParams();
    if (categoryId) params = params.set('categoryId', categoryId);
    if (q) params = params.set('q', q);
    return this.http.get<Product[]>('/api/products', { params });
  }

  banners() {
    return this.http.get<Banner[]>('/api/banners');
  }

  product(id: number) {
    return this.http.get<Product>(`/api/products/${id}`);
  }
}
