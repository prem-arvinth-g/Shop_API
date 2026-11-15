import { Component, NgZone, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MapPin, Pin } from '../../components/map-pin/map-pin';
import { AddressInput, Checkout, PaymentResult, SavedAddress } from '../../models/models';
import { AddressService } from '../../services/address.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { ToastService } from '../../services/toast.service';

declare const Razorpay: any;   // global from checkout.js in src/index.html

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, DecimalPipe, MapPin],
  templateUrl: './checkout.html',
})
export class CheckoutPage {
  protected cart = inject(CartService);
  private orders = inject(OrderService);
  private addressApi = inject(AddressService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private zone = inject(NgZone);

  protected form = { customerName: '', phone: '', address: '' };
  protected busy = signal(false);
  protected offerSave = signal(false);   // shows the "save to cart?" pop-up in checkout.html
  protected showMap = signal(false);
  protected pin = signal<Pin | null>(null);   // set by <app-map-pin>; null = no pin, the typed address is enough
  protected pinAddress = signal('');          // what OpenStreetMap calls the pinned spot, for the courier

  // ---------- Saved addresses (Home, Work, ...) ----------
  protected addresses = signal<SavedAddress[]>([]);
  protected selectedId = signal<number | null>(null);   // null = typing a new address
  protected selected = computed(() => this.addresses().find(a => a.id === this.selectedId()));
  protected readonly labelChoices = ['Home', 'Work', 'Other'] as const;
  protected labelChoice = signal<'Home' | 'Work' | 'Other'>('Home');
  protected otherLabel = '';
  protected saveIt = true;   // tick box: save this new address, or save the changes to the picked one

  constructor() {
    // Most recently used address first, and picked straight away (like Amazon).
    this.addressApi.mine().subscribe(list => {
      this.addresses.set(list);
      if (list.length) this.select(list[0]);
    });
  }

  // Fills the form (and the map pin) from a saved address.
  select(a: SavedAddress) {
    this.selectedId.set(a.id);
    this.form = { customerName: a.customerName, phone: a.phone, address: a.address };
    this.pin.set(a.latitude != null && a.longitude != null ? { lat: a.latitude, lng: a.longitude } : null);
    this.pinAddress.set(a.pinAddress ?? '');
    this.showMap.set(false);
    this.saveIt = false;
  }

  // "+ Add a new address": keeps name and mobile (usually the same person), clears the rest.
  newAddress() {
    this.selectedId.set(null);
    this.form = { ...this.form, address: '' };
    this.clearPin();
    const used = this.addresses().map(a => a.label);
    this.labelChoice.set(!used.includes('Home') ? 'Home' : !used.includes('Work') ? 'Work' : 'Other');
    this.otherLabel = '';
    this.saveIt = true;
  }

  async remove(a: SavedAddress) {
    if (!confirm(`Delete the saved address "${a.label}"?`)) return;
    try {
      await firstValueFrom(this.addressApi.remove(a.id));
      this.addresses.update(list => list.filter(x => x.id !== a.id));
      if (this.selectedId() === a.id) {
        const next = this.addresses()[0];
        if (next) this.select(next); else this.newAddress();
      }
    } catch (err) { this.toast.error(err); }
  }

  clearPin() {
    this.showMap.set(false);
    this.pin.set(null);
    this.pinAddress.set('');
  }

  // Saves the new address, or the changes to the picked one, when the tick box is on.
  // A failure here never blocks the purchase: the order still carries the address.
  private async saveAddress() {
    if (!this.saveIt) return;
    const pin = this.pin();
    const label = this.selected()?.label
      ?? (this.labelChoice() === 'Other' ? this.otherLabel.trim() || 'Other' : this.labelChoice());
    const body: AddressInput = {
      label, ...this.form,
      latitude: pin?.lat ?? null, longitude: pin?.lng ?? null, pinAddress: pin ? this.pinAddress() || null : null,
    };
    try {
      const id = this.selectedId();
      const saved = await firstValueFrom(id ? this.addressApi.update(id, body) : this.addressApi.create(body));
      this.addresses.update(list => [saved, ...list.filter(a => a.id !== saved.id)]);
      this.selectedId.set(saved.id);
      this.saveIt = false;
    } catch (err) { this.toast.error(err); }
  }

  // "Yes, add to cart": the saree joins the cart and Buy now ends, so the cart page takes over.
  saveToCart() {
    const b = this.cart.buyNow();
    if (b) this.cart.add(b.product, b.quantity);
    this.cart.buyNow.set(null);
    this.toast.show('Saved to your cart. Nothing was charged.');
    this.router.navigate(['/cart'], { replaceUrl: true });
  }

  // The whole buying flow: create order -> Razorpay popup -> server verifies -> success page.
  async placeOrder() {
    this.busy.set(true);
    try {
      await this.saveAddress();
      const items = this.cart.checkoutItems().map(i => ({ productId: i.product.id, quantity: i.quantity }));
      const pin = this.pin();
      const checkout = await firstValueFrom(this.orders.create({ ...this.form, items, latitude: pin?.lat, longitude: pin?.lng, pinAddress: pin ? this.pinAddress() || undefined : undefined }));   // POST /api/orders

      const payment = await this.pay(checkout);                                             // popup
      if (!payment) {
        // Buy now cancelled: offer to keep the saree in the cart for later. Cart checkout: the cart is untouched anyway.
        if (this.cart.buyNow()) this.offerSave.set(true);
        else this.toast.show('Payment cancelled. Nothing was charged.', 'error');
        return;
      }

      const order = await firstValueFrom(this.orders.verify(checkout.orderId, payment));    // POST /api/orders/{id}/verify
      this.cart.finishCheckout();      // bought items leave the cart; they're in "My orders" now
      this.toast.show(`Payment successful! Order #${order.id} is confirmed.`);
      // replaceUrl: the browser's Back button skips this checkout page instead of returning to it.
      this.router.navigate(['/orders', order.id], { replaceUrl: true });
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  // Opens Razorpay's popup and waits. Resolves with the payment proof, or null if the customer closes it.
  private pay(c: Checkout): Promise<PaymentResult | null> {
    if (!c.razorpayKeyId) {
      // Test mode on your PC only (the server refuses this in production).
      const ok = confirm(`TEST MODE\nNo Razorpay keys are set.\nPretend to pay ₹${c.total}?`);
      return Promise.resolve(ok ? { razorpayOrderId: c.razorpayOrderId, razorpayPaymentId: 'dev_pay', razorpaySignature: 'dev' } : null);
    }
    return new Promise(resolve => {
      new Razorpay({
        key: c.razorpayKeyId,
        order_id: c.razorpayOrderId,
        amount: c.total * 100,
        currency: 'INR',
        name: 'Anand Cotton Sarees',
        description: `Order #${c.orderId}`,
        prefill: { name: this.form.customerName, contact: this.form.phone, email: this.auth.me()?.email },
        theme: { color: '#12391e' },
        // Razorpay calls these from outside Angular; zone.run() brings them back in so the page redraws and navigates.
        handler: (r: any) => this.zone.run(() => resolve({
          razorpayOrderId: r.razorpay_order_id,
          razorpayPaymentId: r.razorpay_payment_id,
          razorpaySignature: r.razorpay_signature,
        })),
        modal: { ondismiss: () => this.zone.run(() => resolve(null)) },
      }).open();
    });
  }
}
