// map-drawing.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MapDrawingService {
  private map: any;
  private L: any;
  private drawLayer: any;
  
  private isDrawingActive: boolean = false;
  private currentDrawingPoints: any[] = [];
  private temporaryPolygon: any;
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
    return this.isDrawingActive;
  }

  toggle(enabled: boolean): void {
    this.isDrawingActive = enabled;
    if (enabled) {
      this.map.getContainer().style.cursor = 'crosshair';
      console.log('✏️ Drawing mode enabled');
    } else {
      this.map.getContainer().style.cursor = '';
      this.clearDrawing();
      console.log('✏️ Drawing mode disabled');
    }
  }

  disable(): void {
    this.isDrawingActive = false;
    this.stopRealTimeTracking();
    this.clearDrawing();
  }

  handleClick(e: any): void {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    const pointIcon = this.L.divIcon({
      className: 'drawing-point',
      html: `<div class="draw-point">${this.currentDrawingPoints.length + 1}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    const marker = this.L.marker([lat, lng], { icon: pointIcon }).addTo(this.drawLayer);
    this.currentDrawingPoints.push({ marker, latlng: e.latlng });
    
    if (this.currentDrawingPoints.length === 1) {
      this.startRealTimeAreaTracking();
      this.showInitialPopup(e.latlng);
    } else if (this.currentDrawingPoints.length >= 3) {
      this.updateAreaPopup(e.latlng);
      this.drawPolygonPreview();
    } else {
      this.drawLinePreview();
    }
  }

  handleDoubleClick(e: any): void {
    if (this.currentDrawingPoints.length >= 3) {
      this.finishDrawing();
    }
  }

  private startRealTimeAreaTracking(): void {
    this.isMouseTracking = true;
    this.map.on('mousemove', this.onMouseMoveForArea, this);
  }

  private stopRealTimeTracking(): void {
    this.isMouseTracking = false;
    this.map.off('mousemove', this.onMouseMoveForArea, this);
  }

  private onMouseMoveForArea = (e: any) => {
    if (!this.isMouseTracking || this.currentDrawingPoints.length === 0) return;
    
    const currentMousePos = e.latlng;
    
    if (this.currentDrawingPoints.length >= 2) {
      const tempPoints = [...this.currentDrawingPoints.map(p => p.latlng), currentMousePos];
      const area = this.calculatePolygonArea(tempPoints);
      
      this.drawTemporaryPolygon(currentMousePos);
      this.updateLiveAreaPopup(area);
    }
  }

  private drawTemporaryPolygon(currentMousePos: any): void {
    if (this.temporaryPolygon) {
      this.drawLayer.removeLayer(this.temporaryPolygon);
    }
    
    if (this.currentDrawingPoints.length >= 2) {
      const tempPoints = [...this.currentDrawingPoints.map(p => p.latlng), currentMousePos];
      this.temporaryPolygon = this.L.polygon(tempPoints, {
        color: '#FF6B35',
        fillColor: '#FF6B35',
        fillOpacity: 0.1,
        weight: 1,
        opacity: 0.5
      }).addTo(this.drawLayer);
    }
  }

  private showInitialPopup(latlng: any): void {
    this.temporaryPopup = this.L.popup()
      .setLatLng(latlng)
      .setContent(`
        <div class="custom-popup draw-popup">
          <div class="popup-header">
            <strong>✏️ Mulai Menggambar</strong>
          </div>
          <div class="popup-content">
            <div class="live-area" id="live-area">
              <div class="instruction">📐 Gerakkan mouse untuk melihat area</div>
            </div>
            <div class="draw-actions">
              <button onclick="window.mapService?.clearDrawing()" class="clear-btn">
                🗑️ Batal
              </button>
            </div>
          </div>
        </div>
      `)
      .openOn(this.map);
  }

  private updateLiveAreaPopup(area: number): void {
    const areaKm2 = (area / 1000000).toFixed(2);
    const areaHa = (area / 10000).toFixed(2);
    const areaM2 = area.toFixed(0);
    
    const liveAreaElement = document.getElementById('live-area');
    if (liveAreaElement) {
      liveAreaElement.innerHTML = `
        <div class="live-area-measurement">
          <h4>📐 Luas Real-time:</h4>
          <div class="area-values">
            <div class="area-item">
              <span class="area-icon">🏞️</span>
              <span class="area-badge km2">${areaKm2} km²</span>
            </div>
            <div class="area-item">
              <span class="area-icon">🌾</span>
              <span class="area-badge ha">${areaHa} ha</span>
            </div>
            <div class="area-item">
              <span class="area-icon">📏</span>
              <span class="area-badge m2">${areaM2} m²</span>
            </div>
          </div>
        </div>
        <p class="instruction">👆 Klik lagi | 🖱️ Double-click untuk selesai</p>
      `;
    }
  }

  private updateAreaPopup(latlng: any): void {
    const latlngs = this.currentDrawingPoints.map(p => p.latlng);
    const area = this.calculatePolygonArea(latlngs);
    const areaKm2 = (area / 1000000).toFixed(2);
    const areaHa = (area / 10000).toFixed(2);
    const areaM2 = area.toFixed(0);
    
    const popup = this.L.popup()
      .setLatLng(latlng)
      .setContent(`
        <div class="custom-popup draw-popup">
          <div class="popup-header">
            <strong>📐 Hasil Luas Area</strong>
          </div>
          <div class="popup-content">
            <div class="area-results">
              <div class="area-item">
                <span class="area-icon">🏞️</span>
                <span class="area-value">${areaKm2} km²</span>
              </div>
              <div class="area-item">
                <span class="area-icon">🌾</span>
                <span class="area-value">${areaHa} hektar</span>
              </div>
              <div class="area-item">
                <span class="area-icon">📏</span>
                <span class="area-value">${areaM2} m²</span>
              </div>
            </div>
            <div class="draw-actions">
              <button onclick="navigator.clipboard.writeText('${areaKm2} km²'); alert('Luas disalin!')" class="copy-btn">
                📋 Copy
              </button>
              <button onclick="window.mapService?.finishDrawing()" class="finish-btn">
                ✅ Selesai
              </button>
              <button onclick="window.mapService?.clearDrawing()" class="clear-btn">
                🗑️ Batal
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

  private drawLinePreview(): void {
    const latlngs = this.currentDrawingPoints.map(p => p.latlng);
    this.L.polyline(latlngs, {
      color: '#FF6B35',
      weight: 2,
      opacity: 0.6,
      dashArray: '5, 5'
    }).addTo(this.drawLayer);
  }

  private drawPolygonPreview(): void {
    this.drawLayer.eachLayer((layer: any) => {
      if (layer instanceof this.L.Polygon) {
        this.drawLayer.removeLayer(layer);
      }
    });
    
    const latlngs = this.currentDrawingPoints.map(p => p.latlng);
    this.L.polygon(latlngs, {
      color: '#FF6B35',
      fillColor: '#FF6B35',
      fillOpacity: 0.2,
      weight: 2,
      opacity: 0.8
    }).addTo(this.drawLayer);
  }

  private calculatePolygonArea(points: any[]): number {
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].lat * points[j].lng;
      area -= points[j].lat * points[i].lng;
    }
    
    area = Math.abs(area) / 2;
    const R = 6371000;
    return area * Math.PI * R * R / (180 * 180);
  }

  finishDrawing(): void {
    if (this.currentDrawingPoints.length >= 3) {
      this.stopRealTimeTracking();
      
      const latlngs = this.currentDrawingPoints.map(p => p.latlng);
      const area = this.calculatePolygonArea(latlngs);
      const areaKm2 = (area / 1000000).toFixed(2);
      const areaHa = (area / 10000).toFixed(2);
      const areaM2 = area.toFixed(0);
      
      const finalPolygon = this.L.polygon(latlngs, {
        color: '#FF6B35',
        fillColor: '#FF6B35',
        fillOpacity: 0.3,
        weight: 3
      }).addTo(this.drawLayer);
      
      finalPolygon.bindPopup(`
        <div class="custom-popup final-result">
          <div class="popup-header">
            <strong>✅ Polygon Selesai</strong>
          </div>
          <div class="popup-content">
            <div class="final-area">
              <h4>📐 Luas Area Final:</h4>
              <p>🏞️ ${areaKm2} km²</p>
              <p>🌾 ${areaHa} hektar</p>
              <p>📏 ${areaM2} m²</p>
            </div>
          </div>
        </div>
      `);
      
      this.currentDrawingPoints.forEach(p => {
        this.drawLayer.removeLayer(p.marker);
      });
      if (this.temporaryPolygon) {
        this.drawLayer.removeLayer(this.temporaryPolygon);
      }
      this.currentDrawingPoints = [];
      
      if (this.temporaryPopup) {
        this.map.closePopup(this.temporaryPopup);
        this.temporaryPopup = null;
      }
    }
  }

  clearDrawing(): void {
    this.stopRealTimeTracking();
    this.currentDrawingPoints.forEach(point => {
      this.drawLayer.removeLayer(point.marker);
    });
    this.drawLayer.eachLayer((layer: any) => {
      if (layer instanceof this.L.Polygon || layer instanceof this.L.Polyline) {
        this.drawLayer.removeLayer(layer);
      }
    });
    this.currentDrawingPoints = [];
    
    if (this.temporaryPolygon) {
      this.drawLayer.removeLayer(this.temporaryPolygon);
      this.temporaryPolygon = null;
    }
    
    if (this.temporaryPopup) {
      this.map.closePopup(this.temporaryPopup);
      this.temporaryPopup = null;
    }
  }

  cleanup(): void {
    this.disable();
    if (this.drawLayer) {
      this.drawLayer.clearLayers();
    }
  }
}
