import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, tap } from 'rxjs';
import { Me } from '../models/models';

// Email OTP login: backend/Controllers/AuthController.cs
// The login itself is an HttpOnly cookie the browser handles; Angular only keeps "who am I" for the UI.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  readonly me = signal<Me | null>(null);

  // On app start, ask the server if the cookie is still valid. Guards wait for this.
  readonly ready: Promise<void> = firstValueFrom(this.http.get<Me>('/api/auth/me'))
    .then(me => this.me.set(me), () => this.me.set(null));

  sendOtp(email: string) {
    return this.http.post<{ sent: boolean; devCode: string | null }>('/api/auth/send-otp', { email });
  }

  verifyOtp(email: string, code: string) {
    return this.http.post<Me>('/api/auth/verify-otp', { email, code }).pipe(tap(me => this.me.set(me)));
  }

  logout() {
    return this.http.post('/api/auth/logout', {}).pipe(tap(() => this.me.set(null)));
  }
}
