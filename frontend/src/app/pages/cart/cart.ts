import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { ProductImage } from '../../components/product-image/product-image';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, DecimalPipe, ProductImage],
  templateUrl: './cart.html',
})
export class Cart {
  protected cart = inject(CartService);
}
