import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MapMeasurementService {
  private map: any;
  private L: any;
  private drawLayer: any;
  
  private isRulerActive: boolean = false;
  private measurementPoints: any[] = [];
  private currentMeasurementLine: any;
  private temporaryLine: any;
  private temporaryPopup: any;
  private isMouseTracking: boolean = false;

  constructor() {}

  initialize(map: any, L: any): void {
    this.map = map;
    this.L = L;
    this.drawLayer = L.layerGroup().addTo(map);
    (window as any).mapService = this;
  }

  isActive(): boolean {
    return this.isRulerActive;
  }

  toggle(enabled: boolean): void {
    this.isRulerActive = enabled;
    if (enabled) {
      this.map.getContainer().style.cursor = 'crosshair';
      console.log('📏 Ruler mode enabled');
    } else {
      this.map.getContainer().style.cursor = '';
      this.clearMeasurement();
      console.log('📏 Ruler mode disabled');
    }
  }

  disable(): void {
    this.isRulerActive = false;
    this.stopRealTimeTracking();
    this.clearMeasurement();
  }

  handleClick(e: any): void {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    const pointIcon = this.L.divIcon({
      className: 'measurement-point',
      html: `<div class="measure-point">${this.measurementPoints.length + 1}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    const marker = this.L.marker([lat, lng], { icon: pointIcon }).addTo(this.drawLayer);
    this.measurementPoints.push({ marker, latlng: e.latlng });
    
    if (this.measurementPoints.length === 1) {
      this.startRealTimeTracking();
      this.showInitialPopup(e.latlng);
    } else {
      this.stopRealTimeTracking();
      this.updateDistancePopup(e.latlng);
      this.drawMeasurementLine();
      setTimeout(() => this.startRealTimeTracking(), 100);
    }
  }

  private startRealTimeTracking(): void {
    this.isMouseTracking = true;
    this.map.on('mousemove', this.onMouseMoveForMeasurement, this);
  }

  private stopRealTimeTracking(): void {
    this.isMouseTracking = false;
    this.map.off('mousemove', this.onMouseMoveForMeasurement, this);
    
    if (this.temporaryLine) {
      this.drawLayer.removeLayer(this.temporaryLine);
      this.temporaryLine = null;
    }
  }

  private onMouseMoveForMeasurement = (e: any) => {
    if (!this.isMouseTracking || this.measurementPoints.length === 0) return;
    
    const currentMousePos = e.latlng;
    const lastPoint = this.measurementPoints[this.measurementPoints.length - 1];
    
    const distanceToMouse = this.calculateDistance(lastPoint.latlng, currentMousePos);
    const totalDistance = this.calculateTotalDistance() + distanceToMouse;
    
    this.drawTemporaryLine(currentMousePos);
    this.updateLiveDistancePopup(distanceToMouse, totalDistance);
  }

  private drawTemporaryLine(currentMousePos: any): void {
    if (this.temporaryLine) {
      this.drawLayer.removeLayer(this.temporaryLine);
    }
    
    const lastPoint = this.measurementPoints[this.measurementPoints.length - 1];
    
    this.temporaryLine = this.L.polyline([lastPoint.latlng, currentMousePos], {
      color: '#FF6B35',
      weight: 2,
      opacity: 0.7,
      dashArray: '8, 4'
    }).addTo(this.drawLayer);
  }

  private showInitialPopup(latlng: any): void {
    this.temporaryPopup = this.L.popup()
      .setLatLng(latlng)
      .setContent(`
        <div class="popup-content">
          <div class="live-distance" id="live-distance">
            <p class="instruction">📏 Gerakkan mouse untuk melihat jarak</p>
          </div>
          <div class="measure-actions">
            <button onclick="window.mapService?.clearMeasurement()" class="clear-btn">
              🗑️ Batal Pengukuran
            </button>
          </div>
        </div>
      `)
      .openOn(this.map);
  }

  private updateLiveDistancePopup(segmentDistance: number, totalDistance: number): void {
    const segmentKm = (segmentDistance / 1000).toFixed(2);
    const segmentM = segmentDistance.toFixed(0);
    const totalKm = (totalDistance / 1000).toFixed(2);
    const totalM = totalDistance.toFixed(0);
    const totalNm = (totalDistance * 0.000539957).toFixed(2);
    
    const liveDistanceElement = document.getElementById('live-distance');
    if (liveDistanceElement) {
      liveDistanceElement.innerHTML = `
        <div class="live-measurement">
          <h4>📏 Jarak:</h4>
          <div class="segment-distance">
            <p><strong>Segmen saat ini:</strong></p>
            <div class="distance-values">
              <span class="distance-badge km">${segmentKm} km</span>
              <span class="distance-badge m">${segmentM} m</span>
            </div>
          </div>
          ${this.measurementPoints.length > 1 ? `
          <div class="total-distance">
            <p><strong>Total jarak:</strong></p>
            <div class="distance-values">
              <span class="distance-badge total-km">${totalKm} km</span>
              <span class="distance-badge total-nm">${totalNm} nm</span>
              <span class="distance-badge total-m">${totalM} m</span>
            </div>
          </div>
          ` : ''}
        </div>
        <p class="instruction">👆 Klik untuk menambah titik</p>
      `;
    }
  }

  private updateDistancePopup(latlng: any): void {
    const totalDistance = this.calculateTotalDistance();
    const distanceKm = (totalDistance / 1000).toFixed(2);
    const distanceNm = (totalDistance * 0.000539957).toFixed(2);
    const distanceM = totalDistance.toFixed(0);
    
    const popup = this.L.popup()
      .setLatLng(latlng)
      .setContent(`
        <div class="custom-popup measure-popup">
          <div class="popup-header">
            <strong>📏 Hasil Pengukuran</strong>
          </div>
          <div class="popup-content">
            <div class="distance-results">
              <div class="distance-item">
                <span class="distance-icon">🎯</span>
                <span class="distance-value">${distanceKm} km</span>
              </div>
              <div class="distance-item">
                <span class="distance-icon">⛵</span>
                <span class="distance-value">${distanceNm} nautical miles</span>
              </div>
              <div class="distance-item">
                <span class="distance-icon">📐</span>
                <span class="distance-value">${distanceM} meter</span>
              </div>
            </div>
            <div class="measure-actions">
              <button onclick="navigator.clipboard.writeText('${distanceKm} km'); alert('Jarak disalin!')" class="copy-btn">
                📋 Copy
              </button>
              <button onclick="window.mapService?.clearMeasurement()" class="clear-btn">
                🗑️ Selesai
              </button>
            </div>
          </div>
        </div>
      `);
      
    if (this.temporaryPopup) {
      this.map.closePopup(this.temporaryPopup);
    }
    this.temporaryPopup = popup;
    popup.openOn(this.map);
  }

  private drawMeasurementLine(): void {
    if (this.currentMeasurementLine) {
      this.drawLayer.removeLayer(this.currentMeasurementLine);
    }
    
    const latlngs = this.measurementPoints.map(point => point.latlng);
    this.currentMeasurementLine = this.L.polyline(latlngs, {
      color: '#E91E63',
      weight: 3,
      opacity: 0.8,
      dashArray: '8, 8'
    }).addTo(this.drawLayer);
  }

  private calculateTotalDistance(): number {
    let totalDistance = 0;
    for (let i = 1; i < this.measurementPoints.length; i++) {
      const from = this.measurementPoints[i - 1].latlng;
      const to = this.measurementPoints[i].latlng;
      totalDistance += this.calculateDistance(from, to);
    }
    return totalDistance;
  }

  private calculateDistance(latlng1: any, latlng2: any): number {
    const R = 6371000;
    const φ1 = latlng1.lat * Math.PI / 180;
    const φ2 = latlng2.lat * Math.PI / 180;
    const Δφ = (latlng2.lat - latlng1.lat) * Math.PI / 180;
    const Δλ = (latlng2.lng - latlng1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  clearMeasurement(): void {
    this.stopRealTimeTracking();
    this.measurementPoints.forEach(point => {
      this.drawLayer.removeLayer(point.marker);
    });
    if (this.currentMeasurementLine) {
      this.drawLayer.removeLayer(this.currentMeasurementLine);
    }
    if (this.temporaryLine) {
      this.drawLayer.removeLayer(this.temporaryLine);
    }
    this.measurementPoints = [];
    this.currentMeasurementLine = null;
    this.temporaryLine = null;
    
    if (this.temporaryPopup) {
      this.map.closePopup(this.temporaryPopup);
      this.temporaryPopup = null;
    }
    
    console.log('🗑️ Measurement cleared');
  }

  cleanup(): void {
    this.disable();
    if (this.drawLayer) {
      this.drawLayer.clearLayers();
    }
  }
}
