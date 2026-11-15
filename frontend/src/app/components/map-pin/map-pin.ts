import { Component, ElementRef, OnDestroy, afterNextRender, input, model, signal, viewChild } from '@angular/core';
import type { Map as LeafletMap } from 'leaflet';

export interface Pin { lat: number; lng: number; }

const INDIA = { lat: 22.5, lng: 79, zoom: 5 };
const CLOSE_ENOUGH = 15;   // zoom level where one screen is a few streets: only then is the pin precise enough to save

// Amazon-style "adjust pin": the pin stays in the middle and the customer drags the MAP under it.
// Map: Leaflet + OpenStreetMap (free, no key). Loaded only when this component opens, so other pages stay light.
@Component({
  selector: 'app-map-pin',
  templateUrl: './map-pin.html',
})
export class MapPin implements OnDestroy {
  readonly address = input('');            // the typed address, for "Find my address"
  readonly pin = model<Pin | null>(null);  // two-way: checkout.html binds [(pin)]

  protected readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  protected readonly zoomedIn = signal(false);
  protected readonly status = signal('');
  private map?: LeafletMap;

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
      this.readCentre();
    });
  }

  ngOnDestroy() { this.map?.remove(); }

  // Whatever is under the middle pin is the delivery spot, once zoomed in far enough to mean a real place.
  private readCentre() {
    if (!this.map) return;
    const ok = this.map.getZoom() >= CLOSE_ENOUGH;
    const c = this.map.getCenter();
    this.zoomedIn.set(ok);
    this.pin.set(ok ? { lat: c.lat, lng: c.lng } : null);
    if (ok) this.status.set('');   // old hints ("found your pincode area…") no longer apply
  }

  // Phone GPS. The browser asks the customer first; works only on https (and localhost).
  useMyLocation() {
    if (!navigator.geolocation) return this.status.set('Your browser cannot share location. Move the map instead.');
    this.status.set('Finding you…');
    navigator.geolocation.getCurrentPosition(
      p => { this.status.set(''); this.map?.setView([p.coords.latitude, p.coords.longitude], 18); },
      () => this.status.set('Location is blocked or unavailable. Search or move the map instead.'),
      { enableHighAccuracy: true, timeout: 15000 });
  }

  // Looks up the typed address on OpenStreetMap (Nominatim). If the full text isn't found, tries just the pincode.
  async findAddress() {
    const text = this.address().trim();
    if (!text) return this.status.set('Type your address above first.');
    this.status.set('Searching…');
    const pincode = text.match(/\b[1-9]\d{5}\b/)?.[0];
    const hit = await search(`q=${encodeURIComponent(text)}`) ?? (pincode ? await search(`postalcode=${pincode}`) : null);
    if (!hit) return this.status.set('Could not find that address. Move the map to your place instead.');
    this.status.set(hit.exact ? '' : 'Found your pincode area. Now move the map to your exact house.');
    this.map?.setView([hit.lat, hit.lng], hit.exact ? 17 : 14);
  }
}

async function search(query: string) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&${query}`);
    const [first] = await r.json();
    return first ? { lat: +first.lat, lng: +first.lon, exact: query.startsWith('q=') } : null;
  } catch { return null; }
}
