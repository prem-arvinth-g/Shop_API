import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, model, signal, viewChild } from '@angular/core';
import type { Map as LeafletMap } from 'leaflet';

export interface Pin { lat: number; lng: number; }

const INDIA = { lat: 22.5, lng: 79, zoom: 5 };
const CLOSE_ENOUGH = 15;   // zoom level where one screen is a few streets: only then is the pin precise enough to save
const TYPING_PAUSE = 1200; // ms after the customer stops typing before the map looks the address up

// Amazon-style "adjust pin": the pin stays in the middle and the customer drags the MAP under it.
// Map: Leaflet + OpenStreetMap (free, no key). Loaded only when this component opens, so other pages stay light.
@Component({
  selector: 'app-map-pin',
  templateUrl: './map-pin.html',
})
export class MapPin implements OnDestroy {
  readonly address = input('');            // the typed address: the map follows it
  readonly pin = model<Pin | null>(null);  // two-way: checkout.html binds [(pin)]

  protected readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  protected readonly zoomedIn = signal(false);
  protected readonly status = signal('');
  private readonly ready = signal(false);
  private map?: LeafletMap;
  private following = true;   // the map follows the typed address until the customer drags it or uses GPS
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(async () => {
      // Leaflet is an old-style (CommonJS) package: the production build puts it under .default, the dev build doesn't.
      const m = await import('leaflet');
      const L = m.default ?? m;
      const start = this.pin();
      this.map = L.map(this.box().nativeElement, { zoomControl: true })
        .setView(start ?? INDIA, start ? 17 : INDIA.zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
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
      clearTimeout(this.timer);
      if (this.following && text.length >= 6) this.timer = setTimeout(() => this.findAddress(true), TYPING_PAUSE);
    });
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
    this.map?.remove();
  }

  // Whatever is under the middle pin is the delivery spot, once zoomed in far enough to mean a real place.
  private readCentre() {
    if (!this.map) return;
    const ok = this.map.getZoom() >= CLOSE_ENOUGH;
    const c = this.map.getCenter();
    this.zoomedIn.set(ok);
    this.pin.set(ok ? { lat: c.lat, lng: c.lng } : null);
  }

  // Phone GPS. The browser asks the customer first; works only on https (and localhost).
  useMyLocation() {
    if (!navigator.geolocation) return this.status.set('Your browser cannot share location. Move the map instead.');
    this.following = false;
    this.status.set('Finding you…');
    navigator.geolocation.getCurrentPosition(
      p => { this.status.set(''); this.map?.setView([p.coords.latitude, p.coords.longitude], 18); },
      () => this.status.set('Location is blocked or unavailable. Search or move the map instead.'),
      { enableHighAccuracy: true, timeout: 15000 });
  }

  // Looks the typed address up on OpenStreetMap (Nominatim). Indian addresses often have a door number or street
  // the map doesn't know, so it tries: the full address -> without the first part -> just the pincode.
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

    for (const [i, query] of tries.entries()) {
      if (i) await wait(1000);                 // OpenStreetMap's fair-use rule: at most 1 search per second
      if (auto && !this.following) return;     // they started dragging meanwhile: leave the map alone
      const area = await search(query);
      if (!area || !this.map) continue;
      // Show the whole place that was found: a house fills the screen, a town or taluk shows the full area.
      this.map.fitBounds(area, { maxZoom: 17 });
      this.status.set(this.map.getZoom() >= CLOSE_ENOUGH ? '' : 'Found your area. Zoom in and drag the map so the pin sits on your house.');
      return;
    }
    this.status.set('Could not find that address. Zoom in and drag the map to your place.');
  }
}

async function search(query: string) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&${query}`);
    const [first] = await r.json();
    if (!first) return null;
    const [south, north, west, east] = (first.boundingbox as string[]).map(Number);   // the found place's edges
    return [[south, west], [north, east]] as [[number, number], [number, number]];
  } catch { return null; }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
