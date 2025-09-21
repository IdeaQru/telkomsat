// src/services/vessel-marker-manager.ts
import { Injectable, NgZone, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Vessel } from './vessel-websocket.service';
import { VesselPopupService } from './vessel-pop-up.service';

@Injectable({
  providedIn: 'root'
})
export class VesselMarkerManager {
  private map: any;
  private vesselPopupService: VesselPopupService;
  private zone: NgZone;
  private isBrowser: boolean;
  
  // ✅ Simplified - NO CLUSTER, just regular markers with bounds filtering
  private L: any;
  private vesselMarkers: Map<number, any> = new Map();
  
  // ✅ Bounds and radius settings
  private currentBounds: any = null;
  private maxMarkersToShow = 500; // Limit markers for performance
  private radiusKm = 100; // Default radius in kilometers
  private lastUpdateTime = 0;
  private updateThrottle = 100;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    vesselPopupService: VesselPopupService, 
    zone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.vesselPopupService = vesselPopupService;
    this.zone = zone;
    
    console.log('🗺️ VesselMarkerManager constructor (Bounds-based) - isBrowser:', this.isBrowser);
  }

  /**
   * 🔄 Initialize - SIMPLIFIED WITHOUT CLUSTER
   */
  async initialize(map: any): Promise<void> {
    console.log('🔄 VesselMarkerManager.initialize called - isBrowser:', this.isBrowser);
    
    if (!this.isBrowser) {
      console.log('⚠️ Not in browser environment');
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization(map);
    return this.initializationPromise;
  }

  private async _performInitialization(map: any): Promise<void> {
    try {
      console.log('🚀 Starting simple VesselMarkerManager initialization...');

      // ✅ Dynamic import Leaflet
      const LeafletModule = await import('leaflet');
      this.L = LeafletModule.default || LeafletModule;
      console.log('✅ Leaflet imported:', !!this.L);
      
      this.map = map;
      this.setupMapEventHandlers();
      this.updateCurrentBounds();
      
      this.isInitialized = true;
      console.log('✅ Simple VesselMarkerManager initialization completed');
      
    } catch (error) {
      console.error('❌ Error initializing VesselMarkerManager:', error);
      this.isInitialized = false;
    }
  }

  /**
   * 🗺️ Setup map event handlers for bounds changes
   */
  private setupMapEventHandlers(): void {
    if (!this.map) return;

    // ✅ Update bounds when map moves or zooms
    this.map.on('moveend zoomend', () => {
      this.updateCurrentBounds();
      // Optionally re-filter vessels based on new bounds
      this.filterVesselsByBounds();
    });

    console.log('✅ Map event handlers setup completed');
  }

  /**
   * 📍 Update current map bounds
   */
  private updateCurrentBounds(): void {
    if (!this.map) return;
    
    this.currentBounds = this.map.getBounds();
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    
    console.log('🗺️ Map bounds updated:', {
      center: [center.lat, center.lng],
      zoom: zoom,
      bounds: this.currentBounds
    });
  }

  /**
   * 📏 Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(value: number): number {
    return value * Math.PI / 180;
  }

  /**
   * 🔍 Filter vessels by bounds and radius
   */
  private filterVesselsByRadius(vessels: Vessel[]): Vessel[] {
    if (!this.map || !this.currentBounds) return vessels;

    const mapCenter = this.map.getCenter();
    const centerLat = mapCenter.lat;
    const centerLng = mapCenter.lng;

    // ✅ Filter by distance from map center
    const filteredVessels = vessels.filter(vessel => {
      const distance = this.calculateDistance(
        centerLat, centerLng, 
        vessel.latitude, vessel.longitude
      );
      return distance <= this.radiusKm;
    });

    // ✅ Sort by distance (closest first)
    filteredVessels.sort((a, b) => {
      const distA = this.calculateDistance(centerLat, centerLng, a.latitude, a.longitude);
      const distB = this.calculateDistance(centerLat, centerLng, b.latitude, b.longitude);
      return distA - distB;
    });

    // ✅ Limit number of markers for performance
    const limitedVessels = filteredVessels.slice(0, this.maxMarkersToShow);

    console.log(`🔍 Filtered vessels: ${vessels.length} → ${filteredVessels.length} → ${limitedVessels.length} (radius: ${this.radiusKm}km)`);
    
    return limitedVessels;
  }

  /**
   * 🔍 Filter existing markers by current bounds
   */
  private filterVesselsByBounds(): void {
    if (!this.currentBounds) return;

    let hiddenCount = 0;
    let visibleCount = 0;

    this.vesselMarkers.forEach((marker, mmsi) => {
      const markerLatLng = marker.getLatLng();
      const isInBounds = this.currentBounds.contains(markerLatLng);

      if (isInBounds) {
        if (!this.map.hasLayer(marker)) {
          this.map.addLayer(marker);
        }
        visibleCount++;
      } else {
        if (this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
        hiddenCount++;
      }
    });

    console.log(`🗺️ Bounds filtering: ${visibleCount} visible, ${hiddenCount} hidden`);
  }

  /**
   * 🔄 Update vessels - SIMPLIFIED WITH BOUNDS FILTERING
   */
  public async updateVessels(vessels: Vessel[]): Promise<void> {
    console.log('🚢 VesselMarkerManager.updateVessels called with:', vessels.length, 'vessels');
    
    if (!this.isBrowser) {
      console.log('⚠️ Skipping vessel update - not in browser environment');
      return;
    }

    if (!this.isInitialized && this.initializationPromise) {
      console.log('⏳ Waiting for initialization...');
      try {
        await this.initializationPromise;
      } catch (error) {
        console.error('❌ Initialization failed:', error);
        return;
      }
    }

    if (!this.isInitialized || !this.L) {
      console.log('⚠️ Skipping vessel update - not ready');
      return;
    }

    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottle) {
      console.log('⏱️ Throttling update, skipping...');
      return;
    }
    this.lastUpdateTime = now;

    // ✅ Filter vessels by radius first
    const filteredVessels = this.filterVesselsByRadius(vessels);
    
    console.log(`🗺️ Processing ${filteredVessels.length} filtered vessels`);

    this.zone.runOutsideAngular(() => {
      const markersToAdd: any[] = [];
      const existingMMSIs = new Set<number>();

      filteredVessels.forEach((vessel, index) => {
        if (!vessel.latitude || !vessel.longitude || !vessel.mmsi) {
          console.warn(`⚠️ Invalid vessel data at index ${index}:`, vessel);
          return;
        }

        existingMMSIs.add(vessel.mmsi);
        const existingMarker = this.vesselMarkers.get(vessel.mmsi);

        if (existingMarker) {
          this.updateMarkerPosition(existingMarker, vessel);
        } else {
          const marker = this.createVesselMarker(vessel);
          if (marker) {
            this.vesselMarkers.set(vessel.mmsi, marker);
            markersToAdd.push(marker);
          }
        }
      });

      // ✅ Remove old markers
      this.removeOldMarkers(existingMMSIs);

      // ✅ Add new markers directly to map
      if (markersToAdd.length > 0) {
        markersToAdd.forEach(marker => {
          marker.addTo(this.map);
        });
        console.log(`✅ Added ${markersToAdd.length} vessel markers to map`);
      }

      console.log(`📊 Total active markers: ${this.vesselMarkers.size}`);
    });
  }

  /**
   * 🏗️ Create vessel marker - SIMPLE MARKER
   */
  public createVesselMarker(vessel: Vessel): any {
    if (!this.L) return null;

    try {
      const marker = this.L.marker([vessel.latitude, vessel.longitude], {
        title: `${vessel.name || 'Unknown'} (${vessel.mmsi})`,
        riseOnHover: true
      });

      // ✅ Add vessel data
      marker.vesselData = vessel;
      marker.lastUpdated = vessel.timestamp;

      // ✅ Click handler
      marker.on('click', (e: any) => {
        this.L.DomEvent.stopPropagation(e);
        console.log(`🎯 Vessel ${vessel.mmsi} clicked`);
        // Optionally bind popup here
        this.showVesselPopup(marker, vessel);
      });

      return marker;
      
    } catch (error) {
      console.error('❌ Error creating vessel marker:', error);
      return null;
    }
  }

  /**
   * 💬 Show vessel popup
   */
  private showVesselPopup(marker: any, vessel: Vessel): void {
    const popupContent = `
      <div class="vessel-popup">
        <h3>${vessel.name || 'Unknown Vessel'}</h3>
        <p><strong>MMSI:</strong> ${vessel.mmsi}</p>
        <p><strong>Type:</strong> ${this.getVesselTypeName(vessel.vesselType)}</p>
        <p><strong>Speed:</strong> ${vessel.speed?.toFixed(1) || 0} knots</p>
        <p><strong>Course:</strong> ${vessel.course || 0}°</p>
        <p><strong>Position:</strong> ${vessel.latitude.toFixed(5)}, ${vessel.longitude.toFixed(5)}</p>
        <p><strong>Last Update:</strong> ${new Date(vessel.timestamp).toLocaleString()}</p>
      </div>
    `;
    
    marker.bindPopup(popupContent).openPopup();
  }

  private getVesselTypeName(type: number | undefined): string {
    if (!type) return 'Unknown';
    if (type >= 80 && type <= 89) return 'Tanker';
    if (type >= 70 && type <= 79) return 'Cargo';
    if (type >= 60 && type <= 69) return 'Passenger';
    if (type >= 40 && type <= 49) return 'High Speed';
    if (type >= 50 && type <= 59) return 'Special';
    if (type === 30) return 'Fishing';
    return `Type ${type}`;
  }

  /**
   * 🗑️ Remove old markers
   */
  private removeOldMarkers(currentMMSIs: Set<number>): void {
    const markersToRemove: number[] = [];
    
    this.vesselMarkers.forEach((marker, mmsi) => {
      if (!currentMMSIs.has(mmsi)) {
        if (this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
        markersToRemove.push(mmsi);
      }
    });
    
    markersToRemove.forEach(mmsi => {
      this.vesselMarkers.delete(mmsi);
    });

    if (markersToRemove.length > 0) {
      console.log(`🗑️ Removed ${markersToRemove.length} old vessel markers`);
    }
  }

  private updateMarkerPosition(marker: any, vessel: Vessel): void {
    if (!this.L) return;
    const newLatLng = this.L.latLng(vessel.latitude, vessel.longitude);
    marker.setLatLng(newLatLng);
    marker.vesselData = vessel;
    marker.lastUpdated = vessel.timestamp;
  }

  /**
   * 🎛️ Control methods
   */
  public setRadius(radiusKm: number): void {
    this.radiusKm = radiusKm;
    console.log(`📏 Radius set to ${radiusKm}km`);
  }

  public setMaxMarkers(max: number): void {
    this.maxMarkersToShow = max;
    console.log(`📊 Max markers set to ${max}`);
  }

  /**
   * 📊 Get stats
   */
  public getStats(): any {
    return {
      totalMarkers: this.vesselMarkers.size,
      maxMarkers: this.maxMarkersToShow,
      radiusKm: this.radiusKm,
      isInitialized: this.isInitialized,
      currentBounds: this.currentBounds ? {
        north: this.currentBounds.getNorth(),
        south: this.currentBounds.getSouth(),
        east: this.currentBounds.getEast(),
        west: this.currentBounds.getWest()
      } : null
    };
  }

  /**
   * 🧹 Cleanup
   */
  public cleanup(): void {
    if (!this.isBrowser) return;
    
    console.log('🗺️ VesselMarkerManager cleanup starting...');
    
    this.vesselMarkers.forEach(marker => {
      if (this.map && this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    
    this.vesselMarkers.clear();
    this.isInitialized = false;
    this.initializationPromise = null;
    
    console.log('🗺️ VesselMarkerManager cleanup completed');
  }

  /**
   * 🧪 Test methods
   */
  public testAddRandomMarkers(count: number = 10): void {
    if (!this.isInitialized || !this.L || !this.map) return;

    console.log(`🧪 Adding ${count} random test markers...`);

    const center = this.map.getCenter();
    
    for (let i = 0; i < count; i++) {
      // Random position within 0.1 degrees of center
      const lat = center.lat + (Math.random() - 0.5) * 0.2;
      const lng = center.lng + (Math.random() - 0.5) * 0.2;
      
      const testVessel: Vessel = {
        mmsi: 999000000 + i,
        latitude: lat,
        longitude: lng,
        speed: Math.random() * 20,
        course: Math.random() * 360,
        heading: Math.random() * 360,
        timestamp: new Date(),
        vesselType: 70,
        name: `Test Vessel ${i + 1}`,
        flag: 'TEST',
        callSign: `TEST${i}`,
        destination: 'TEST PORT',
        eta: "2023-12-31T00:00:00.000Z",
        length: 100,
        width: 20,
        navStatus: 0,
      };

      const marker = this.createVesselMarker(testVessel);
      if (marker) {
        marker.addTo(this.map);
        this.vesselMarkers.set(testVessel.mmsi, marker);
      }
    }

    console.log(`✅ Added ${count} test markers`);
  }
}
