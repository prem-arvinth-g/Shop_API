import { Component, computed, input } from '@angular/core';

// Shows the product photo, or a saree-style colour placeholder until the admin uploads one.
const COLORS = ['#8e0e25', '#12391e', '#b8913f', '#5a1d3c', '#1f5c4a', '#a4471c'];

@Component({
  selector: 'app-product-image',
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="alt()" loading="lazy" class="product-img">
    } @else {
      <div class="product-img placeholder" [style.--base]="color()" role="img" [attr.aria-label]="alt()"></div>
    }
  `,
})
export class ProductImage {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly seed = input(0);
  // Use the colour in the product name if there is one ("Maroon ... Saree"), else pick one by id.
  protected color = computed(() => {
    const name = this.alt().toLowerCase();
    if (name.includes('green')) return '#12391e';
    if (name.includes('maroon')) return '#8e0e25';
    if (name.includes('mustard')) return '#b8913f';
    return COLORS[this.seed() % COLORS.length];
  });
}
