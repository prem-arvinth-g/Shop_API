import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, model, signal, viewChild } from '@angular/core';
import type { Map as LeafletMap } from 'leaflet';

export interface Pin { lat: number; lng: number; }

const INDIA = { lat: 22.5, lng: 79, zoom: 5 };
const INDIA_EDGES: [[number, number], [number, number]] = [[6, 68], [37.5, 97.5]];   // same limits the server checks
const STREET = 17;         // zoom that shows the street and the houses around it
const CLOSE_ENOUGH = 15;   // below this the pin is too rough to save
const TYPING_PAUSE = 1200; // ms after the customer stops typing before the map looks the address up
const PIN_PAUSE = 1500;    // ms after the map stops moving before we ask "what address is this?"
const MAPS = 'https://nominatim.openstreetmap.org';   // OpenStreetMap's free address search

// Amazon-style "adjust pin": the pin stays in the middle and the customer drags the MAP under it.
// Map: Leaflet + OpenStreetMap (free, no key). Loaded only when this component opens, so other pages stay light.
@Component({
  selector: 'app-map-pin',
  templateUrl: './map-pin.html',
})
export class MapPin implements OnDestroy {
  readonly address = input('');            // the typed address: the map follows it
  readonly pin = model<Pin | null>(null);  // two-way: checkout.html binds [(pin)]
  readonly pinAddress = model('');         // the address OpenStreetMap gives for the pinned spot, saved with the order

  protected readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  protected readonly zoomedIn = signal(false);
  protected readonly status = signal('');
  protected readonly looking = signal(false);   // loader in the "address at the pin" box
  private readonly ready = signal(false);
  private map?: LeafletMap;
  private following = true;   // the map follows the typed address until the customer drags it or uses GPS
  private typingTimer?: ReturnType<typeof setTimeout>;
  private pinTimer?: ReturnType<typeof setTimeout>;
  private lookup = 0;         // numbers each address lookup, so a slow old answer can't overwrite a newer one

  constructor() {
    afterNextRender(async () => {
      // Leaflet is an old-style (CommonJS) package: the production build puts it under .default, the dev build doesn't.
      const m = await import('leaflet');
      const L = m.default ?? m;
      const start = this.pin();
      this.map = L.map(this.box().nativeElement, { minZoom: 4, maxBounds: INDIA_EDGES, maxBoundsViscosity: 1 })
        .setView(start ?? INDIA, start ? STREET : INDIA.zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
      this.map.on('movestart', () => { clearTimeout(this.pinTimer); this.lookup++; this.looking.set(this.zoomedIn()); });
      this.map.on('moveend', () => this.readCentre());
      this.map.on('dragstart', () => { this.following = false; this.status.set(''); });   // placing it by hand now: stop following
      this.readCentre();
      this.ready.set(true);
    });

    // Re-runs whenever the address text changes (and once the map is ready). Waits for a pause in typing,
    // so we search once per edit, not once per key.
    effect(() => {
      const text = this.address().trim();
      if (!this.ready()) return;
      clearTimeout(this.typingTimer);
      if (this.following && text.length >= 6) this.typingTimer = setTimeout(() => this.findAddress(true), TYPING_PAUSE);
    });
  }

  ngOnDestroy() {
    clearTimeout(this.typingTimer);
    clearTimeout(this.pinTimer);
    this.map?.remove();
  }

  // Whatever is under the middle pin is the delivery spot, once zoomed in far enough to mean a real place.
  // Then, after the map has been still for a moment, ask OpenStreetMap which address that spot is.
  private readCentre() {
    if (!this.map) return;
    const ok = this.map.getZoom() >= CLOSE_ENOUGH;
    const c = this.map.getCenter();
    this.zoomedIn.set(ok);
    this.pin.set(ok ? { lat: c.lat, lng: c.lng } : null);
    clearTimeout(this.pinTimer);
    if (!ok) { this.looking.set(false); this.pinAddress.set(''); return; }

    this.looking.set(true);
    const id = ++this.lookup;
    this.pinTimer = setTimeout(async () => {
      const found = await reverse(c.lat, c.lng);
      if (id !== this.lookup) return;   // the map moved again meanwhile: that newer lookup wins
      this.pinAddress.set(found ?? '');
      this.looking.set(false);
    }, PIN_PAUSE);
  }

  // Phone GPS. The browser asks the customer first; works only on https (and localhost).
  useMyLocation() {
    if (!navigator.geolocation) return this.status.set('Your browser cannot share location. Move the map instead.');
    this.following = false;
    this.status.set('Finding you…');
    navigator.geolocation.getCurrentPosition(
      p => { this.status.set(''); this.map?.setView([p.coords.latitude, p.coords.longitude], STREET); },
      () => this.status.set('Location is blocked or unavailable. Search or move the map instead.'),
      { enableHighAccuracy: true, timeout: 15000 });
  }

  // Looks the typed address up on OpenStreetMap. Indian addresses often have a door number or street the map
  // doesn't know, so it tries: the full address -> without the first part -> just the pincode.
  // A match as big as a taluk or district is skipped (its middle can be a forest); the pincode is closer.
  async findAddress(auto = false) {
    const text = this.address().trim();
    if (!text) return this.status.set('Type your address above first.');
    if (!auto) this.following = true;
    this.status.set('Finding your address on the map…');

    const parts = text.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
    const pincode = text.match(/\b[1-9]\d{5}\b/)?.[0];
    const tries = [`q=${encodeURIComponent(text)}`];
    if (parts.length > 2) tries.push(`q=${encodeURIComponent(parts.slice(1).join(', '))}`);
    if (pincode) tries.push(`postalcode=${pincode}`);

    let rough: Place | null = null;
    for (const [i, query] of tries.entries()) {
      if (i) await wait(1000);                 // OpenStreetMap's fair-use rule: at most 1 search per second
      if (auto && !this.following) return;     // they started dragging meanwhile: leave the map alone
      const place = await search(query);
      if (!place) continue;
      if (place.rank < 16) { rough ??= place; continue; }   // 16+ = town, village, area, street or house
      this.map?.setView(place, STREET);
      this.status.set(i === 0 ? '' : 'Found your area. Drag the map so the pin sits exactly on your house.');
      return;
    }
    if (rough) {
      this.map?.setView(rough, 12);
      return this.status.set('Found only the wider area. Zoom in and drag the map to your street.');
    }
    this.status.set('Could not find that address. Zoom in and drag the map to your place.');
  }
}

interface Place { lat: number; lng: number; rank: number; }

async function search(query: string): Promise<Place | null> {
  try {
    const [first] = await fetch(`${MAPS}/search?format=json&limit=1&countrycodes=in&accept-language=en&${query}`).then(r => r.json());
    return first ? { lat: +first.lat, lng: +first.lon, rank: +first.place_rank } : null;
  } catch { return null; }
}

// "Which address is at this spot?" e.g. "Bazaar Street, Andipatti, Theni, Tamil Nadu, 625512".
async function reverse(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`${MAPS}/reverse?format=json&zoom=18&accept-language=en&lat=${lat}&lon=${lng}`).then(r => r.json());
    return r.display_name ? (r.display_name as string).replace(/, India$/, '') : null;
  } catch { return null; }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
