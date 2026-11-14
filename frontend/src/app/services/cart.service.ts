import { Injectable, computed, effect, signal } from '@angular/core';
import { CartItem, Product } from '../models/models';

const KEY = 'acs_cart';

// The cart lives only in the browser (localStorage) until checkout.
// The total shown here is for display; the server recalculates it from real prices.
@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>(load());
  readonly count = computed(() => this.items().reduce((n, i) => n + i.quantity, 0));
  readonly total = computed(() => this.items().reduce((sum, i) => sum + i.product.price * i.quantity, 0));

  constructor() {
    effect(() => save(this.items()));   // any change to items -> saved automatically
  }

  add(product: Product, quantity = 1) {
    const existing = this.items().find(i => i.product.id === product.id);
    const qty = Math.min((existing?.quantity ?? 0) + quantity, product.stock);
    this.items.update(list => existing
      ? list.map(i => (i.product.id === product.id ? { ...i, quantity: qty } : i))
      : [...list, { product, quantity: qty }]);
  }

  setQuantity(productId: number, quantity: number) {
    if (quantity < 1) return this.remove(productId);
    this.items.update(list => list.map(i =>
      i.product.id === productId ? { ...i, quantity: Math.min(quantity, i.product.stock) } : i));
  }

  remove(productId: number) {
    this.items.update(list => list.filter(i => i.product.id !== productId));
  }

  clear() {
    this.items.set([]);
  }
}

function load(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function save(items: CartItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: cart just won't persist */ }
}
