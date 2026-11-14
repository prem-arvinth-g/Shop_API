import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

// Step 1: enter email -> server emails a 6-digit code. Step 2: enter code -> server sets the login cookie.
@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
})
export class Login {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly returnUrl = input<string>();     // from ?returnUrl=/checkout (withComponentInputBinding)
  protected email = '';
  protected code = '';
  protected step = signal<'email' | 'code'>('email');
  protected busy = signal(false);
  protected devCode = signal<string | null>(null);

  async sendCode() {
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.auth.sendOtp(this.email));
      this.devCode.set(res.devCode);
      this.step.set('code');
      this.toast.show(`We sent a code to ${this.email}`);
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  async verify() {
    this.busy.set(true);
    try {
      const me = await firstValueFrom(this.auth.verifyOtp(this.email, this.code));
      this.toast.show('You are logged in.');
      const back = this.returnUrl();
      this.router.navigateByUrl(back?.startsWith('/') ? back : me.isAdmin ? '/admin' : '/');
    } catch (err) {
      this.toast.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
