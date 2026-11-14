import { Component, inject, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { OrderService } from '../../services/order.service';

// /orders = my orders. /orders/5 = same list with a "thank you" banner for order 5.
@Component({
  selector: 'app-orders',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './orders.html',
})
export class Orders {
  readonly id = input<string>();   // route param :id
  protected orders = toSignal(inject(OrderService).mine(), { initialValue: null });
}
