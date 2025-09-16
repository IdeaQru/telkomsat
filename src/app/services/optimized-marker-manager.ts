import { NgZone } from "@angular/core";
import { Vessel } from "./telkomsat-api-service";
import Supercluster, { PointFeature, ClusterFeature } from 'supercluster';
import { VesselPopupService } from "./vessel-pop-up.service";
import { Subject } from 'rxjs';

// ✅ EXPORT semua interface yang diperlukan
export interface LoadingState {
  isLoading: boolean;
  message: string;
  progress: number;
  hasData: boolean;
  lastUpdate: Date | null;
  error: string | null;
}

export interface VesselCluster {
  id: string;
  center: { lat: number; lng: number };
  vessels: Vessel[];
  marker?: any;
  radius: number;
}

export interface ViewportSettings {
  updateThrottle: number;
  maxVisibleMarkers: number;
  maxClusters: number;
  clusterRadius: number;
  viewportPadding: number;
}

// ✅ ENHANCED OptimizedMarkerManager with Loading State Communication
export class OptimizedMarkerManager {
  private clusterIndex: Supercluster<Vessel, any>;
  private visibleMarkers: Map<number, any> = new Map();
  private hiddenMarkers: Map<number, any> = new Map();
  private clusterMarkers: Map<string, any> = new Map();
  private lastViewport: any = null;
  private updateTimer: any = null;
  private vesselsCache: Vessel[] = [];
  private geoJSONPoints: Array<PointFeature<Vessel>> = [];
  private popupService: VesselPopupService | null = null;

  // ✅ NEW: Loading state communication
  private loadingStateSubject = new Subject<LoadingState>();
  public loadingState$ = this.loadingStateSubject.asObservable();
  private isFirstLoad = true;

  public setPopupService(service: VesselPopupService): void {
    this.popupService = service;
    console.log('✅ Popup service connected to OptimizedMarkerManager');
  }

  // ✅ PERFORMANCE SETTINGS
  private settings: ViewportSettings = {
    updateThrottle: 50,
    maxVisibleMarkers: 1500,
    maxClusters: 300,
    clusterRadius: 45,
    viewportPadding: 0.2
  };

  constructor(
    private map: any,
    private L: any,
    private vesselLayer: any,
    private clusterLayer: any,
    private parentService: any,
    private zone: NgZone
  ) {
    // ✅ Initialize Supercluster dengan konfigurasi optimal
    this.clusterIndex = new Supercluster({
      radius: this.settings.clusterRadius,
      maxZoom: 16,
      minZoom: 0,
      minPoints: 2,
    });

    this.setupMapEvents();
    console.log('🚀 OptimizedMarkerManager initialized with Supercluster + Canvas rendering');
  }

  // ✅ NEW: Method untuk parent service subscribe ke loading state
  public subscribeToLoadingState(): Subject<LoadingState> {
    return this.loadingStateSubject;
  }

  // ✅ TYPE GUARD untuk cluster detection
  private isClusterFeature(feature: any): boolean {
    return feature.properties && feature.properties.cluster === true;
  }

  // ✅ SETUP MAP EVENTS
  private setupMapEvents(): void {
    let moveTimer: any = null;
    let zoomTimer: any = null;

    this.map.on('movestart', () => {
      if (moveTimer) clearTimeout(moveTimer);
    });

    this.map.on('moveend', () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        this.throttledUpdate();
      }, this.settings.updateThrottle);
    });

    this.map.on('zoomstart', () => {
      if (zoomTimer) clearTimeout(zoomTimer);
    });

    this.map.on('zoomend', () => {
      if (zoomTimer) clearTimeout(zoomTimer);
      zoomTimer = setTimeout(() => {
        this.throttledUpdate();
      }, this.settings.updateThrottle);
    });
  }

  // ✅ THROTTLED UPDATE
  private throttledUpdate(): void {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.updateViewportMarkers();
      });
    }, 30);
  }

  // ✅ ENHANCED MAIN UPDATE METHOD - dengan Loading State Management
  public updateVessels(vessels: Vessel[]): void {
    if (!vessels || vessels.length === 0) {
      this.vesselsCache = [];
      this.vesselLayer.clearLayers();
      this.clusterLayer.clearLayers();
      
      // ✅ EMIT no data state
      this.emitLoadingState({
        isLoading: false,
        message: 'No vessel data available',
        progress: 100,
        hasData: false,
        lastUpdate: new Date(),
        error: null
      });
      return;
    }

    this.zone.runOutsideAngular(() => {
      console.log(`🚀 OptimizedMarkerManager processing ${vessels.length} vessels...`);
      
      this.vesselsCache = vessels;

      // Convert to GeoJSON format untuk Supercluster
      this.geoJSONPoints = vessels.map((vessel): PointFeature<Vessel> => ({
        type: 'Feature',
        properties: vessel,
        geometry: {
          type: 'Point',
          coordinates: [vessel.longitude, vessel.latitude]
        }
      }));

      // Load into Supercluster (sangat cepat)
      console.time('SuperclusterIndexing');
      this.clusterIndex.load(this.geoJSONPoints);
      console.timeEnd('SuperclusterIndexing');

      // ✅ CRITICAL: Update loading state setelah berhasil process vessels
      this.zone.run(() => {
        if (this.isFirstLoad) {
          console.log('🎯 OPTIMIZED MANAGER: First data load complete - HIDING LOADING');
          this.isFirstLoad = false;
        }
        
        this.emitLoadingState({
          isLoading: false,           // ✅ HIDE LOADING
          message: `${vessels.length} vessels loaded and optimized`,
          progress: 100,
          hasData: true,              // ✅ HAS DATA
          lastUpdate: new Date(),
          error: null
        });

        // ✅ Force emit multiple times untuk memastikan change detection
        setTimeout(() => {
          this.emitLoadingState({
            isLoading: false,
            message: `${vessels.length} vessels active on map`,
            progress: 100,
            hasData: true,
            lastUpdate: new Date(),
            error: null
          });
        }, 100);
      });

      this.updateViewportMarkers();
    });
  }

  // ✅ NEW: Emit loading state dengan logging
  private emitLoadingState(state: LoadingState): void {
    console.log('📡 OptimizedMarkerManager emitting loading state:', state);
    this.loadingStateSubject.next(state);
  }

  // ✅ SMART VIEWPORT MARKER UPDATE dengan Supercluster
  private updateViewportMarkers(): void {
    if (this.geoJSONPoints.length === 0) return;

    const currentBounds = this.map.getBounds();
    const currentZoom = this.map.getZoom();

    // ✅ SKIP UPDATE jika viewport tidak berubah signifikan
    if (this.isViewportSimilar(currentBounds, currentZoom)) {
      return;
    }

    this.lastViewport = { bounds: currentBounds, zoom: currentZoom };

    // Definisikan bbox untuk Supercluster
    const bbox: [number, number, number, number] = [
      currentBounds.getWest(),
      currentBounds.getSouth(),
      currentBounds.getEast(),
      currentBounds.getNorth()
    ];

    console.time('SuperclusterQuery');
    // Dapatkan clusters dan points dari Supercluster (sangat cepat!)
    const clustersAndPoints = this.clusterIndex.getClusters(bbox, Math.floor(currentZoom));
    console.timeEnd('SuperclusterQuery');

    // Clear layers sebelum render ulang
    this.vesselLayer.clearLayers();
    this.clusterLayer.clearLayers();

    console.time('RenderingMarkers');
    // Render setiap feature dengan tetap mempertahankan style lama
    for (const feature of clustersAndPoints) {
      const [longitude, latitude] = feature.geometry.coordinates;

      if (this.isClusterFeature(feature)) {
        // Render cluster menggunakan metode lama tapi dengan data dari Supercluster
        const clusterData: VesselCluster = {
          id: feature.properties.cluster_id?.toString() || 'cluster',
          center: { lat: latitude, lng: longitude },
          vessels: [], // Bisa diisi jika diperlukan
          radius: this.settings.clusterRadius
        };

        const clusterMarker = this.createEnhancedClusterMarker(clusterData, feature.properties.point_count);
        if (clusterMarker) {
          this.clusterLayer.addLayer(clusterMarker);
          this.clusterMarkers.set(clusterData.id, clusterMarker);
        }
      } else {
        // Render individual vessel dengan metode lama
        const vessel = feature.properties as Vessel;
        const marker = this.getOrCreateMarker(vessel);
        if (marker) {
          this.vesselLayer.addLayer(marker);
          this.visibleMarkers.set(vessel.mmsi, marker);
        }
      }
    }
    console.timeEnd('RenderingMarkers');

    console.log(`🗺️ Rendered ${clustersAndPoints.length} features (zoom: ${currentZoom})`);
    
    // ✅ Emit state update setelah rendering selesai
    if (clustersAndPoints.length > 0) {
      this.emitLoadingState({
        isLoading: false,
        message: `Map updated: ${clustersAndPoints.length} items visible`,
        progress: 100,
        hasData: true,
        lastUpdate: new Date(),
        error: null
      });
    }
  }

  // ✅ CHECK VIEWPORT SIMILARITY
  private isViewportSimilar(bounds: any, zoom: number): boolean {
    if (!this.lastViewport) return false;

    const zoomDiff = Math.abs(zoom - this.lastViewport.zoom);
    if (zoomDiff >= 1) return false;

    const currentCenter = bounds.getCenter();
    const lastCenter = this.lastViewport.bounds.getCenter();
    const distance = currentCenter.distanceTo(lastCenter) * 1000; // meters

    return distance < 800; // 800m threshold untuk response yang lebih cepat
  }

  // ✅ GET OR CREATE MARKER dengan reuse (metode lama dipertahankan)
  private getOrCreateMarker(vessel: Vessel): any {
    let marker = this.hiddenMarkers.get(vessel.mmsi);

    if (marker) {
      // ✅ REUSE existing marker
      marker.setLatLng([vessel.latitude, vessel.longitude]);
      this.updateMarkerRotation(marker, vessel);
      marker.vesselData = vessel;
      this.hiddenMarkers.delete(vessel.mmsi);
    } else {
      // ✅ CREATE new marker using parentService method (mempertahankan style lama)
      marker = this.parentService.createVesselMarker(vessel);
      if (!marker) return null;
    }

    return marker;
  }

  // ✅ CREATE ENHANCED CLUSTER MARKER (dimodifikasi untuk Supercluster)
  private createEnhancedClusterMarker(cluster: VesselCluster, vesselCount: number): any {
    let clusterClass = 'cluster-small';
    let clusterSize = 40;

    if (vesselCount >= 1000) {
      clusterClass = 'cluster-mega';
      clusterSize = 80;
    } else if (vesselCount >= 500) {
      clusterClass = 'cluster-extra-large';
      clusterSize = 70;
    } else if (vesselCount >= 100) {
      clusterClass = 'cluster-large';
      clusterSize = 60;
    } else if (vesselCount >= 50) {
      clusterClass = 'cluster-medium';
      clusterSize = 50;
    } else if (vesselCount >= 10) {
      clusterClass = 'cluster-medium';
      clusterSize = 45;
    }

    const clusterHtml = `
      <div class="vessel-cluster ${clusterClass}">
        <div class="cluster-inner">
          <span class="cluster-count">${this.formatCount(vesselCount)}</span>
          <div class="cluster-icon">⚓</div>
        </div>
      </div>
    `;

    const clusterIcon = this.L.divIcon({
      html: clusterHtml,
      className: 'custom-cluster-marker optimized',
      iconSize: [clusterSize, clusterSize],
      iconAnchor: [clusterSize / 2, clusterSize / 2],
      popupAnchor: [0, -10]
    });

    const marker = this.L.marker([cluster.center.lat, cluster.center.lng], {
      icon: clusterIcon,
      title: `${vesselCount} vessels`
    });

    // ✅ Cluster click event dengan Supercluster expansion
    marker.on('click', (e: any) => {
      this.L.DomEvent.stopPropagation(e);

      // Gunakan Supercluster expansion zoom
      const clusterId = cluster.id;
      try {
        const expansionZoom = this.clusterIndex.getClusterExpansionZoom(parseInt(clusterId));
        this.map.setView([cluster.center.lat, cluster.center.lng], Math.min(expansionZoom, 16));
      } catch (error) {
        // Fallback ke metode lama jika ada error
        const currentZoom = this.map.getZoom();
        this.map.setView([cluster.center.lat, cluster.center.lng], Math.min(currentZoom + 3, 13));
      }
    });

    // Bind popup sederhana untuk cluster
    this.bindSimpleClusterPopup(marker, vesselCount);

    return marker;
  }

  // ✅ Simple cluster popup
  private bindSimpleClusterPopup(marker: any, vesselCount: number): void {
    const popupContent = `
      <div class="cluster-popup optimized telkomsat-cluster">
        <div class="popup-header">
          <strong>${vesselCount} Vessels</strong>
          <div class="source-badge">🛰️ Telkomsat Network</div>
        </div>
        <div class="popup-content">
          <p>Click to zoom in and see individual vessels</p>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 250,
      className: 'optimized-cluster-popup-telkomsat'
    });
  }

  // ✅ UPDATE MARKER ROTATION (metode lama dipertahankan)
  private updateMarkerRotation(marker: any, vessel: Vessel): void {
    const rotation = vessel.heading ?? vessel.course ?? 0;
    if (marker._icon) {
      const vesselIcon = marker._icon.querySelector('.vessel-icon');
      if (vesselIcon) {
        vesselIcon.style.transform = `rotate(${rotation}deg)`;
      }
    }
  }

  // ✅ HELPER METHODS
  private formatCount(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }

  // ✅ PUBLIC METHODS
  public setSettings(newSettings: Partial<ViewportSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    // Update Supercluster configuration jika ada perubahan radius
    if (newSettings.clusterRadius) {
      this.clusterIndex = new Supercluster({
        radius: newSettings.clusterRadius,
        maxZoom: 16,
        minZoom: 0,
        minPoints: 2,
      });

      // Reload data jika ada
      if (this.geoJSONPoints.length > 0) {
        this.clusterIndex.load(this.geoJSONPoints);
        this.updateViewportMarkers();
      }
    }

    console.log('🎯 Supercluster settings updated:', this.settings);
  }

  public getStats(): any {
    return {
      visibleMarkers: this.visibleMarkers.size,
      hiddenMarkers: this.hiddenMarkers.size,
      clusterMarkers: this.clusterMarkers.size,
      totalVessels: this.vesselsCache.length,
      geoJSONPoints: this.geoJSONPoints.length,
      settings: this.settings,
      superclusterLoaded: this.geoJSONPoints.length > 0,
      currentZoom: this.map?.getZoom()
    };
  }

  // ✅ NEW: Force hide loading method untuk emergency
  public forceHideLoading(): void {
    console.log('🚨 OptimizedMarkerManager: Force hiding loading');
    this.emitLoadingState({
      isLoading: false,
      message: `${this.vesselsCache.length} vessels ready`,
      progress: 100,
      hasData: true,
      lastUpdate: new Date(),
      error: null
    });
  }

  public cleanup(): void {
    if (this.updateTimer) clearTimeout(this.updateTimer);

    // ✅ CLEANUP MAP EVENTS
    this.map?.off('movestart');
    this.map?.off('moveend');
    this.map?.off('zoomstart');
    this.map?.off('zoomend');

    this.vesselLayer.clearLayers();
    this.clusterLayer.clearLayers();
    this.visibleMarkers.clear();
    this.hiddenMarkers.clear();
    this.clusterMarkers.clear();
    this.vesselsCache = [];
    this.geoJSONPoints = [];

    // ✅ Complete subject
    this.loadingStateSubject.complete();

    console.log('🧹 OptimizedMarkerManager with Supercluster cleaned up');
  }
}


