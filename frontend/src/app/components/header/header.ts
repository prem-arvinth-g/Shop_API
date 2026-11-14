import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './header.html',
})
export class Header {
  protected auth = inject(AuthService);
  protected cart = inject(CartService);
  private router = inject(Router);
  private toast = inject(ToastService);
  protected q = '';
  protected menuOpen = signal(false);

  search() {
    this.router.navigate(['/shop'], { queryParams: { q: this.q.trim() || null } });
  }

  toggleMenu(event: Event) {
    event.stopPropagation();          // don't let the document click below close it straight away
    this.menuOpen.update(open => !open);
  }

  // Any click outside the profile menu closes it.
  @HostListener('document:click')
  closeMenu() {
    this.menuOpen.set(false);
  }

  logout() {
    this.auth.logout().subscribe(() => {
      this.toast.show('You have been logged out.');
      this.router.navigate(['/']);
    });
  }
}
