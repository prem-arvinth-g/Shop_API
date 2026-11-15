import { Injectable, computed, effect, signal } from '@angular/core';
import { CartItem, Product } from '../models/models';

const KEY = 'acs_cart';
const BUY_NOW_KEY = 'acs_buy_now';

// The cart lives only in the browser (localStorage) until checkout.
// The total shown here is for display; the server recalculates it from real prices.
@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>(load(localStorageSafe(), KEY) ?? []);
  readonly count = computed(() => this.items().reduce((n, i) => n + i.quantity, 0));

  // Ticked rows only: these are what "Checkout" pays for. Unticked rows stay in the cart for later.
  readonly selectedItems = computed(() => this.items().filter(isSelected));
  readonly allSelected = computed(() => this.items().every(isSelected));
  readonly total = computed(() => sum(this.selectedItems()));

  // "Buy now" = one saree checked out on its own, without touching the cart.
  // Kept in sessionStorage so a page refresh on /checkout doesn't lose it.
  readonly buyNow = signal<CartItem | null>(load(sessionStorageSafe(), BUY_NOW_KEY));

  // What checkout is paying for: the Buy now item if there is one, otherwise the whole cart.
  readonly checkoutItems = computed(() => { const b = this.buyNow(); return b ? [b] : this.selectedItems(); });
  readonly checkoutTotal = computed(() => sum(this.checkoutItems()));

  constructor() {
    effect(() => save(localStorageSafe(), KEY, this.items()));        // any change -> saved automatically
    effect(() => save(sessionStorageSafe(), BUY_NOW_KEY, this.buyNow()));
  }

  add(product: Product, quantity = 1) {
    const existing = this.items().find(i => i.product.id === product.id);
    const qty = Math.min((existing?.quantity ?? 0) + quantity, product.stock);
    this.items.update(list => existing
      ? list.map(i => (i.product.id === product.id ? { ...i, quantity: qty, selected: true } : i))
      : [...list, { product, quantity: qty, selected: true }]);
  }

  toggle(productId: number) {
    this.items.update(list => list.map(i => (i.product.id === productId ? { ...i, selected: !isSelected(i) } : i)));
  }

  selectAll(selected: boolean) {
    this.items.update(list => list.map(i => ({ ...i, selected })));
  }

  setQuantity(productId: number, quantity: number) {
    if (quantity < 1) return this.remove(productId);
    this.items.update(list => list.map(i =>
      i.product.id === productId ? { ...i, quantity: Math.min(quantity, i.product.stock) } : i));
  }

  remove(productId: number) {
    this.items.update(list => list.filter(i => i.product.id !== productId));
  }

  startBuyNow(product: Product, quantity: number) {
    this.buyNow.set({ product, quantity: Math.min(quantity, product.stock) });
  }

  // After a successful payment: Buy now -> forget that one item; cart checkout -> remove only the ticked rows.
  // The products now live in "My orders" on the server; unticked rows stay in the cart.
  finishCheckout() {
    if (this.buyNow()) this.buyNow.set(null);
    else this.items.update(list => list.filter(i => !isSelected(i)));
  }
}

const isSelected = (i: CartItem) => i.selected !== false;
const sum = (list: CartItem[]) => list.reduce((total, i) => total + i.product.price * i.quantity, 0);

function localStorageSafe() { try { return localStorage; } catch { return null; } }
function sessionStorageSafe() { try { return sessionStorage; } catch { return null; } }

function load<T>(store: Storage | null, key: string): T | null {
  try { return JSON.parse(store?.getItem(key) ?? 'null'); } catch { return null; }
}
function save(store: Storage | null, key: string, value: unknown) {
  try {
    if (value == null) store?.removeItem(key);
    else store?.setItem(key, JSON.stringify(value));
  } catch { /* private mode: just won't persist */ }
}
