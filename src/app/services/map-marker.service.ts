// map-marker.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MapMarkerService {
  private map: any;
  private L: any;
  private clickMarkers: any[] = [];
  private isMarkerActive: boolean = false;

  constructor() {}

  initialize(map: any, L: any): void {
    this.map = map;
    this.L = L;
    (window as any).mapService = this;
  }

  isActive(): boolean {
    return this.isMarkerActive;
  }

  toggle(enabled: boolean): void {
    this.isMarkerActive = enabled;
    if (enabled) {
      this.map.getContainer().style.cursor = 'crosshair';
      console.log('🎯 Marker mode enabled');
    } else {
      this.map.getContainer().style.cursor = '';
      console.log('🎯 Marker mode disabled');
    }
  }

  disable(): void {
    this.isMarkerActive = false;
  }

  handleClick(e: any): void {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    const customIcon = this.L.divIcon({
      className: 'custom-click-marker',
      html: `<div class="click-marker-icon">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });
    
    const marker = this.L.marker([lat, lng], { icon: customIcon }).addTo(this.map);
    const popupContent = this.createClickMarkerPopup(lat, lng, this.clickMarkers.length + 1);
    marker.bindPopup(popupContent).openPopup();
    
    this.clickMarkers.push(marker);
    this.updateMarkersDisplay();
  }

  private createClickMarkerPopup(lat: number, lng: number, markerNumber: number): string {
    const formattedLat = lat.toFixed(6);
    const formattedLng = lng.toFixed(6);
    const ddmsLat = this.convertToDDMS(lat, true);
    const ddmsLng = this.convertToDDMS(lng, false);
    
    return `
      <div class="custom-popup marker-popup">
        <div class="popup-header">
          <strong>📍 Marker #${markerNumber}</strong>
        </div>
        <div class="popup-content">
          <div class="coord-section">
            <h4>🌐 Koordinat Decimal:</h4>
            <p class="coord-decimal">${formattedLat}, ${formattedLng}</p>
            <h4>📐 Koordinat DMS:</h4>
            <p class="coord-dms">${ddmsLat}</p>
            <p class="coord-dms">${ddmsLng}</p>
          </div>
          <div class="marker-actions">
            <button onclick="navigator.clipboard.writeText('${formattedLat}, ${formattedLng}'); alert('Koordinat disalin!')" class="copy-btn">
              📋 Copy Koordinat
            </button>
            <button onclick="window.mapService?.removeMarker(${markerNumber - 1})" class="remove-btn">
              🗑️ Hapus Marker
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private convertToDDMS(value: number, isLat: boolean): string {
    const degrees = Math.floor(Math.abs(value));
    const minutes = Math.floor((Math.abs(value) - degrees) * 60);
    const seconds = (((Math.abs(value) - degrees) * 60) - minutes) * 60;
    const direction = value >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
    return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
  }

  removeMarker(index: number): void {
    if (this.clickMarkers[index]) {
      this.map.removeLayer(this.clickMarkers[index]);
      this.clickMarkers.splice(index, 1);
      this.updateMarkersDisplay();
      console.log(`🗑️ Marker ${index + 1} removed`);
    }
  }

  clearAllMarkers(): void {
    this.clickMarkers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.clickMarkers = [];
    this.updateMarkersDisplay();
    console.log('🗑️ All markers cleared');
  }

  private updateMarkersDisplay(): void {
    const markersInfo = document.getElementById('markers-info');
    const markerCount = document.getElementById('marker-count');
    
    if (markersInfo && markerCount) {
      if (this.clickMarkers.length > 0) {
        markersInfo.style.display = 'flex';
        markerCount.textContent = `${this.clickMarkers.length} Marker${this.clickMarkers.length > 1 ? 's' : ''}`;
      } else {
        markersInfo.style.display = 'none';
      }
    }
  }

  getMarkersCount(): number {
    return this.clickMarkers.length;
  }

  cleanup(): void {
    this.clearAllMarkers();
  }
}
