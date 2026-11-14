import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { Product } from '../../models/models';
import { CatalogService } from '../../services/catalog.service';
import { CartService } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';
import { ProductImage } from '../../components/product-image/product-image';

@Component({
  selector: 'app-product',
  imports: [RouterLink, DecimalPipe, ProductImage],
  templateUrl: './product.html',
})
export class ProductPage {
  private catalog = inject(CatalogService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // undefined = loading, null = not found
  protected product = toSignal(
    this.route.paramMap.pipe(switchMap(p => this.catalog.product(Number(p.get('id'))).pipe(catchError(() => of(null))))),
    { initialValue: undefined });
  protected qty = signal(1);

  addToCart(p: Product) {
    this.cart.add(p, this.qty());
    this.toast.show(`${p.name} added to your cart`);
  }

  // Checkout just this saree, leaving the cart as it is
  // (the login guard sends them to /login first if needed, then back to /checkout).
  buyNow(p: Product) {
    this.cart.startBuyNow(p, this.qty());
    this.router.navigate(['/checkout']);
  }
}
