import { Component, computed, input } from '@angular/core';

// Razorpay requires these pages before it turns on live payments.
// OWNER: replace the [brackets] with the shop's real details before going live.
const PAGES: Record<string, { title: string; body: string[] }> = {
  contact: {
    title: 'Contact us',
    body: [
      'Anand Cotton Sarees, [full shop address], Andipatti, Theni District, Tamil Nadu [pincode].',
      'Phone / WhatsApp: [mobile number]',
      'Email: [shop email]',
      'Instagram: @anandcottonsarees',
      'We reply within 24 hours, Monday to Saturday.',
    ],
  },
  shipping: {
    title: 'Shipping policy',
    body: [
      'We ship across India. Shipping is free on all orders.',
      'Orders are packed and handed to the courier within [2] working days of payment.',
      'Delivery usually takes [3–7] working days depending on your location.',
      'You will get the tracking details on your mobile number once the order ships.',
    ],
  },
  refund: {
    title: 'Returns & refunds',
    body: [
      'If your saree arrives damaged or is not what you ordered, contact us within [3] days of delivery with photos.',
      'We will arrange a replacement or a full refund after we receive the saree back unused, with tags.',
      'Refunds go back to the original payment method within [5–7] working days.',
      'Orders can be cancelled before they ship for a full refund.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      'We collect your name, email, mobile number and address only to deliver your order and contact you about it.',
      'Payments are processed by Razorpay. We never see or store your card, UPI or bank details.',
      'If you pin your location on the map at checkout, we save that spot with your order for the courier. "Find my address" sends the address you typed to OpenStreetMap to search the map; maps are shown by OpenStreetMap.',
      'We do not sell or share your details with anyone except the courier that delivers your order.',
      'To delete your account and data, email us at [shop email].',
    ],
  },
  terms: {
    title: 'Terms & conditions',
    body: [
      'All prices are in Indian Rupees and include applicable taxes.',
      'Colours may look slightly different on screen because of lighting and handloom variation.',
      'An order is confirmed only after payment succeeds.',
      'These terms are governed by the laws of India. Disputes fall under the courts of [Theni], Tamil Nadu.',
    ],
  },
};

@Component({
  selector: 'app-policy',
  template: `
    <section class="container section">
      <h1 class="page-title">{{ content().title }}</h1>
      @for (line of content().body; track $index) { <p>{{ line }}</p> }
    </section>
  `,
})
export class Policy {
  readonly page = input<string>('contact');   // route param :page
  protected content = computed(() => PAGES[this.page()] ?? PAGES['contact']);
}
