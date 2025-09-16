// map-coordinate.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MapCoordinateService {
  private map: any;
  private L: any;

  constructor() {}

  initialize(map: any, L: any): void {
    this.map = map;
    this.L = L;
    this.addCoordinateDisplay();
  }

// map-coordinate.service.ts - UPDATED VERSION
private addCoordinateDisplay(): void {
  const coordinateControl = this.L.Control.extend({
    onAdd: (map: any) => {
      const div = this.L.DomUtil.create('div', 'coordinate-display-control');
      div.innerHTML = `
        <div class="coord-panel">
          <div class="coord-header">
            <i class="fas fa-map-marker-alt coord-icon"></i>
            <span class="coord-title">Koordinat</span>
          </div>
          <div class="coord-value" id="cursor-coords">-6.2088, 106.8456</div>
          <div class="markers-info" id="markers-info" style="display: none;">
            <i class="fas fa-map-pin marker-icon"></i>
            <span id="marker-count">0 Marker</span>
            <button class="clear-btn" id="clear-markers-btn" onclick="window.mapService?.clearAllMarkers()">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      `;
      
      this.L.DomEvent.disableClickPropagation(div);
      this.L.DomEvent.disableScrollPropagation(div);
      
      return div;
    }
  });

  new coordinateControl({ position: 'bottomright' }).addTo(this.map);
}


  updateCursorCoords(coords: string): void {
    const coordElement = document.getElementById('cursor-coords');
    if (coordElement) {
      coordElement.textContent = coords;
    }
  }

  cleanup(): void {
    // Coordinate display will be removed when map is destroyed
  }
}
