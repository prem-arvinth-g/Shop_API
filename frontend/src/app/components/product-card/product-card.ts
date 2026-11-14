import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../../models/models';
import { ProductImage } from '../product-image/product-image';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, DecimalPipe, ProductImage],
  template: `
    <a class="card" [routerLink]="['/product', product().id]">
      <app-product-image [src]="product().imageUrl" [alt]="product().name" [seed]="product().id" />
      <div class="card-body">
        <p class="eyebrow">{{ product().categoryName }}</p>
        <h3>{{ product().name }}</h3>
        <p class="price">₹{{ product().price | number }}</p>
        @if (product().stock === 0) { <p class="sold-out">Sold out</p> }
      </div>
    </a>
  `,
})
export class ProductCard {
  readonly product = input.required<Product>();
}
