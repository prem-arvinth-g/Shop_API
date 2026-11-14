import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CatalogService } from '../../services/catalog.service';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  templateUrl: './home.html',
})
export class Home {
  private catalog = inject(CatalogService);
  // toSignal: calls the API once and gives the template a value that updates when the response arrives.
  protected categories = toSignal(this.catalog.categories(), { initialValue: [] });
  protected featured = toSignal(this.catalog.products().pipe(map(list => list.slice(0, 8))), { initialValue: [] });
}
