import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './map/map'; // Import komponen map

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MapComponent], // Tambahkan MapComponent ke imports
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('my-leaflet-map');
}
