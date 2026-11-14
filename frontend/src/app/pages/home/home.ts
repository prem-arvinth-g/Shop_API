import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Shop } from '../shop/shop';
import { Marquee } from '../../components/marquee/marquee';
import { SocialLinks } from '../../components/social-links/social-links';

// One long page: hero -> moving strip -> all sarees (with filters & search) -> trust strip.
// "Shop" links everywhere point to /#shop and scroll down to the sarees instead of opening another page.
@Component({
  selector: 'app-home',
  imports: [RouterLink, Shop, Marquee, SocialLinks],
  templateUrl: './home.html',
})
export class Home {}
