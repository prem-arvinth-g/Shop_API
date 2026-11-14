import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Route guards only hide pages. The real protection is [Authorize] on the server.
// inject() must run before any await, so grab the services first.

export const loginGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.me() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.me()?.isAdmin ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: '/admin' } });
};
