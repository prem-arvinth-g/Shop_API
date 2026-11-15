import { Component, NgZone, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MapPin, Pin } from '../../components/map-pin/map-pin';
import { Checkout, PaymentResult } from '../../models/models';
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
