import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Header } from './components/header/header';
import { ToastService } from './services/toast.service';

// The page frame: header, the current page (<router-outlet>), footer, and the toast pop-up.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Header],
  templateUrl: './app.html',
})
export class App {
  protected toast = inject(ToastService);
  protected year = new Date().getFullYear();
}
