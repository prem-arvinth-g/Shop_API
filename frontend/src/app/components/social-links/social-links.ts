import { Component } from '@angular/core';
import { SOCIAL_LINKS } from '../../models/site';

// Round icon buttons for Instagram / Facebook / YouTube / WhatsApp. Links live in models/site.ts.
@Component({
  selector: 'app-social-links',
  template: `
    <div class="social">
      @for (s of links; track s.name) {
        <a [href]="s.url" target="_blank" rel="noopener" [attr.aria-label]="s.name" [title]="s.name">
          @switch (s.name) {
            @case ('Instagram') {
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" class="fill"/></svg>
            }
            @case ('Facebook') {
              <svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" class="fill"/></svg>
            }
            @case ('YouTube') {
              <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" class="fill"/></svg>
            }
            @case ('WhatsApp') {
              <svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2L9 9z" class="fill"/></svg>
            }
          }
        </a>
      }
    </div>
  `,
})
export class SocialLinks {
  protected links = SOCIAL_LINKS;
}
