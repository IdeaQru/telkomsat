// src/services/optimized-marker-manager.ts - MEMORY OPTIMIZED VERSION
import { NgZone } from "@angular/core";
import { Vessel } from "./vessel-websocket.service";
import Supercluster, { PointFeature, ClusterFeature } from 'supercluster';
import { VesselPopupService } from "./vessel-pop-up.service";
import { Subject } from 'rxjs';

// ✅ Interfaces remain the same
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
  disableClusteringAtZoom: number;
}

// ✅ MEMORY OPTIMIZED OptimizedMarkerManager
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

  // ✅ MEMORY MONITORING
  private memoryStats = {
    markersCreated: 0,
    markersDestroyed: 0,
    peakVisibleMarkers: 0,
    peakHiddenMarkers: 0,
    peakCacheSize: 0,
    lastCleanupTime: Date.now(),
    memoryCleanups: 0
  };

  // ✅ MEMORY LIMITS
  private readonly MAX_VISIBLE_MARKERS = 500;        // Reduced from 1500
  private readonly MAX_HIDDEN_MARKERS = 300;         // Limit hidden marker pool
  private readonly MAX_CACHE_SIZE = 2000;            // Limit vessel cache
  private readonly MAX_GEOJSON_POINTS = 2000;        // Limit GeoJSON cache
  private readonly MEMORY_CLEANUP_INTERVAL = 45000;  // 45 seconds
  private readonly VIEWPORT_SIMILARITY_THRESHOLD = 300; // 300m instead of 2km

  // ✅ MEMORY MANAGEMENT TIMERS
  private memoryCleanupTimer: any = null;
  private performanceMonitorTimer: any = null;

  // ✅ Loading state
  private loadingStateSubject = new Subject<LoadingState>();
  public loadingState$ = this.loadingStateSubject.asObservable();
  private isFirstLoad = true;

  // ✅ Clustering state
  private isClusteringEnabled = true;
  private lastClusteringState = true;

  public setPopupService(service: VesselPopupService): void {
    this.popupService = service;
    console.log('✅ Popup service connected to Memory-Optimized MarkerManager');
  }

  // ✅ MEMORY OPTIMIZED SETTINGS
  private settings: ViewportSettings = {
    updateThrottle: 200,              // ✅ SLOWER: Reduce update frequency
    maxVisibleMarkers: 500,           // ✅ REDUCED: Lower memory usage
    maxClusters: 30,                  // ✅ REDUCED: Fewer cluster objects
    clusterRadius: 120,               // ✅ SMALLER: More aggressive clustering
    viewportPadding: 0.08,            // ✅ MINIMAL: Less padding for accuracy
    disableClusteringAtZoom: 14       // ✅ LOWER: Force more clustering
  };

  constructor(
    private map: any,
    private L: any,
    private vesselLayer: any,
    private clusterLayer: any,
    private parentService: any,
    private zone: NgZone
  ) {
    // ✅ MEMORY OPTIMIZED Supercluster
    this.clusterIndex = new Supercluster({
      radius: this.settings.clusterRadius,
      maxZoom: this.settings.disableClusteringAtZoom - 1,
      minZoom: 0,
      minPoints: 3,                   // ✅ HIGHER: More aggressive clustering
      extent: 256,                    // ✅ SMALLER: Less memory per tile
      nodeSize: 32,                   // ✅ SMALLER: Less memory per node
      log: false
    });

    this.setupMapEvents();
    this.startMemoryManagement();
    
    console.log(`🧠 Memory-Optimized MarkerManager initialized`);
    console.log(`📊 Memory limits: ${this.MAX_VISIBLE_MARKERS} visible, ${this.MAX_HIDDEN_MARKERS} hidden, ${this.MAX_CACHE_SIZE} cache`);
  }

  // ✅ NEW: Start comprehensive memory management
  private startMemoryManagement(): void {
    // Regular memory cleanup
    this.memoryCleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, this.MEMORY_CLEANUP_INTERVAL);

    // Performance monitoring
    this.performanceMonitorTimer = setInterval(() => {
      this.monitorPerformance();
    }, 30000); // Every 30 seconds

    console.log('🧠 Memory management system started for OptimizedMarkerManager');
  }

  // ✅ NEW: Comprehensive memory cleanup
  private performMemoryCleanup(): void {
    console.log('🧹 Starting OptimizedMarkerManager memory cleanup...');
    const startTime = Date.now();
    
    let cleanedCount = 0;

    // ✅ 1. Cleanup excess hidden markers (LRU strategy)
    if (this.hiddenMarkers.size > this.MAX_HIDDEN_MARKERS) {
      const excess = this.hiddenMarkers.size - this.MAX_HIDDEN_MARKERS;
      const hiddenArray = Array.from(this.hiddenMarkers.entries());
      
      // Sort by last used (if we track it) or just remove oldest
      for (let i = 0; i < excess; i++) {
        const [mmsi, marker] = hiddenArray[i];
        this.destroyMarkerCompletely(marker);
        this.hiddenMarkers.delete(mmsi);
        cleanedCount++;
      }
      console.log(`🧹 Cleaned ${excess} excess hidden markers`);
    }

    // ✅ 2. Cleanup excess vessel cache
    if (this.vesselsCache.length > this.MAX_CACHE_SIZE) {
      const excess = this.vesselsCache.length - this.MAX_CACHE_SIZE;
      
      // Sort by timestamp and keep newest
      this.vesselsCache.sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return bTime - aTime;
      });
      
      this.vesselsCache = this.vesselsCache.slice(0, this.MAX_CACHE_SIZE);
      console.log(`🧹 Cleaned ${excess} old vessels from cache`);
    }

    // ✅ 3. Cleanup excess GeoJSON points
    if (this.geoJSONPoints.length > this.MAX_GEOJSON_POINTS) {
      const excess = this.geoJSONPoints.length - this.MAX_GEOJSON_POINTS;
      this.geoJSONPoints = this.geoJSONPoints.slice(0, this.MAX_GEOJSON_POINTS);
      console.log(`🧹 Cleaned ${excess} excess GeoJSON points`);
    }

    // ✅ 4. Update memory stats
    this.memoryStats.lastCleanupTime = Date.now();
    this.memoryStats.memoryCleanups++;

    const cleanupTime = Date.now() - startTime;
    console.log(`🧹 Memory cleanup completed in ${cleanupTime}ms (cleaned: ${cleanedCount} items)`);
  }

  // ✅ NEW: Performance monitoring
  private monitorPerformance(): void {
    // Update peak usage stats
    this.memoryStats.peakVisibleMarkers = Math.max(this.memoryStats.peakVisibleMarkers, this.visibleMarkers.size);
    this.memoryStats.peakHiddenMarkers = Math.max(this.memoryStats.peakHiddenMarkers, this.hiddenMarkers.size);
    this.memoryStats.peakCacheSize = Math.max(this.memoryStats.peakCacheSize, this.vesselsCache.length);

    // Log performance stats
    console.log(`📊 OptimizedMarkerManager Performance:`, {
      visible: this.visibleMarkers.size,
      hidden: this.hiddenMarkers.size,
      clusters: this.clusterMarkers.size,
      cache: this.vesselsCache.length,
      geoJSON: this.geoJSONPoints.length,
      created: this.memoryStats.markersCreated,
      destroyed: this.memoryStats.markersDestroyed,
      cleanups: this.memoryStats.memoryCleanups
    });

    // Check for memory pressure
    if (this.isUnderMemoryPressure()) {
      console.warn('⚠️ Memory pressure detected in OptimizedMarkerManager');
      this.performEmergencyCleanup();
    }
  }

  // ✅ NEW: Check for memory pressure
  private isUnderMemoryPressure(): boolean {
    return (
      this.visibleMarkers.size > this.MAX_VISIBLE_MARKERS * 0.9 ||
      this.hiddenMarkers.size > this.MAX_HIDDEN_MARKERS * 0.9 ||
      this.vesselsCache.length > this.MAX_CACHE_SIZE * 0.9
    );
  }

  // ✅ NEW: Emergency cleanup for high memory pressure
  public performEmergencyCleanup(): void {
    console.warn('🚨 EMERGENCY CLEANUP - OptimizedMarkerManager');
    
    // ✅ Aggressive cleanup: Remove 50% of hidden markers
    const hiddenToRemove = Math.floor(this.hiddenMarkers.size * 0.5);
    const hiddenEntries = Array.from(this.hiddenMarkers.entries());
    
    for (let i = 0; i < hiddenToRemove; i++) {
      const [mmsi, marker] = hiddenEntries[i];
      this.destroyMarkerCompletely(marker);
      this.hiddenMarkers.delete(mmsi);
    }

    // ✅ Reduce cache to 50%
    const targetCacheSize = Math.floor(this.MAX_CACHE_SIZE * 0.5);
    if (this.vesselsCache.length > targetCacheSize) {
      this.vesselsCache = this.vesselsCache.slice(0, targetCacheSize);
      this.geoJSONPoints = this.geoJSONPoints.slice(0, targetCacheSize);
      
      // Rebuild cluster index with reduced data
      this.clusterIndex.load(this.geoJSONPoints);
    }

    // ✅ Force viewport update
    this.forceUpdateViewport();

    console.warn('🚨 Emergency cleanup completed');
  }

  // ✅ NEW: Completely destroy marker and free all memory
  private destroyMarkerCompletely(marker: any): void {
    if (!marker) return;

    // ✅ Remove from layers
    if (this.vesselLayer.hasLayer(marker)) {
      this.vesselLayer.removeLayer(marker);
    }
    if (this.clusterLayer.hasLayer(marker)) {
      this.clusterLayer.removeLayer(marker);
    }

    // ✅ Remove all event listeners
    marker.off();

    // ✅ Clear DOM elements completely
    if (marker._icon) {
      if (marker._icon.parentNode) {
        marker._icon.parentNode.removeChild(marker._icon);
      }
      marker._icon.innerHTML = ''; // Clear inner HTML
      marker._icon = null;
    }

    if (marker._shadow) {
      if (marker._shadow.parentNode) {
        marker._shadow.parentNode.removeChild(marker._shadow);
      }
      marker._shadow = null;
    }

    // ✅ Clear popup
    if (marker._popup) {
      marker.closePopup();
      marker.unbindPopup();
      marker._popup = null;
    }

    // ✅ Clear all data references
    marker.vesselData = null;
    marker.lastUpdated = null;

    // ✅ Clear marker properties
    Object.keys(marker).forEach(key => {
      if (key.startsWith('_')) {
        marker[key] = null;
      }
    });

    this.memoryStats.markersDestroyed++;
  }

  public subscribeToLoadingState(): Subject<LoadingState> {
    return this.loadingStateSubject;
  }

  private isClusterFeature(feature: any): boolean {
    return feature.properties && feature.properties.cluster === true;
  }

  // ✅ MEMORY OPTIMIZED: Map events with reduced frequency
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
      }, this.settings.updateThrottle); // Uses memory optimized throttle
    });

    this.map.on('zoomstart', () => {
      if (zoomTimer) clearTimeout(zoomTimer);
    });

    this.map.on('zoomend', () => {
      if (zoomTimer) clearTimeout(zoomTimer);
      
      const currentZoom = this.map.getZoom();
      const shouldCluster = currentZoom < this.settings.disableClusteringAtZoom;
      
      if (shouldCluster !== this.isClusteringEnabled) {
        console.log(`🔄 Zoom ${currentZoom}: Memory-optimized clustering ${shouldCluster ? 'ENABLED' : 'DISABLED'}`);
        this.isClusteringEnabled = shouldCluster;
        this.forceUpdateViewport();
      } else {
        this.forceUpdateViewport(); // Always update on zoom
      }
    });
  }

  private forceUpdateViewport(): void {
    this.lastViewport = null;
    this.zone.runOutsideAngular(() => {
      this.updateViewportMarkers();
    });
  }

  private throttledUpdate(): void {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.updateViewportMarkers();
      });
    }, 100);
  }

  // ✅ MEMORY OPTIMIZED: Update vessels with strict limits
  public updateVessels(vessels: Vessel[]): void {
    if (!vessels || vessels.length === 0) {
      this.clearAllDataSafely();
      return;
    }

    this.zone.runOutsideAngular(() => {
      // ✅ MEMORY CONTROL: Strict input limiting
      let processVessels = vessels;
      if (vessels.length > this.MAX_CACHE_SIZE) {
        console.warn(`⚠️ Input vessels limited: ${vessels.length} → ${this.MAX_CACHE_SIZE}`);
        
        // Sort by timestamp and keep newest
        processVessels = vessels
          .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
          .slice(0, this.MAX_CACHE_SIZE);
      }

      const currentZoom = this.map.getZoom();
      this.isClusteringEnabled = currentZoom < this.settings.disableClusteringAtZoom;
      
      console.log(`🧠 Processing ${processVessels.length} vessels (memory optimized, clustering: ${this.isClusteringEnabled ? 'ON' : 'OFF'})`);
      
      // ✅ MEMORY SAFE: Clear old data completely before adding new
      this.clearOldDataBeforeUpdate();
      
      // ✅ MEMORY SAFE: Add new data
      this.vesselsCache = [...processVessels]; // Create new array reference
      
      // ✅ MEMORY SAFE: Create new GeoJSON array
      this.geoJSONPoints = processVessels.map((vessel): PointFeature<Vessel> => ({
        type: 'Feature',
        properties: { ...vessel }, // Create new object reference
        geometry: {
          type: 'Point',
          coordinates: [vessel.longitude, vessel.latitude]
        }
      }));

      // ✅ Load into Supercluster
      console.time('MemoryOptimizedIndexing');
      this.clusterIndex.load(this.geoJSONPoints);
      console.timeEnd('MemoryOptimizedIndexing');

      // ✅ Update loading state
      this.zone.run(() => {
        if (this.isFirstLoad) {
          console.log('🎯 First memory-optimized load complete');
          this.isFirstLoad = false;
        }
        
        this.emitLoadingState({
          isLoading: false,
          message: `${processVessels.length} vessels loaded (memory optimized)`,
          progress: 100,
          hasData: true,
          lastUpdate: new Date(),
          error: null
        });
      });

      this.updateViewportMarkers();
    });
  }

  // ✅ NEW: Clear old data before update to prevent accumulation
  private clearOldDataBeforeUpdate(): void {
    // Clear old vessel cache references
    this.vesselsCache.length = 0;
    
    // Clear old GeoJSON references
    this.geoJSONPoints.length = 0;
    
    // Trigger garbage collection hint
    if (this.vesselsCache.length === 0 && this.geoJSONPoints.length === 0) {
      // Data cleared successfully
    }
  }

  // ✅ NEW: Safe data clearing
  private clearAllDataSafely(): void {
    // Clear all collections
    this.vesselsCache.length = 0;
    this.geoJSONPoints.length = 0;
    
    // Destroy and clear all markers
    this.visibleMarkers.forEach(marker => this.destroyMarkerCompletely(marker));
    this.visibleMarkers.clear();
    
    this.hiddenMarkers.forEach(marker => this.destroyMarkerCompletely(marker));
    this.hiddenMarkers.clear();
    
    this.clusterMarkers.forEach(marker => this.destroyMarkerCompletely(marker));
    this.clusterMarkers.clear();
    
    // Clear map layers
    this.vesselLayer.clearLayers();
    this.clusterLayer.clearLayers();
    
    this.emitLoadingState({
      isLoading: false,
      message: 'No vessel data available',
      progress: 100,
      hasData: false,
      lastUpdate: new Date(),
      error: null
    });

    console.log('🧹 All data cleared safely');
  }

  private emitLoadingState(state: LoadingState): void {
    this.loadingStateSubject.next(state);
  }

  // ✅ MEMORY OPTIMIZED: Viewport marker update with strict controls
  private updateViewportMarkers(): void {
    if (this.geoJSONPoints.length === 0) return;

    const currentBounds = this.map.getBounds();
    const currentZoom = this.map.getZoom();
    this.isClusteringEnabled = currentZoom < this.settings.disableClusteringAtZoom;

    // ✅ MEMORY OPTIMIZED: More sensitive viewport similarity check
    if (this.isViewportSimilar(currentBounds, currentZoom) && this.isClusteringEnabled === this.lastClusteringState) {
      return;
    }

    this.lastViewport = { bounds: currentBounds, zoom: currentZoom };
    this.lastClusteringState = this.isClusteringEnabled;

    // ✅ MEMORY CHECK: Cleanup before processing if needed
    if (this.isUnderMemoryPressure()) {
      this.performMemoryCleanup();
    }

    if (this.isClusteringEnabled) {
      this.renderMemoryOptimizedClusteredView(currentBounds, currentZoom);
    } else {
      this.renderMemoryOptimizedIndividualView(currentBounds, currentZoom);
    }
  }

  // ✅ MEMORY OPTIMIZED: Clustered view with strict limits
  private renderMemoryOptimizedClusteredView(currentBounds: any, currentZoom: number): void {
    const padding = this.settings.viewportPadding;
    const latPadding = (currentBounds.getNorth() - currentBounds.getSouth()) * padding;
    const lngPadding = (currentBounds.getEast() - currentBounds.getWest()) * padding;

    const bbox: [number, number, number, number] = [
      currentBounds.getWest() - lngPadding,
      currentBounds.getSouth() - latPadding,
      currentBounds.getEast() + lngPadding,
      currentBounds.getNorth() + latPadding
    ];

    console.time('MemoryOptimizedClusteredRendering');
    
    const clusteringZoom = Math.floor(currentZoom);
    const clustersAndPoints = this.clusterIndex.getClusters(bbox, clusteringZoom);
    
    console.log(`🔍 Memory-optimized clustering at zoom ${clusteringZoom} (actual: ${currentZoom})`);
    
    this.updateMarkersMemoryOptimized(clustersAndPoints);
    
    console.timeEnd('MemoryOptimizedClusteredRendering');
  }

  // ✅ MEMORY OPTIMIZED: Individual view with strict limits
  private renderMemoryOptimizedIndividualView(currentBounds: any, currentZoom: number): void {
    console.time('MemoryOptimizedIndividualRendering');
    
    console.log(`🚫 INDIVIDUAL VIEW: Memory-optimized (zoom ${currentZoom})`);
    
    // ✅ Clear clusters efficiently
    this.clearClustersMemoryOptimized();
    
    const visibleVessels = this.vesselsCache.filter(vessel => {
      const latLng = this.L.latLng(vessel.latitude, vessel.longitude);
      return currentBounds.contains(latLng);
    });

    // ✅ STRICT LIMIT: Use memory-optimized max visible markers
    const limitedVessels = visibleVessels.slice(0, this.MAX_VISIBLE_MARKERS);
    if (visibleVessels.length > this.MAX_VISIBLE_MARKERS) {
      console.warn(`⚠️ Visible vessels limited: ${visibleVessels.length} → ${this.MAX_VISIBLE_MARKERS}`);
    }

    let markersRendered = 0;
    const currentMMSIs = new Set<number>();

    limitedVessels.forEach(vessel => {
      currentMMSIs.add(vessel.mmsi);
      const marker = this.getOrCreateMarkerMemoryOptimized(vessel);
      if (marker) {
        if (!this.vesselLayer.hasLayer(marker)) {
          this.vesselLayer.addLayer(marker);
        }
        this.visibleMarkers.set(vessel.mmsi, marker);
        markersRendered++;
      }
    });

    this.hideUnusedMarkersMemoryOptimized(currentMMSIs);
    
    console.timeEnd('MemoryOptimizedIndividualRendering');
    console.log(`🗺️ MEMORY-OPTIMIZED INDIVIDUAL VIEW: ${markersRendered} markers visible`);

    this.emitLoadingState({
      isLoading: false,
      message: `Individual view: ${markersRendered} vessels (memory optimized)`,
      progress: 100,
      hasData: true,
      lastUpdate: new Date(),
      error: null
    });
  }

  // ✅ MEMORY OPTIMIZED: Selective marker updates
  private updateMarkersMemoryOptimized(clustersAndPoints: any[]): void {
    const currentClusters = new Set<string>();
    const currentVessels = new Set<number>();
    
    let clustersRendered = 0;
    let markersRendered = 0;

    for (const feature of clustersAndPoints) {
      const [longitude, latitude] = feature.geometry.coordinates;

      if (this.isClusterFeature(feature)) {
        const vesselCount = feature.properties.point_count;
        const clusterId = feature.properties.cluster_id?.toString() || 'cluster';
        
        currentClusters.add(clusterId);
        
        // ✅ MEMORY CHECK: Don't create too many clusters
        if (clustersRendered >= this.settings.maxClusters) {
          continue;
        }
        
        let clusterMarker = this.clusterMarkers.get(clusterId);
        if (!clusterMarker) {
          const clusterData: VesselCluster = {
            id: clusterId,
            center: { lat: latitude, lng: longitude },
            vessels: [],
            radius: this.settings.clusterRadius
          };

          clusterMarker = this.createMemoryOptimizedClusterMarker(clusterData, vesselCount);
          if (clusterMarker) {
            this.clusterLayer.addLayer(clusterMarker);
            this.clusterMarkers.set(clusterId, clusterMarker);
            this.memoryStats.markersCreated++;
          }
        } else {
          clusterMarker.setLatLng([latitude, longitude]);
        }
        
        clustersRendered++;
      } else {
        // ✅ MEMORY CHECK: Don't create too many individual markers
        if (markersRendered >= this.MAX_VISIBLE_MARKERS) {
          continue;
        }

        const vessel = feature.properties as Vessel;
        currentVessels.add(vessel.mmsi);
        
        const marker = this.getOrCreateMarkerMemoryOptimized(vessel);
        if (marker) {
          if (!this.vesselLayer.hasLayer(marker)) {
            this.vesselLayer.addLayer(marker);
          }
          this.visibleMarkers.set(vessel.mmsi, marker);
          markersRendered++;
        }
      }
    }

    this.cleanupOldClustersMemoryOptimized(currentClusters);
    this.hideUnusedMarkersMemoryOptimized(currentVessels);
    
    console.log(`🗺️ MEMORY-OPTIMIZED: ${clustersRendered} clusters + ${markersRendered} markers`);

    this.emitLoadingState({
      isLoading: false,
      message: `Memory-optimized clusters: ${clustersRendered} clusters, ${markersRendered} vessels`,
      progress: 100,
      hasData: true,
      lastUpdate: new Date(),
      error: null
    });
  }

  // ✅ MEMORY OPTIMIZED: Clear clusters efficiently
  private clearClustersMemoryOptimized(): void {
    this.clusterMarkers.forEach(marker => {
      this.clusterLayer.removeLayer(marker);
      this.destroyMarkerCompletely(marker);
    });
    this.clusterMarkers.clear();
  }

  // ✅ MEMORY OPTIMIZED: Cleanup old clusters
  private cleanupOldClustersMemoryOptimized(currentClusters: Set<string>): void {
    this.clusterMarkers.forEach((marker, clusterId) => {
      if (!currentClusters.has(clusterId)) {
        this.clusterLayer.removeLayer(marker);
        this.destroyMarkerCompletely(marker);
        this.clusterMarkers.delete(clusterId);
      }
    });
  }

  // ✅ MEMORY OPTIMIZED: Hide unused markers with strict limits
  private hideUnusedMarkersMemoryOptimized(currentMMSIs: Set<number>): void {
    this.visibleMarkers.forEach((marker, mmsi) => {
      if (!currentMMSIs.has(mmsi)) {
        this.vesselLayer.removeLayer(marker);
        
        // ✅ MEMORY CHECK: Don't store too many hidden markers
        if (this.hiddenMarkers.size < this.MAX_HIDDEN_MARKERS) {
          this.hiddenMarkers.set(mmsi, marker);
        } else {
          // Destroy marker if hidden pool is full
          this.destroyMarkerCompletely(marker);
        }
        
        this.visibleMarkers.delete(mmsi);
      }
    });
  }

  // ✅ MEMORY OPTIMIZED: More sensitive viewport similarity
  private isViewportSimilar(bounds: any, zoom: number): boolean {
    if (!this.lastViewport) return false;

    const zoomDiff = Math.abs(zoom - this.lastViewport.zoom);
    if (zoomDiff >= 1) return false;

    const currentCenter = bounds.getCenter();
    const lastCenter = this.lastViewport.bounds.getCenter();
    const distance = currentCenter.distanceTo(lastCenter) * 1000;

    return distance < this.VIEWPORT_SIMILARITY_THRESHOLD; // 300m threshold
  }

  // ✅ MEMORY OPTIMIZED: Get or create marker with proper reuse
  private getOrCreateMarkerMemoryOptimized(vessel: Vessel): any {
    // ✅ Check hidden markers first (reuse)
    let marker = this.hiddenMarkers.get(vessel.mmsi);
    
    if (marker) {
      marker.setLatLng([vessel.latitude, vessel.longitude]);
      this.updateMarkerRotation(marker, vessel);
      marker.vesselData = { ...vessel }; // Create new reference
      this.hiddenMarkers.delete(vessel.mmsi);
      return marker;
    }

    // ✅ Check if already visible
    marker = this.visibleMarkers.get(vessel.mmsi);
    if (marker) {
      marker.setLatLng([vessel.latitude, vessel.longitude]);
      this.updateMarkerRotation(marker, vessel);
      marker.vesselData = { ...vessel }; // Create new reference
      return marker;
    }

    // ✅ Create new marker
    marker = this.parentService.createVesselMarker(vessel);
    if (marker) {
      this.memoryStats.markersCreated++;
    }
    return marker;
  }

  // ✅ MEMORY OPTIMIZED: Create cluster marker with minimal DOM
  private createMemoryOptimizedClusterMarker(cluster: VesselCluster, vesselCount: number): any {
    let clusterClass = 'cluster-small';
    let clusterSize = 32; // ✅ SMALLER: Reduce DOM memory

    if (vesselCount >= 1000) {
      clusterClass = 'cluster-mega';
      clusterSize = 56;
    } else if (vesselCount >= 500) {
      clusterClass = 'cluster-large';
      clusterSize = 48;
    } else if (vesselCount >= 100) {
      clusterClass = 'cluster-large';
      clusterSize = 44;
    } else if (vesselCount >= 50) {
      clusterClass = 'cluster-medium';
      clusterSize = 40;
    } else if (vesselCount >= 10) {
      clusterClass = 'cluster-medium';
      clusterSize = 36;
    }

    // ✅ MINIMAL HTML: Reduce DOM memory
    const clusterHtml = `<div class="vessel-cluster ${clusterClass} memory-opt"><span>${this.formatCount(vesselCount)}</span></div>`;

    const clusterIcon = this.L.divIcon({
      html: clusterHtml,
      className: 'custom-cluster-marker memory-optimized',
      iconSize: [clusterSize, clusterSize],
      iconAnchor: [clusterSize / 2, clusterSize / 2],
      popupAnchor: [0, -10]
    });

    const marker = this.L.marker([cluster.center.lat, cluster.center.lng], {
      icon: clusterIcon,
      title: `${vesselCount} vessels - Click to zoom`
    });

    // ✅ MEMORY SAFE: Simple click handler
    marker.on('click', (e: any) => {
      this.L.DomEvent.stopPropagation(e);

      try {
        const expansionZoom = this.clusterIndex.getClusterExpansionZoom(parseInt(cluster.id));
        let targetZoom = Math.min(expansionZoom, this.settings.disableClusteringAtZoom);
        
        if (targetZoom >= this.settings.disableClusteringAtZoom - 1) {
          targetZoom = this.settings.disableClusteringAtZoom;
        }
        
        this.map.setView([cluster.center.lat, cluster.center.lng], targetZoom);
        console.log(`🔍 Memory-optimized cluster expanded to zoom ${targetZoom}`);
        
      } catch (error) {
        this.map.setView([cluster.center.lat, cluster.center.lng], this.settings.disableClusteringAtZoom);
      }
    });

    return marker;
  }

  private updateMarkerRotation(marker: any, vessel: Vessel): void {
    const rotation = vessel.heading ?? vessel.course ?? 0;
    if (marker._icon) {
      const vesselIcon = marker._icon.querySelector('.vessel-icon');
      if (vesselIcon) {
        vesselIcon.style.transform = `rotate(${rotation}deg)`;
      }
    }
  }

  private formatCount(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }

  // ===================================
  // ✅ PUBLIC METHODS - MEMORY SAFE
  // ===================================

  public setSettings(newSettings: Partial<ViewportSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };

    // ✅ MEMORY CHECK: Apply memory limits
    this.settings.maxVisibleMarkers = Math.min(this.settings.maxVisibleMarkers, this.MAX_VISIBLE_MARKERS);

    if (newSettings.clusterRadius !== undefined || newSettings.disableClusteringAtZoom !== undefined) {
      this.clusterIndex = new Supercluster({
        radius: this.settings.clusterRadius,
        maxZoom: this.settings.disableClusteringAtZoom - 1,
        minZoom: 0,
        minPoints: 3, // Memory optimized
        extent: 256,  // Memory optimized
        nodeSize: 32, // Memory optimized
        log: false
      });

      if (this.geoJSONPoints.length > 0) {
        this.clusterIndex.load(this.geoJSONPoints);
        this.forceUpdateViewport();
      }
    }

    console.log('🎯 Memory-optimized settings updated:', this.settings);
  }

  public getSettings(): ViewportSettings {
    return { ...this.settings };
  }

  public setClusterDisableZoom(zoomLevel: number): void {
    this.setSettings({ disableClusteringAtZoom: zoomLevel });
  }

  // ✅ ENHANCED: Memory-aware stats
  public getStats(): any {
    const currentZoom = this.map?.getZoom() || 0;
    return {
      visibleMarkers: this.visibleMarkers.size,
      hiddenMarkers: this.hiddenMarkers.size,
      clusterMarkers: this.clusterMarkers.size,
      totalVessels: this.vesselsCache.length,
      geoJSONPoints: this.geoJSONPoints.length,
      settings: this.settings,
      currentZoom,
      clusteringEnabled: this.isClusteringEnabled,
      disableClusteringAtZoom: this.settings.disableClusteringAtZoom,
      zoomUntilIndividual: Math.max(0, this.settings.disableClusteringAtZoom - currentZoom),
      // ✅ MEMORY STATS
      memoryStats: {
        ...this.memoryStats,
        memoryPressure: this.isUnderMemoryPressure(),
        limits: {
          maxVisible: this.MAX_VISIBLE_MARKERS,
          maxHidden: this.MAX_HIDDEN_MARKERS,
          maxCache: this.MAX_CACHE_SIZE
        }
      }
    };
  }

  public forceHideLoading(): void {
    console.log('🚨 Memory-optimized: Force hiding loading');
    this.emitLoadingState({
      isLoading: false,
      message: `${this.vesselsCache.length} vessels ready (memory optimized)`,
      progress: 100,
      hasData: true,
      lastUpdate: new Date(),
      error: null
    });
  }

  public getCurrentZoom(): number {
    return this.map?.getZoom() || 0;
  }

  public isCurrentlyClusteringEnabled(): boolean {
    return this.isClusteringEnabled;
  }

  public getClusteringStatus(): string {
    const currentZoom = this.getCurrentZoom();
    const stats = this.getStats();
    
    if (currentZoom < this.settings.disableClusteringAtZoom) {
      return `Memory-optimized clustering ACTIVE (zoom ${currentZoom} < ${this.settings.disableClusteringAtZoom}) - ${this.settings.clusterRadius}px radius`;
    } else {
      return `Individual markers (zoom ${currentZoom} >= ${this.settings.disableClusteringAtZoom}) - Memory optimized`;
    }
  }

  // ✅ COMPREHENSIVE MEMORY-SAFE CLEANUP
  public cleanup(): void {
    console.log('🧹 Starting comprehensive OptimizedMarkerManager cleanup...');

    // ✅ Stop all timers
    if (this.updateTimer) clearTimeout(this.updateTimer);
    if (this.memoryCleanupTimer) clearInterval(this.memoryCleanupTimer);
    if (this.performanceMonitorTimer) clearInterval(this.performanceMonitorTimer);

    // ✅ Remove map event listeners
    this.map?.off('movestart');
    this.map?.off('moveend');
    this.map?.off('zoomstart');
    this.map?.off('zoomend');

    // ✅ Destroy all markers completely
    this.visibleMarkers.forEach(marker => this.destroyMarkerCompletely(marker));
    this.hiddenMarkers.forEach(marker => this.destroyMarkerCompletely(marker));
    this.clusterMarkers.forEach(marker => this.destroyMarkerCompletely(marker));

    // ✅ Clear all collections
    this.visibleMarkers.clear();
    this.hiddenMarkers.clear();
    this.clusterMarkers.clear();
    this.vesselsCache.length = 0;
    this.geoJSONPoints.length = 0;

    // ✅ Clear map layers
    this.vesselLayer.clearLayers();
    this.clusterLayer.clearLayers();

    // ✅ Complete observables
    this.loadingStateSubject.complete();

    // ✅ Clear references
    this.popupService = null;
    this.lastViewport = null;

    // ✅ Force garbage collection if available
    if (window.gc) {
      window.gc();
    }

    console.log('🧹 Memory-optimized OptimizedMarkerManager cleanup completed');
    console.log('📊 Final memory stats:', this.memoryStats);
  }
// Add this method to OptimizedMarkerManager class

  // ✅ NEW: Remove aged markers by MMSI list
  public removeAgedMarkers(mmsiList: number[]): void {
    if (!mmsiList || mmsiList.length === 0) return;
    
    let removedCount = 0;
    
    mmsiList.forEach(mmsi => {
      // ✅ Remove from visible markers
      const visibleMarker = this.visibleMarkers.get(mmsi);
      if (visibleMarker) {
        if (this.vesselLayer.hasLayer(visibleMarker)) {
          this.vesselLayer.removeLayer(visibleMarker);
        }
        this.destroyMarkerCompletely(visibleMarker);
        this.visibleMarkers.delete(mmsi);
        removedCount++;
        console.log(`🗑️ Removed aged visible marker for MMSI ${mmsi}`);
      }

      // ✅ Remove from hidden markers
      const hiddenMarker = this.hiddenMarkers.get(mmsi);
      if (hiddenMarker) {
        this.destroyMarkerCompletely(hiddenMarker);
        this.hiddenMarkers.delete(mmsi);
        removedCount++;
        console.log(`🗑️ Removed aged hidden marker for MMSI ${mmsi}`);
      }
    });

    if (removedCount > 0) {
      console.log(`🗑️ OptimizedMarkerManager: Removed ${removedCount} aged markers for ${mmsiList.length} MMSIs`);
      
      // ✅ Update memory stats
      this.memoryStats.markersDestroyed += removedCount;
    }
  }

  // ✅ NEW: Check if marker exists for MMSI
  public hasMarkerForMMSI(mmsi: number): boolean {
    return this.visibleMarkers.has(mmsi) || this.hiddenMarkers.has(mmsi);
  }

  // ✅ NEW: Get all marker MMSIs (for debugging)
  public getAllMarkerMMSIs(): number[] {
    const visibleMMSIs = Array.from(this.visibleMarkers.keys());
    const hiddenMMSIs = Array.from(this.hiddenMarkers.keys());
    return [...visibleMMSIs, ...hiddenMMSIs];
  }

  // ✅ ENHANCED: Clean markers not in vessel list
  public cleanMarkersNotInVesselList(vesselMMSIs: Set<number>): void {
    let cleanedCount = 0;
    
    // Clean visible markers
    this.visibleMarkers.forEach((marker, mmsi) => {
      if (!vesselMMSIs.has(mmsi)) {
        if (this.vesselLayer.hasLayer(marker)) {
          this.vesselLayer.removeLayer(marker);
        }
        this.destroyMarkerCompletely(marker);
        this.visibleMarkers.delete(mmsi);
        cleanedCount++;
      }
    });
    
    // Clean hidden markers
    this.hiddenMarkers.forEach((marker, mmsi) => {
      if (!vesselMMSIs.has(mmsi)) {
        this.destroyMarkerCompletely(marker);
        this.hiddenMarkers.delete(mmsi);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} orphaned markers`);
      this.memoryStats.markersDestroyed += cleanedCount;
    }
  }

}
