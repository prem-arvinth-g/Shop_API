import { Routes } from '@angular/router';
import { adminGuard, loginGuard } from './services/guards';
import { Home } from './pages/home/home';
import { Shop } from './pages/shop/shop';
import { ProductPage } from './pages/product/product';
import { Cart } from './pages/cart/cart';
import { CheckoutPage } from './pages/checkout/checkout';
import { Login } from './pages/login/login';
import { Orders } from './pages/orders/orders';
import { Policy } from './pages/policy/policy';

// URL -> page component. Admin is lazy-loaded so customers never download its code.
export const routes: Routes = [
  { path: '', component: Home, title: 'Anand Cotton Sarees' },
  { path: 'shop', component: Shop, title: 'Shop | Anand Cotton Sarees' },
  { path: 'product/:id', component: ProductPage, title: 'Saree | Anand Cotton Sarees' },
  { path: 'cart', component: Cart, title: 'Cart | Anand Cotton Sarees' },
  { path: 'checkout', component: CheckoutPage, canActivate: [loginGuard], title: 'Checkout | Anand Cotton Sarees' },
  { path: 'login', component: Login, title: 'Login | Anand Cotton Sarees' },
  { path: 'orders', component: Orders, canActivate: [loginGuard], title: 'My orders | Anand Cotton Sarees' },
  { path: 'orders/:id', component: Orders, canActivate: [loginGuard], title: 'Order placed | Anand Cotton Sarees' },
  { path: 'policy/:page', component: Policy, title: 'Anand Cotton Sarees' },
  { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./pages/admin/admin').then(m => m.Admin), title: 'Admin | Anand Cotton Sarees' },
  { path: '**', redirectTo: '' },
];
