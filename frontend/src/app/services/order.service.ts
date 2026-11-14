import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Checkout, Order, PaymentResult } from '../models/models';

export interface CreateOrder {
  customerName: string;
  phone: string;
  address: string;
  items: { productId: number; quantity: number }[];   // only ids + quantities; prices come from the server
}

// Customer orders: backend/Controllers/OrdersController.cs
@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);

  create(order: CreateOrder) {
    return this.http.post<Checkout>('/api/orders', order);
  }

  verify(orderId: number, payment: PaymentResult) {
    return this.http.post<Order>(`/api/orders/${orderId}/verify`, payment);
  }

  mine() {
    return this.http.get<Order[]>('/api/orders');
  }
}
