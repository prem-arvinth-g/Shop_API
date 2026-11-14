import { Component, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Header } from './components/header/header';
import { SocialLinks } from './components/social-links/social-links';
import { ToastService } from './services/toast.service';

// The page frame: header, the current page (<router-outlet>), footer, and the toast pop-up.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Header, SocialLinks],
  templateUrl: './app.html',
})
export class App {
  protected toast = inject(ToastService);
  protected year = new Date().getFullYear();

  constructor() {
    // When a link scrolls to #shop, stop just below the sticky header instead of hiding the heading under it.
    // A function, because the header is taller on phones (search bar on its own row).
    inject(ViewportScroller).setOffset(() => [0, (document.querySelector('.site-header') as HTMLElement | null)?.offsetHeight ?? 0]);
  }
}
