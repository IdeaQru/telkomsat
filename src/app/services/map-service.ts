// map.service.ts - PUSAT KONTROL (VERSI LENGKAP DAN BENAR)
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Impor semua layanan yang dibutuhkan
import { MapLayerService, MapLayer } from './map-layer.service';
import { MapControlsService } from './map-control.service';
import { MapMeasurementService } from './map-measurement.service';
import { MapDrawingService } from './map-drawing.service';
import { MapMarkerService } from './map-marker.service';
import { MapCoordinateService } from './map-coordinate.service';
import { VesselService } from './vessel-service'; // Pastikan path ini benar
import { VtsService } from './vts.service'; // ✅ TAMBAHKAN IMPORT VTS
import { AtonService } from './aton.service';
import { MapLegendService } from './map-legend.service';
// import L from 'leaflet';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: any;
  private currentLayer: any;
  private L: any;
  
  // Properti publik untuk state peta
  public layers: MapLayer[] = [];
  public controls: any[] = [];
  public activeLayer: string = '';
  public coords: string = '-6.2088, 106.8456';
  public zoomLevel: number = 10;
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
    private vesselService: VesselService, // <-- Injeksi VesselService
     private vtsService: VtsService, // ✅ INJEKSI VTS SERVICE
     private atonService: AtonService, // ✅ INJEKSI VTS SERVICE
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
        // ✅ TAMBAHKAN VTS CONTROL ke controls array
    
      
  
      if (this.layers.length > 0) {
        this.activeLayer = this.layers[0].name;
      }
      console.log('✅ MapService data initialized');
    } catch (error) {
      console.error('❌ Error initializing MapService:', error);
      this.setFallbackData();
    }
  }

  private setFallbackData(): void {
    // Fungsi ini menyediakan data cadangan jika inisialisasi gagal
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
        { id: 'draw', name: 'Gambar', icon: 'fas fa-pen', enabled: false, description: 'Gambar di peta' }
    ];
    this.activeLayer = this.layers[0].name;
    console.log('✅ Fallback data set');
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

  /**
   * Mengembalikan nama ikon Material Design berdasarkan ID kontrol.
   * @param id ID kontrol
   * @returns Nama ikon
   */
  public getControlIcon(id: string): string {
    const icons: { [key: string]: string } = {
      'ruler': 'straighten',
      'marker': 'place',
      'fullscreen': 'fullscreen',
      'geolocation': 'my_location',
      'draw': 'edit',
      'vts': 'cell_tower',
      'aton': 'navigation' //buoy

    };
    return icons[id] || 'settings';
  }
  // Metode inisialisasi utama peta
  async initializeMap(containerId: string): Promise<any> {
    if (!isPlatformBrowser(this.platformId)) return null;

    try {
      console.log('🗺️ Initializing map...');
      
      this.L = await import('leaflet');

      this.setupLeafletIcons(); // Atasi masalah ikon default Leaflet
      
      const defaultLayer = this.layers[0];
      this.activeLayer = defaultLayer.name;
      this.currentLayer = this.mapLayerService.createLeafletLayer(defaultLayer, this.L);

      // 1. Buat objek peta terlebih dahulu
      this.map = this.L.map(containerId, {
        center: [-7.2088, 110.8456],
        zoom: 6,
        layers: [this.currentLayer],
        zoomControl: false
      });

      // 2. Setelah peta dibuat, inisialisasi semua layanan
      await this.initializeServices();
      
      this.setupMapEvents();
      this.updateInfo();

      console.log('✅ Map initialized successfully');
      return this.map;
    } catch (error) {
      console.error('❌ Map initialization error:', error);
      throw error; // Lempar error agar bisa ditangani di komponen
    }
  }

  // Inisialisasi semua layanan yang bergantung pada peta
  private async initializeServices(): Promise<void> {
    // Pastikan this.map sudah ada sebelum memanggil ini
    if (!this.map) return;

    this.coordinateService.initialize(this.map, this.L);
    this.measurementService.initialize(this.map, this.L);
    this.drawingService.initialize(this.map, this.L);
    this.markerService.initialize(this.map, this.L);
    this.vesselService.initialize(this.map, this.L); // <-- Inisialisasi VesselService
     this.vtsService.initialize(this.map, this.L); // ✅ INISIALISASI VTS SERVICE
     this.atonService.initialize(this.map, this.L); // ✅ INISIALISASI VTS SERVICE
    this.mapLegendService.initialize(this.map, this.L);
    const legend = this.mapLegendService.createLegend();
    legend.addTo(this.map);
    this.setupClickHandler();
  }
 public updateLegendCounts(vesselCount: number, vtsCount: number, atonCount: number): void {
    this.mapLegendService.updateCounts(vesselCount, vtsCount, atonCount);
  }
  // Delegasi event klik ke layanan yang aktif
  private setupClickHandler(): void {
    this.map.on('click', (e: any) => {
      if (this.measurementService.isActive()) return this.measurementService.handleClick(e);
      if (this.drawingService.isActive()) return this.drawingService.handleClick(e);
      if (this.markerService.isActive()) return this.markerService.handleClick(e);
    });
  }

  // Atur event-event peta
  private setupMapEvents(): void {
    this.map.on('mousemove', (e: any) => {
      const { lat, lng } = e.latlng;
      this.cursorCoords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      this.coordinateService.updateCursorCoords(this.cursorCoords);
    });

    this.map.on('zoomend moveend', () => this.updateInfo());

    this.map.on('dblclick', (e: any) => {
      if (this.drawingService.isActive()) this.drawingService.handleDoubleClick(e);
    });
  }

  private updateInfo(): void {
    const center = this.map.getCenter();
    this.zoomLevel = this.map.getZoom();
    this.coords = `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
  }

  // Menangani toggle kontrol dari UI
  public handleControlToggle(controlId: string, isEnabled: boolean): void {
    const control = this.controls.find(c => c.id === controlId);
    if (control) control.enabled = isEnabled;
    
    // Matikan semua service interaktif lain untuk menghindari konflik
    this.disableAllInteractiveServices();
    
    switch (controlId) {
      case 'ruler': this.measurementService.toggle(isEnabled); break;
      case 'draw': this.drawingService.toggle(isEnabled); break;
      case 'marker': this.markerService.toggle(isEnabled); break;
      case 'fullscreen': if (isEnabled) this.toggleFullscreen(); break;
      case 'geolocation': if (isEnabled) this.getCurrentLocation(); break;
    }
  }

  private disableAllInteractiveServices(): void {
    this.measurementService.disable();
    this.drawingService.disable();
    this.markerService.disable();
  }

  // Mengganti layer peta
  public switchLayer(layerName: string): void {
    const layerConfig = this.layers.find(l => l.name === layerName);
    if (layerConfig && this.map) {
      if (this.currentLayer) this.map.removeLayer(this.currentLayer);
      
      this.currentLayer = this.mapLayerService.createLeafletLayer(layerConfig, this.L);
      this.map.addLayer(this.currentLayer);
      this.activeLayer = layerName;
    }
  }

  // Fungsi utilitas untuk ikon
  private setupLeafletIcons(): void {
    // Perbaikan untuk masalah ikon default Leaflet dengan Webpack
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

  // GETTERS
  public getMap(): any {
    return this.map;
  }

  public getMarkersCount(): number {
    return this.markerService.getMarkersCount();
  }

  // CLEANUP
  public resizeMap(): void {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 100);
    }
  }

  public destroyMap(): void {
    if (this.map) {
      // Cleanup semua layanan
      this.measurementService.cleanup();
      this.drawingService.cleanup();
      this.markerService.cleanup();
      this.coordinateService.cleanup();
      this.vesselService.cleanup(); // <-- Cleanup VesselService
         this.vtsService.cleanup(); // ✅ CLEANUP VTS SERVICE
        this.atonService.initialize(this.map, this.L); // ✅ INISIALISASI ATON
this.mapLegendService.cleanup();
      this.map.off(); // Hapus semua listener dari objek peta
      this.map.remove(); // Hapus peta dari DOM
      this.map = null;
      this.currentLayer = null;
    }
  }
}
