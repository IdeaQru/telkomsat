// map.service.ts - SIMPLE ZOOM CONTROL DENGAN DISTANCE VIEW
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

// Impor semua layanan yang dibutuhkan
import { MapLayerService, MapLayer } from './map-layer.service';
import { MapControlsService } from './map-control.service';
import { MapMeasurementService } from './map-measurement.service';
import { MapDrawingService } from './map-drawing.service';
import { MapMarkerService } from './map-marker.service';
import { MapCoordinateService } from './map-coordinate.service';
import { VesselService } from './vessel-service'; // Pastikan path ini benar
import { VtsService } from './vts.service';
import { AtonService } from './aton.service';
import { MapLegendService } from './map-legend.service';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: any;
  private currentLayer: any;
  private L: any;
  
  // ✅ Simple zoom level control properties
  private zoomLevelSubject = new BehaviorSubject<number>(6);
  public zoomLevel$ = this.zoomLevelSubject.asObservable();
  private customZoomControl: any = null;
  
  // Properti publik untuk state peta
  public layers: MapLayer[] = [];
  public controls: any[] = [];
  public activeLayer: string = '';
  public coords: string = '-6.2088, 106.8456';
  public zoomLevel: number = 6;
  public cursorCoords: string = '-6.2088, 106.8456';
  leaflet: any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    // Injeksi semua layanan terkait peta
    private mapLayerService: MapLayerService,
    private mapControlsService: MapControlsService,
    private measurementService: MapMeasurementService,
    private drawingService: MapDrawingService,
    private markerService: MapMarkerService,
    private coordinateService: MapCoordinateService,
    private vesselService: VesselService,
    private vtsService: VtsService,
    private atonService: AtonService,
    private mapLegendService: MapLegendService
  ) {
    this.initializeData();
  }

  public getLeaflet(): any | undefined {
    return this.leaflet;
  }

  private initializeData(): void {
    try {
      this.layers = this.mapLayerService.getLayers();
      this.controls = this.mapControlsService.getControls();
      
      // ✅ ADD simple zoom level control to controls array
      this.controls.push({
        id: 'zoomlevel',
        name: 'Zoom Level',
        icon: 'zoom_in',
        enabled: false,
        description: 'Simple zoom control with distance view'
      });

      if (this.layers.length > 0) {
        this.activeLayer = this.layers[0].name;
      }
      console.log('✅ MapService data initialized with simple zoom control');
    } catch (error) {
      console.error('❌ Error initializing MapService:', error);
      this.setFallbackData();
    }
  }

  private setFallbackData(): void {
    this.layers = [
        { name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap' },
        { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
        { name: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '© CartoDB' },
        { name: 'Ocean', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' }
    ];
    this.controls = [
        { id: 'ruler', name: 'Penggaris', icon: 'fas fa-ruler-combined', enabled: false, description: 'Ukur jarak' },
        { id: 'marker', name: 'Marker', icon: 'fas fa-map-pin', enabled: false, description: 'Tambah penanda' },
        { id: 'fullscreen', name: 'Fullscreen', icon: 'fas fa-expand', enabled: false, description: 'Layar penuh' },
        { id: 'geolocation', name: 'Lokasi Saya', icon: 'fas fa-location-arrow', enabled: false, description: 'Temukan lokasi saya' },
        { id: 'draw', name: 'Gambar', icon: 'fas fa-pen', enabled: false, description: 'Gambar di peta' },
        { id: 'zoomlevel', name: 'Zoom Level', icon: 'zoom_in', enabled: false, description: 'Simple zoom control' },
        { id: 'vts', name: 'VTS', icon: 'cell_tower', enabled: false, description: 'Vessel Traffic Service' },
        { id: 'aton', name: 'AtoN', icon: 'navigation', enabled: false, description: 'Aid to Navigation' }
    ];
    this.activeLayer = this.layers[0].name;
    console.log('✅ Fallback data set with simple zoom control');
  }

  public getLayerIcon(name: string): string {
    const icons: { [key: string]: string } = {
      'OpenStreetMap': 'map',
      'Satellite': 'satellite_alt',
      'Dark': 'dark_mode',
      'Ocean': 'water'
    };
    return icons[name] || 'layers';
  }

  public getControlIcon(id: string): string {
    const icons: { [key: string]: string } = {
      'ruler': 'straighten',
      'marker': 'place',
      'fullscreen': 'fullscreen',
      'geolocation': 'my_location',
      'draw': 'edit',
      'zoomlevel': 'zoom_in',
      'vts': 'cell_tower',
      'aton': 'navigation'
    };
    return icons[id] || 'settings';
  }

  // Metode inisialisasi utama peta
  async initializeMap(containerId: string): Promise<any> {
    if (!isPlatformBrowser(this.platformId)) return null;

    try {
      console.log('🗺️ Initializing map with simple zoom control...');
      
      this.L = await import('leaflet');

      this.setupLeafletIcons();
      
      const defaultLayer = this.layers[0];
      this.activeLayer = defaultLayer.name;
      this.currentLayer = this.mapLayerService.createLeafletLayer(defaultLayer, this.L);

      // 1. Buat objek peta dengan zoom control disabled
      this.map = this.L.map(containerId, {
        center: [-7.2088, 110.8456],
        zoom: 6,
        layers: [this.currentLayer],
        zoomControl: false,
        minZoom: 1,
        maxZoom: 19
      });

      // 2. ✅ Setup simple custom zoom control
      this.setupSimpleZoomControl();

      // 3. Initialize services
      await this.initializeServices();
      
      this.setupMapEvents();
      this.updateInfo();

      console.log('✅ Map initialized successfully with simple zoom control');
      return this.map;
    } catch (error) {
      console.error('❌ Map initialization error:', error);
      throw error;
    }
  }

  // ✅ NEW: Setup simple zoom control dengan distance view
  private setupSimpleZoomControl(): void {
    const ZoomLevelControl = this.L.Control.extend({
      onAdd: (map: any) => {
        const container = this.L.DomUtil.create('div', 'simple-zoom-control');
        container.innerHTML = `
          <div class="zoom-control-wrapper">
            <button class="zoom-btn zoom-in" title="Zoom In">
              <i class="material-icons">add</i>
            </button>
            <div class="zoom-info">
              <div class="zoom-level">${this.zoomLevel}</div>
              <div class="view-distance">${this.getViewDistance()}</div>
            </div>
            <button class="zoom-btn zoom-out" title="Zoom Out">
              <i class="material-icons">remove</i>
            </button>
          </div>
        `;

        // ✅ Event handlers
        this.L.DomEvent.disableClickPropagation(container);
        
        // Zoom in button
        const zoomInBtn = container.querySelector('.zoom-in');
        this.L.DomEvent.on(zoomInBtn, 'click', () => {
          this.zoomIn();
        });

        // Zoom out button
        const zoomOutBtn = container.querySelector('.zoom-out');
        this.L.DomEvent.on(zoomOutBtn, 'click', () => {
          this.zoomOut();
        });

        return container;
      },

      onRemove: (map: any) => {
        // Cleanup if needed
      }
    });

    // Add control to map
    this.customZoomControl = new ZoomLevelControl({ position: 'topright' });
    this.customZoomControl.addTo(this.map);
  }

  // ✅ NEW: Calculate view distance berdasarkan zoom level
  private getViewDistance(): string {
    // Approximate distances for different zoom levels
    const distanceMap: { [key: number]: string } = {
      1: '20,000 km',
      2: '10,000 km', 
      3: '5,000 km',
      4: '2,500 km',
      5: '1,250 km',
      6: '625 km',
      7: '312 km',
      8: '156 km',
      9: '78 km',
      10: '39 km',
      11: '20 km',
      12: '10 km',
      13: '5 km',
      14: '2.5 km',
      15: '1.25 km',
      16: '625 m',
      17: '312 m',
      18: '156 m',
      19: '78 m'
    };

    return distanceMap[this.zoomLevel] || `${Math.round(20000 / Math.pow(2, this.zoomLevel - 1))} km`;
  }

  // ✅ NEW: Update zoom info display
  private updateZoomDisplay(): void {
    if (this.customZoomControl) {
      const container = this.customZoomControl.getContainer();
      const zoomLevelEl = container.querySelector('.zoom-level');
      const viewDistanceEl = container.querySelector('.view-distance');
      
      if (zoomLevelEl) zoomLevelEl.textContent = this.zoomLevel.toString();
      if (viewDistanceEl) viewDistanceEl.textContent = this.getViewDistance();
    }
  }

  // Initialize services
  private async initializeServices(): Promise<void> {
    if (!this.map) return;

    this.coordinateService.initialize(this.map, this.L);
    this.measurementService.initialize(this.map, this.L);
    this.drawingService.initialize(this.map, this.L);
    this.markerService.initialize(this.map, this.L);
    this.vesselService.initialize(this.map, this.L);
    this.vtsService.initialize(this.map, this.L);
    this.atonService.initialize(this.map, this.L);
    this.mapLegendService.initialize(this.map, this.L);
    
    const legend = this.mapLegendService.createLegend();
    legend.addTo(this.map);
    this.setupClickHandler();
  }

  public updateLegendCounts(vesselCount: number, vtsCount: number, atonCount: number): void {
    this.mapLegendService.updateCounts(vesselCount, vtsCount, atonCount);
  }

  private setupClickHandler(): void {
    this.map.on('click', (e: any) => {
      if (this.measurementService.isActive()) return this.measurementService.handleClick(e);
      if (this.drawingService.isActive()) return this.drawingService.handleClick(e);
      if (this.markerService.isActive()) return this.markerService.handleClick(e);
    });
  }

  // ✅ ENHANCED: Setup map events dengan zoom tracking
  private setupMapEvents(): void {
    this.map.on('mousemove', (e: any) => {
      const { lat, lng } = e.latlng;
      this.cursorCoords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      this.coordinateService.updateCursorCoords(this.cursorCoords);
    });

    this.map.on('zoomend moveend', () => {
      this.updateInfo();
      this.updateZoomDisplay(); // ✅ Update zoom display
      this.zoomLevelSubject.next(this.zoomLevel); // ✅ Emit zoom change
    });

    this.map.on('dblclick', (e: any) => {
      if (this.drawingService.isActive()) this.drawingService.handleDoubleClick(e);
    });
  }

  private updateInfo(): void {
    const center = this.map.getCenter();
    this.zoomLevel = this.map.getZoom();
    this.coords = `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
  }

  // Control toggle handler
  public handleControlToggle(controlId: string, isEnabled: boolean): void {
    const control = this.controls.find(c => c.id === controlId);
    if (control) control.enabled = isEnabled;
    
    this.disableAllInteractiveServices();
    
    switch (controlId) {
      case 'ruler': this.measurementService.toggle(isEnabled); break;
      case 'draw': this.drawingService.toggle(isEnabled); break;
      case 'marker': this.markerService.toggle(isEnabled); break;
      case 'fullscreen': if (isEnabled) this.toggleFullscreen(); break;
      case 'geolocation': if (isEnabled) this.getCurrentLocation(); break;
      case 'zoomlevel': 
        // Simple zoom control doesn't need special toggle
        console.log('🔍 Simple zoom control always active');
        break;
      case 'vts': this.vtsService.toggleVtsVisibility(isEnabled); break;
      case 'aton': this.atonService.toggleAtonVisibility(isEnabled); break;
    }
  }

  private disableAllInteractiveServices(): void {
    this.measurementService.disable();
    this.drawingService.disable();
    this.markerService.disable();
  }

  // ✅ Simple zoom methods
  public zoomIn(): void {
    if (this.map && this.zoomLevel < 19) {
      this.map.zoomIn();
    }
  }

  public zoomOut(): void {
    if (this.map && this.zoomLevel > 1) {
      this.map.zoomOut();
    }
  }

  public setZoomLevel(level: number): void {
    if (this.map && level >= 1 && level <= 19) {
      this.map.setZoom(level);
    }
  }

  public getCurrentZoomLevel(): number {
    return this.zoomLevel;
  }

  public getCurrentViewDistance(): string {
    return this.getViewDistance();
  }

  // Layer switching
  public switchLayer(layerName: string): void {
    const layerConfig = this.layers.find(l => l.name === layerName);
    if (layerConfig && this.map) {
      if (this.currentLayer) this.map.removeLayer(this.currentLayer);
      
      this.currentLayer = this.mapLayerService.createLeafletLayer(layerConfig, this.L);
      this.map.addLayer(this.currentLayer);
      this.activeLayer = layerName;
    }
  }

  // Utility functions
  private setupLeafletIcons(): void {
    delete (this.L.Icon.Default.prototype as any)._getIconUrl;
    this.L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }

  private toggleFullscreen(): void {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        alert(`Error saat mencoba mode layar penuh: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  private getCurrentLocation(): void {
    if (!navigator.geolocation) {
      alert('Geolocation tidak didukung oleh browser Anda.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.map.setView([lat, lng], 15);
        this.L.marker([lat, lng])
          .addTo(this.map)
          .bindPopup(`<b>Lokasi Anda</b><br>Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`)
          .openPopup();
      },
      (error) => {
        alert('Tidak dapat mengakses lokasi Anda. Pastikan Anda memberikan izin.');
        console.error('Error Geolokasi:', error);
      }
    );
  }

  // Getters
  public getMap(): any {
    return this.map;
  }

  public getMarkersCount(): number {
    return this.markerService.getMarkersCount();
  }

  // Cleanup
  public resizeMap(): void {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 100);
    }
  }

  public destroyMap(): void {
    if (this.map) {
      this.measurementService.cleanup();
      this.drawingService.cleanup();
      this.markerService.cleanup();
      this.coordinateService.cleanup();
      this.vesselService.cleanup();
      this.vtsService.cleanup();
      this.atonService.cleanup();
      this.mapLegendService.cleanup();
      
      // ✅ Cleanup simple zoom control
      if (this.customZoomControl) {
        this.map.removeControl(this.customZoomControl);
        this.customZoomControl = null;
      }
      
      this.map.off();
      this.map.remove();
      this.map = null;
      this.currentLayer = null;
    }
  }
}
