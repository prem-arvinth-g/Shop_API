import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Checkout, PaymentResult } from '../../models/models';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { ToastService } from '../../services/toast.service';

declare const Razorpay: any;   // global from checkout.js in src/index.html

@Component({
  selector: 'app-checkout',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './checkout.html',
})
export class CheckoutPage {
  protected cart = inject(CartService);
  private orders = inject(OrderService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected form = { customerName: '', phone: '', address: '' };
  protected busy = signal(false);

  // The whole buying flow: create order -> Razorpay popup -> server verifies -> success page.
  async placeOrder() {
    this.busy.set(true);
    try {
      const items = this.cart.items().map(i => ({ productId: i.product.id, quantity: i.quantity }));
      const checkout = await firstValueFrom(this.orders.create({ ...this.form, items }));   // POST /api/orders

      const payment = await this.pay(checkout);                                             // popup
      if (!payment) {
        this.toast.show('Payment cancelled. Nothing was charged.', 'error');
        return;
      }

      const order = await firstValueFrom(this.orders.verify(checkout.orderId, payment));    // POST /api/orders/{id}/verify
      this.cart.clear();
      this.toast.show(`Payment successful! Order #${order.id} is confirmed.`);
      this.router.navigate(['/orders', order.id]);
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
        handler: (r: any) => resolve({
          razorpayOrderId: r.razorpay_order_id,
          razorpayPaymentId: r.razorpay_payment_id,
          razorpaySignature: r.razorpay_signature,
        }),
        modal: { ondismiss: () => resolve(null) },
      }).open();
    });
  }
}
