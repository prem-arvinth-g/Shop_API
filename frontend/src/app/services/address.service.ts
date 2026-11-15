import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AddressInput, SavedAddress } from '../models/models';

// The customer's saved delivery addresses: backend/Controllers/AddressesController.cs
@Injectable({ providedIn: 'root' })
export class AddressService {
  private http = inject(HttpClient);

  mine() { return this.http.get<SavedAddress[]>('/api/addresses'); }
  create(a: AddressInput) { return this.http.post<SavedAddress>('/api/addresses', a); }
  update(id: number, a: AddressInput) { return this.http.put<SavedAddress>(`/api/addresses/${id}`, a); }
  remove(id: number) { return this.http.delete<void>(`/api/addresses/${id}`); }
}
