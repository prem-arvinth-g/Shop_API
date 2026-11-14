import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CatalogService } from '../../services/catalog.service';

// The non-stop strip that slides left. Items come from Admin > Banner (GET /api/banners).
// The list is drawn twice side by side; CSS slides the track by exactly half its width and loops,
// so the second copy takes the first copy's place and the motion looks endless.
@Component({
  selector: 'app-marquee',
  template: `
    @if (banners().length) {
      <div class="marquee" aria-label="Shop news and links">
        <div class="marquee-track" [style.--duration]="banners().length * 6 + 's'">
          @for (copy of [0, 1]; track copy) {
            @for (b of banners(); track b.id) {
              <a class="marquee-item" [attr.href]="b.link || null" [attr.aria-hidden]="copy === 1 ? 'true' : null"
                 [attr.tabindex]="copy === 1 ? -1 : null"
                 [attr.target]="b.link?.startsWith('http') ? '_blank' : null" rel="noopener">
                @if (b.imageUrl) { <img [src]="b.imageUrl" alt="" loading="lazy"> }
                <span>{{ b.text }}</span>
              </a>
              <span class="marquee-dot" aria-hidden="true">✦</span>
            }
          }
        </div>
      </div>
    }
  `,
})
export class Marquee {
  protected banners = toSignal(inject(CatalogService).banners(), { initialValue: [] });
}
