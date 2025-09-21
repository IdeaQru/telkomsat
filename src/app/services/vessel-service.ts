// src/services/vessel.service.ts - COMPLETE MEMORY OPTIMIZED VERSION WITH DATA AGING
import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { Subscription, BehaviorSubject } from 'rxjs';
import { OptimizedMarkerManager, LoadingState, ViewportSettings } from './optimized-marker-manager';
import { VesselPopupService } from './vessel-pop-up.service';
import { VesselWebSocketService, Vessel, ConnectionStats } from './vessel-websocket.service';

export interface VesselServiceStats {
  totalVessels: number;
  visibleMarkers: number;
  clusteredMarkers: number;
  realTimeUpdates: number;
  connectionStatus: string;
  lastUpdate: Date | null;
  performance: {
    updateThrottle: number;
    renderingTime: number;
    memoryUsage: string;
  };
  // ✅ NEW: Data aging information
  dataAging?: {
    maxAgeHours: number;
    trackedVessels: number;
    freshVessels: number;
    agedVessels: number;
    lastCleanup: string;
    cutoffTime: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class VesselService implements OnDestroy {
  private map: any;
  private L: any;
  private vesselLayer: any;
  private clusterLayer: any;
  
  // ✅ MEMORY CONTROL: Limited subscriptions
  private vesselUpdatesSubscription!: Subscription;
  private connectionStatusSubscription!: Subscription;
  private connectionStatsSubscription!: Subscription;
  private loadingCompleteSubscription!: Subscription;
  
  // ✅ MEMORY OPTIMIZED MARKER MANAGER
  private optimizedManager: OptimizedMarkerManager | null = null;
  
  canvasRenderer: any;

  // ✅ MEMORY SAFE LOADING STATE
  private loadingStateSubject = new BehaviorSubject<LoadingState>({
    isLoading: true,
    message: 'Initializing vessel tracking...',
    progress: 0,
    hasData: false,
    lastUpdate: null,
    error: null
  });

  public loadingState$ = this.loadingStateSubject.asObservable();
  
  // ✅ MEMORY CONTROL: Limited state management
  private loadingTimeout: any;
  private firstDataReceived = false;
  private connectionRetryTimeout: any;
  
  // ✅ MEMORY MONITORING
  private performanceMetrics = {
    startTime: Date.now(),
    totalUpdates: 0,
    lastUpdateTime: 0,
    peakMemoryUsage: 0,
    memoryWarningThreshold: 500 * 1024 * 1024 // 500MB warning
  };

  // ✅ DATA AGING: Enhanced memory limits with time-based cleanup
  private readonly MAX_VESSEL_UPDATES_PER_MINUTE = 60;
  private readonly MEMORY_CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly DATA_MAX_AGE_HOURS = 1; // ✅ 1 hour max age
  private readonly DATA_MAX_AGE_MS = this.DATA_MAX_AGE_HOURS * 60 * 60 * 1000;
  
  private memoryCleanupTimer: any = null;
  private updateCounter = 0;
  private lastMinuteReset = Date.now();

  // ✅ NEW: Track vessel timestamps and data for aging
  private vesselDataCache: Map<number, { vessel: Vessel, timestamp: number }> = new Map();
  private lastCleanupTime = Date.now();

  constructor(
    private webSocketService: VesselWebSocketService,
    private vesselPopupService: VesselPopupService,
    private zone: NgZone
  ) {
    console.log('🛰️ VesselService constructor - Memory optimized with data aging');
    this.startMemoryMonitoring();
    this.startLoadingSequence();
  }

  ngOnDestroy(): void {
    console.log('🔄 VesselService ngOnDestroy called - Data aging cleanup');
    this.cleanup();
  }

  public getCurrentLoadingState(): LoadingState {
    return this.loadingStateSubject.value;
  }

  public getVesselCount(): number {
    return this.optimizedManager?.getStats().totalVessels || 0;
  }

  public getVesselServiceStats(): VesselServiceStats {
    const optimizedStats = this.optimizedManager?.getStats() || {
      totalVessels: 0,
      visibleMarkers: 0,
      clusterMarkers: 0
    };
    
    const connectionStats = this.webSocketService.getVesselStats();
    const loadingState = this.getCurrentLoadingState();
    
    // ✅ Calculate fresh vs aged data
    const now = Date.now();
    const cutoffTime = now - this.DATA_MAX_AGE_MS;
    let freshVessels = 0;
    let agedVessels = 0;
    
    this.vesselDataCache.forEach(({ timestamp }) => {
      if (timestamp >= cutoffTime) {
        freshVessels++;
      } else {
        agedVessels++;
      }
    });
    
    return {
      totalVessels: optimizedStats.totalVessels,
      visibleMarkers: optimizedStats.visibleMarkers,
      clusteredMarkers: optimizedStats.clusterMarkers || 0,
      realTimeUpdates: connectionStats.real_time_updates || 0,
      connectionStatus: this.webSocketService.getConnectionStatus(),
      lastUpdate: loadingState.lastUpdate,
      performance: {
        updateThrottle: 150,
        renderingTime: Date.now() - this.performanceMetrics.lastUpdateTime,
        memoryUsage: this.getMemoryUsage()
      },
      // ✅ Data aging information
      dataAging: {
        maxAgeHours: this.DATA_MAX_AGE_HOURS,
        trackedVessels: this.vesselDataCache.size,
        freshVessels: freshVessels,
        agedVessels: agedVessels,
        lastCleanup: new Date(this.lastCleanupTime).toISOString(),
        cutoffTime: new Date(cutoffTime).toISOString()
      }
    };
  }

  private getMemoryUsage(): string {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
      
      return `${usedMB}MB / ${limitMB}MB (${Math.round((usedMB/limitMB)*100)}%) • ${this.vesselDataCache.size} cached`;
    }
    return `N/A • ${this.vesselDataCache.size} cached vessels`;
  }

  // ✅ NEW: Memory monitoring system
  private startMemoryMonitoring(): void {
    this.memoryCleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
      this.checkMemoryUsage();
    }, this.MEMORY_CLEANUP_INTERVAL);

    console.log('🧠 Memory monitoring system started with data aging');
  }

  // ✅ ENHANCED: Memory cleanup with data aging
  private performMemoryCleanup(): void {
    console.log('🧹 Starting enhanced memory cleanup with data aging...');
    const startTime = Date.now();
    const now = Date.now();
    
    // Reset update counter every minute
    if (now - this.lastMinuteReset > 60000) {
      this.updateCounter = 0;
      this.lastMinuteReset = now;
    }

    // ✅ NEW: Clean up aged vessel data (> 1 hour)
    this.cleanupAgedVesselData(now);

    // Check memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      
      this.performanceMetrics.peakMemoryUsage = Math.max(this.performanceMetrics.peakMemoryUsage, usedMB);
      
      // Emergency cleanup if memory > 500MB
      if (memory.usedJSHeapSize > this.performanceMetrics.memoryWarningThreshold) {
        console.warn(`⚠️ High memory usage detected: ${usedMB}MB`);
        this.emergencyMemoryCleanup();
      }
    }

    // Cleanup old performance metrics
    this.cleanupOldMetrics();

    const cleanupTime = Date.now() - startTime;
    console.log(`🧹 Enhanced memory cleanup completed in ${cleanupTime}ms`);
  }

  // ✅ NEW: Clean up aged vessel data (older than 1 hour)
  // ✅ NEW: Clean up aged vessel data (older than 1 hour)
  // ✅ FIXED: Clean up aged vessel data AND remove markers from map
  private cleanupAgedVesselData(currentTime: number): void {
    let removedCount = 0;
    const cutoffTime = currentTime - this.DATA_MAX_AGE_MS;
    const agedMMSIs: number[] = [];
    
    console.log(`🕒 Cleaning aged vessel data older than ${new Date(cutoffTime).toISOString()}`);
    
    // ✅ 1. Collect aged MMSIs before removing from cache
    this.vesselDataCache.forEach(({ timestamp }, mmsi) => {
      if (timestamp < cutoffTime) {
        agedMMSIs.push(mmsi);
        removedCount++;
      }
    });

    // ✅ 2. Remove aged vessels from cache
    agedMMSIs.forEach(mmsi => {
      this.vesselDataCache.delete(mmsi);
    });

    this.lastCleanupTime = currentTime;

    if (removedCount > 0) {
      console.log(`🗑️ Cleaned up ${removedCount} aged vessels (> ${this.DATA_MAX_AGE_HOURS}h old)`);
      console.log(`📝 Removed MMSIs: ${agedMMSIs.slice(0, 10).join(', ')}${agedMMSIs.length > 10 ? '...' : ''}`);
      
      // ✅ 3. CRITICAL: Remove aged markers from OptimizedMarkerManager
      if (this.optimizedManager && agedMMSIs.length > 0) {
        this.optimizedManager.removeAgedMarkers(agedMMSIs);
      }
      
      // ✅ 4. Update with fresh vessels only
      if (this.optimizedManager && this.vesselDataCache.size > 0) {
        const freshVessels = Array.from(this.vesselDataCache.values()).map(cache => cache.vessel);
        console.log(`🔄 Updating OptimizedMarkerManager with ${freshVessels.length} fresh vessels after cleanup`);
        this.optimizedManager.updateVessels(freshVessels);
      } else if (this.optimizedManager && this.vesselDataCache.size === 0) {
        // ✅ If no fresh vessels left, clear all markers
        console.log(`🧹 No fresh vessels remaining, clearing all markers`);
        this.optimizedManager.updateVessels([]);
      }
      
      // Force garbage collection hint
      if (window.gc && removedCount > 100) {
        window.gc();
        console.log(`🗑️ Forced garbage collection after removing ${removedCount} aged vessels`);
      }
    }
  }

  // ✅ FIXED: Emergency cleanup with proper marker removal
  private emergencyMemoryCleanup(): void {
    console.warn('🚨 EMERGENCY MEMORY CLEANUP - VesselService with Aggressive Data Aging');
    
    const now = Date.now();
    const emergencyCutoffTime = now - (this.DATA_MAX_AGE_MS * 0.5); // 30 minutes
    
    let emergencyRemoved = 0;
    const emergencyMMSIs: number[] = [];
    
    // ✅ 1. Collect emergency aged MMSIs
    this.vesselDataCache.forEach(({ timestamp }, mmsi) => {
      if (timestamp < emergencyCutoffTime) {
        emergencyMMSIs.push(mmsi);
        emergencyRemoved++;
      }
    });

    // ✅ 2. Remove emergency vessels from cache
    emergencyMMSIs.forEach(mmsi => {
      this.vesselDataCache.delete(mmsi);
    });

    console.warn(`🚨 Emergency cleanup removed ${emergencyRemoved} vessels (> 30min old)`);
    console.warn(`📝 Emergency removed MMSIs: ${emergencyMMSIs.slice(0, 5).join(', ')}${emergencyMMSIs.length > 5 ? '...' : ''}`);
    
    // ✅ 3. CRITICAL: Remove emergency aged markers
    if (this.optimizedManager && emergencyMMSIs.length > 0) {
      this.optimizedManager.removeAgedMarkers(emergencyMMSIs);
    }
    
    // ✅ 4. Update with remaining vessels
    if (this.optimizedManager) {
      if (this.vesselDataCache.size > 0) {
        const remainingVessels = Array.from(this.vesselDataCache.values()).map(cache => cache.vessel);
        console.warn(`🔄 Emergency update: ${remainingVessels.length} vessels remaining`);
        this.optimizedManager.updateVessels(remainingVessels);
      } else {
        console.warn(`🧹 Emergency cleanup: No vessels remaining, clearing all`);
        this.optimizedManager.updateVessels([]);
      }
      
      // ✅ Try emergency cleanup if method exists
      if (typeof this.optimizedManager.performEmergencyCleanup === 'function') {
        this.optimizedManager.performEmergencyCleanup();
      }
    }
    
    // Force garbage collection
    if (window.gc) {
      window.gc();
      console.warn('🚨 Manual garbage collection triggered after emergency cleanup');
    }
  }

  // ✅ ENHANCED: Vessel updates with better aged marker handling
  private subscribeToVesselUpdates(): void {
    this.vesselUpdatesSubscription = this.webSocketService.vesselUpdates$.subscribe({
      next: (vessels: Vessel[]) => {
        // ✅ MEMORY CONTROL: Throttle updates
        this.updateCounter++;
        if (this.updateCounter > this.MAX_VESSEL_UPDATES_PER_MINUTE) {
          console.warn(`⚠️ Update rate limit exceeded (${this.updateCounter}/min). Skipping update.`);
          return;
        }

        const updateStartTime = Date.now();
        console.log(`📥 Received ${vessels.length} vessels - filtering aged data...`);

        // ✅ NEW: Filter out aged data immediately on every update
        const now = Date.now();
        const freshVessels: Vessel[] = [];
        const agedVessels: Vessel[] = [];

        vessels.forEach(vessel => {
          if (this.isVesselDataTooOld(vessel)) {
            agedVessels.push(vessel);
          } else {
            freshVessels.push(vessel);
          }
        });

        // ✅ NEW: Remove aged vessels from cache AND markers
        const removedFromCache: number[] = [];
        
        // Remove aged vessels from cache
        this.vesselDataCache.forEach(({ timestamp }, mmsi) => {
          if (now - timestamp > this.DATA_MAX_AGE_MS) {
            this.vesselDataCache.delete(mmsi);
            removedFromCache.push(mmsi);
          }
        });

        // ✅ CRITICAL: Remove aged markers immediately
        if (removedFromCache.length > 0 && this.optimizedManager) {
          console.log(`🗑️ Removing ${removedFromCache.length} aged markers from map`);
          this.optimizedManager.removeAgedMarkers(removedFromCache);
        }

        // Add/Update fresh vessels in cache
        freshVessels.forEach(vessel => {
          this.vesselDataCache.set(vessel.mmsi, {
            vessel: { ...vessel }, // Create new object reference
            timestamp: new Date(vessel.timestamp).getTime()
          });
        });

        // ✅ Log results
        if (agedVessels.length > 0) {
          console.log(`🕒 Filtered out ${agedVessels.length} aged vessels from incoming data`);
        }
        if (removedFromCache.length > 0) {
          console.log(`🗑️ Removed ${removedFromCache.length} aged vessels from cache and markers`);
        }

        this.performanceMetrics.totalUpdates++;
        this.performanceMetrics.lastUpdateTime = Date.now();
        
        // ✅ Rest of the update logic remains the same...
        if (freshVessels.length > 0 && !this.firstDataReceived) {
          this.zone.run(() => {
            console.log('🚨 FIRST FRESH DATA RECEIVED - Memory safe mode with data aging');
            
            this.firstDataReceived = true;
            if (this.loadingTimeout) {
              clearTimeout(this.loadingTimeout);
              this.loadingTimeout = null;
            }

            this.loadingStateSubject.next({
              isLoading: false,
              message: `${freshVessels.length} fresh vessels connected (< ${this.DATA_MAX_AGE_HOURS}h)`,
              progress: 100,
              hasData: true,
              lastUpdate: new Date(),
              error: null
            });
          });
        }
        
        if (freshVessels.length > 0) {
          this.zone.run(() => {
            const currentState = this.loadingStateSubject.value;
            if (currentState.hasData) {
              this.loadingStateSubject.next({
                ...currentState,
                message: `${freshVessels.length} fresh vessels • ${this.vesselDataCache.size} cached`,
                lastUpdate: new Date()
              });
            }
          });
        }
        
        // ✅ Update markers with fresh vessels only
        if (this.optimizedManager && freshVessels.length > 0) {
          console.log(`🔄 Updating OptimizedMarkerManager with ${freshVessels.length} fresh vessels`);
          this.optimizedManager.updateVessels(freshVessels);
        } else if (freshVessels.length === 0 && this.vesselDataCache.size > 0) {
          // If no new fresh vessels but we have cached fresh vessels, use those
          const cachedFreshVessels = Array.from(this.vesselDataCache.values()).map(cache => cache.vessel);
          if (this.optimizedManager) {
            console.log(`🔄 Updating OptimizedMarkerManager with ${cachedFreshVessels.length} cached fresh vessels`);
            this.optimizedManager.updateVessels(cachedFreshVessels);
          }
        }

        this.checkMemoryUsage();
        const processingTime = Date.now() - updateStartTime;
        console.log(`✅ Vessel update completed in ${processingTime}ms: ${freshVessels.length} fresh, ${agedVessels.length} aged (filtered)`);
      },
      error: (err) => {
        console.error('[VesselService] Error in vessel updates:', err);
        this.handleUpdateError(err);
      }
    });
  }


  // ✅ NEW: Helper to check if vessel data is too old
  private isVesselDataTooOld(vessel: Vessel): boolean {
    const now = Date.now();
    const vesselTime = new Date(vessel.timestamp).getTime();
    const age = now - vesselTime;
    
    return age > this.DATA_MAX_AGE_MS;
  }

  // ✅ NEW: Helper to get vessel age in human readable format
  private getVesselAge(vessel: Vessel): string {
    const now = Date.now();
    const vesselTime = new Date(vessel.timestamp).getTime();
    const ageMs = now - vesselTime;
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    const ageHours = Math.floor(ageMinutes / 60);
    
    if (ageHours > 0) {
      return `${ageHours}h ${ageMinutes % 60}m`;
    } else {
      return `${ageMinutes}m`;
    }
  }

  // ✅ ENHANCED: Emergency memory cleanup with aggressive data aging


  // ✅ NEW: Cleanup old performance metrics
  private cleanupOldMetrics(): void {
    // Reset metrics older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    if (this.performanceMetrics.startTime < oneHourAgo) {
      this.performanceMetrics = {
        startTime: Date.now(),
        totalUpdates: 0,
        lastUpdateTime: 0,
        peakMemoryUsage: this.performanceMetrics.peakMemoryUsage,
        memoryWarningThreshold: this.performanceMetrics.memoryWarningThreshold
      };
    }
  }

  // ✅ NEW: Check memory usage
  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
      
      console.log(`🧠 Memory: ${usedMB}MB / ${limitMB}MB (${Math.round((usedMB/limitMB)*100)}%) • ${this.vesselDataCache.size} cached vessels`);
    }
  }

  // ✅ MEMORY SAFE: Simple loading sequence
  private startLoadingSequence(): void {
    const loadingSteps = [
      { message: 'Connecting to vessel backend...', progress: 20 },
      { message: 'Establishing WebSocket connection...', progress: 40 },
      { message: 'Loading vessel data...', progress: 60 },
      { message: 'Initializing memory-optimized clustering...', progress: 80 },
      { message: 'Ready for real-time updates with data aging...', progress: 95 }
    ];

    let currentStep = 0;
    
    const stepInterval = setInterval(() => {
      if (currentStep < loadingSteps.length && !this.firstDataReceived) {
        this.updateLoadingState({
          isLoading: true,
          message: loadingSteps[currentStep].message,
          progress: loadingSteps[currentStep].progress,
          hasData: false,
          lastUpdate: null,
          error: null
        });
        currentStep++;
      } else {
        clearInterval(stepInterval);
      }
    }, 500);

    // ✅ MEMORY SAFE: Timeout with cleanup
    this.loadingTimeout = setTimeout(() => {
      if (!this.firstDataReceived) {
        this.updateLoadingState({
          isLoading: false,
          message: 'No data available',
          progress: 0,
          hasData: false,
          lastUpdate: null,
          error: 'Unable to connect. Please refresh to retry.'
        });
      }
      this.loadingTimeout = null; // ✅ Clear reference
    }, 15000);
  }

  private updateLoadingState(newState: Partial<LoadingState>): void {
    this.zone.run(() => {
      const currentState = this.loadingStateSubject.value;
      const updatedState = { ...currentState, ...newState };
      this.loadingStateSubject.next(updatedState);
      
      if (newState.isLoading !== undefined) {
        console.log(`🔄 Loading state: ${newState.isLoading ? 'LOADING' : 'COMPLETE'}`, updatedState);
      }
    });
  }

  // ✅ MEMORY SAFE: Initialize method
  public initialize(map: any, L: any): void {
    console.log('🚀 VesselService initialization starting - Memory optimized with data aging...');
    
    this.map = map;
    this.L = L;
    
    // ✅ Canvas renderer for performance (reuse if exists)
    if (!this.canvasRenderer) {
      this.canvasRenderer = this.L.canvas({ padding: 0.5 });
    }
    
    // ✅ Create layer groups (cleanup old ones first)
    if (this.vesselLayer) {
      this.vesselLayer.clearLayers();
      this.map.removeLayer(this.vesselLayer);
    }
    if (this.clusterLayer) {
      this.clusterLayer.clearLayers();
      this.map.removeLayer(this.clusterLayer);
    }
    
    this.vesselLayer = this.L.layerGroup().addTo(this.map);
    this.clusterLayer = this.L.layerGroup().addTo(this.map);
    
    // ✅ Initialize MEMORY OPTIMIZED OptimizedMarkerManager
    if (this.optimizedManager) {
      this.optimizedManager.cleanup();
    }
    
    this.optimizedManager = new OptimizedMarkerManager(
      this.map,
      this.L,
      this.vesselLayer,
      this.clusterLayer,
      this,
      this.zone
    );

    // ✅ Set popup service
    this.optimizedManager.setPopupService(this.vesselPopupService);
    
    // ✅ MEMORY SAFE configuration
    this.optimizedManager.setSettings({
      updateThrottle: 150,          // ✅ SLOWER: Reduce CPU/memory pressure
      maxVisibleMarkers: 500,       // ✅ REDUCED: Lower memory usage
      maxClusters: 30,              // ✅ REDUCED: Less cluster objects
      viewportPadding: 0.1,         // ✅ REDUCED: Less viewport data
      disableClusteringAtZoom: 15,  // ✅ HIGHER: Force clustering more
      clusterRadius: 120            // ✅ SMALLER: More aggressive clustering
    });
    
    // ✅ START WEBSOCKET
    this.webSocketService.connect();
    
    // ✅ Setup subscriptions
    this.subscribeToVesselUpdates();
    this.subscribeToConnectionStatus();
    this.subscribeToConnectionStats();
    this.subscribeToLoadingComplete();
    
    console.log('🚀 VesselService initialized with data aging system');
  }

  // ✅ ENHANCED: Vessel updates subscription with data aging filter


  // ✅ Rest of the methods remain similar but with memory optimizations...
  private subscribeToConnectionStatus(): void {
    this.connectionStatusSubscription = this.webSocketService.connectionStatus$.subscribe({
      next: (status: string) => {
        this.zone.run(() => {
          switch (status) {
            case 'connecting':
              this.updateLoadingState({
                isLoading: true,
                message: 'Connecting to vessel tracking (memory + aging optimized)...',
                progress: 30,
                error: null
              });
              break;
              
            case 'connected':
              this.updateLoadingState({
                isLoading: this.firstDataReceived ? false : true,
                message: this.firstDataReceived 
                  ? 'Connected • Memory + aging optimized' 
                  : 'Connected • Waiting for data...',
                progress: this.firstDataReceived ? 100 : 80,
                error: null
              });
              
              if (this.connectionRetryTimeout) {
                clearTimeout(this.connectionRetryTimeout);
                this.connectionRetryTimeout = null;
              }
              break;
              
            case 'disconnected':
              this.updateLoadingState({
                isLoading: false,
                message: 'Connection lost',
                hasData: this.optimizedManager?.getStats().totalVessels > 0,
                lastUpdate: this.loadingStateSubject.value.lastUpdate,
                error: 'Connection lost. Attempting to reconnect...'
              });
              
              this.scheduleReconnection();
              break;
              
            case 'error':
              this.updateLoadingState({
                isLoading: false,
                message: 'Connection failed',
                progress: 0,
                hasData: false,
                lastUpdate: null,
                error: 'Failed to connect. Please check your network.'
              });
              
              this.scheduleReconnection();
              break;
          }
        });
      },
      error: (err) => {
        console.error('[VesselService] Connection status error:', err);
        this.handleConnectionError();
      }
    });
  }

  private subscribeToConnectionStats(): void {
    this.connectionStatsSubscription = this.webSocketService.connectionStats$.subscribe({
      next: (stats: ConnectionStats) => {
        if (stats.connected && stats.vesselCount > 0 && !this.firstDataReceived) {
          this.zone.run(() => {
            this.firstDataReceived = true;
            this.updateLoadingState({
              isLoading: false,
              message: `${stats.vesselCount} vessels • Memory + aging optimized`,
              progress: 100,
              hasData: true,
              lastUpdate: new Date(),
              error: null
            });
          });
        }
      }
    });
  }

  private subscribeToLoadingComplete(): void {
    this.loadingCompleteSubscription = this.webSocketService.loadingComplete$.subscribe({
      next: (loadingInfo) => {
        if (loadingInfo.hasData && !this.firstDataReceived) {
          this.zone.run(() => {
            console.log('🚨 Loading complete event received - Memory safe with data aging');
            this.firstDataReceived = true;
            
            if (this.loadingTimeout) {
              clearTimeout(this.loadingTimeout);
              this.loadingTimeout = null;
            }
            
            this.updateLoadingState({
              isLoading: false,
              message: 'Vessel data loaded (memory + aging optimized)',
              progress: 100,
              hasData: true,
              lastUpdate: new Date(),
              error: null
            });
          });
        }
        
        if (loadingInfo.error) {
          this.handleUpdateError(loadingInfo.error);
        }
      }
    });
  }

  // ✅ MEMORY SAFE error handling
  private handleUpdateError(error?: any): void {
    console.error('[VesselService] Update error:', error);
    
    this.zone.run(() => {
      this.updateLoadingState({
        isLoading: false,
        message: 'Data update failed',
        progress: 0,
        hasData: this.optimizedManager?.getStats().totalVessels > 0,
        lastUpdate: this.loadingStateSubject.value.lastUpdate,
        error: error?.message || 'Failed to receive vessel updates. Retrying...'
      });
    });
    
    this.scheduleReconnection();
  }

  private handleConnectionError(): void {
    this.zone.run(() => {
      this.updateLoadingState({
        isLoading: false,
        message: 'Connection error',
        progress: 0,
        hasData: false,
        lastUpdate: null,
        error: 'Unable to establish connection. Please check your network.'
      });
    });
  }

  private scheduleReconnection(): void {
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
    }
    
    this.connectionRetryTimeout = setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      this.webSocketService.connect();
      this.connectionRetryTimeout = null; // ✅ Clear reference
    }, 5000);
  }

  // ✅ MEMORY SAFE: CREATE VESSEL MARKER
  public createVesselMarker(vessel: Vessel): any {
    try {
      const rotation = vessel.heading ?? vessel.course ?? 0;
      const iconColor = this.getVesselIconColor(vessel);
      const isLive = this.isVesselLive(vessel);
      
      // ✅ MEMORY OPTIMIZED: Simpler HTML structure
      const vesselHtml = `
        <div class="vessel-icon vessel-${iconColor} ${isLive ? 'live-vessel' : ''}" 
             style="transform: rotate(${rotation}deg);"
             data-mmsi="${vessel.mmsi}"
             title="${this.getVesselTitle(vessel)}">
          <div class="arrow-shape"></div>
          ${isLive ? '<div class="live-dot"></div>' : ''}
        </div>
      `;

     const vesselIcon = this.L.divIcon({
        html: vesselHtml,
        className: 'custom-vessel-marker memory-optimized',
        iconSize: [16, 16],      // ✅ SMALLER: Less DOM memory
        iconAnchor: [8, 8],
        popupAnchor: [0, -8]
      });

      const marker = this.L.marker([vessel.latitude, vessel.longitude], {
        icon: vesselIcon,
        title: this.getVesselTitle(vessel),
        renderer: this.canvasRenderer
      });

      // ✅ MEMORY SAFE: Popup binding
      this.vesselPopupService.bindPopupToMarker(marker, vessel, this.L, 'vessel');
      marker.vesselData = vessel;
      marker.lastUpdated = vessel.timestamp;

      // ✅ MEMORY SAFE: Simple click handler
      marker.on('click', (e: any) => {
        this.L.DomEvent.stopPropagation(e);
        
        if (vessel.mmsi) {
          this.webSocketService.subscribeToVessel(vessel.mmsi);
          console.log(`🎯 Subscribed to vessel ${vessel.mmsi}`);
        }
      });

      return marker;
    } catch (error) {
      console.error('Error creating vessel marker:', error);
      return null;
    }
  }

  // ✅ Rest of helper methods remain the same...
  private isVesselLive(vessel: Vessel): boolean {
    const age = Date.now() - vessel.timestamp.getTime();
    return age < 300000;
  }

  private getVesselTitle(vessel: Vessel): string {
    const parts = [];
    if (vessel.name) parts.push(vessel.name);
    parts.push(`MMSI: ${vessel.mmsi}`);
    if (vessel.speed !== undefined) parts.push(`${vessel.speed.toFixed(1)} kts`);
    if (this.isVesselLive(vessel)) parts.push('🔴 Live');
    
    // ✅ NEW: Add data age to title
    const age = this.getVesselAge(vessel);
    parts.push(`Age: ${age}`);
    
    return parts.join(' • ');
  }

  private getVesselIconColor(vessel: Vessel): string {
    const vesselType = vessel.vesselType;
    if (vesselType >= 80 && vesselType <= 89) return 'tanker';
    if (vesselType >= 70 && vesselType <= 79) return 'cargo';
    if (vesselType >= 60 && vesselType <= 69) return 'passenger';
    if (vesselType >= 40 && vesselType <= 49) return 'highspeed';
    if (vesselType >= 50 && vesselType <= 59) return 'special';
    if (vesselType === 30) return 'fishing';
    return 'unknown';
  }

  // ===================================
  // ✅ PUBLIC API METHODS - MEMORY SAFE
  // ===================================

  public refreshVesselData(): void {
    console.log('🔄 Manual refresh requested - Memory safe with data aging');
    this.firstDataReceived = false;
    this.startLoadingSequence();
  }

  // ✅ NEW: Manual cleanup aged data
  public manualCleanupAgedData(): void {
    console.log('🧹 Manual cleanup of aged data requested');
    this.cleanupAgedVesselData(Date.now());
  }

  // ✅ NEW: Get fresh vessel data from cache
  public getFreshVesselData(): Vessel[] {
    const now = Date.now();
    const cutoffTime = now - this.DATA_MAX_AGE_MS;
    
    return Array.from(this.vesselDataCache.values())
      .filter(cache => cache.timestamp >= cutoffTime)
      .map(cache => cache.vessel);
  }

  // ✅ COMPREHENSIVE MEMORY SAFE CLEANUP
  public cleanup(): void {
    console.log('🚀 Starting VesselService cleanup - Memory optimized with data aging...');
    
    // ✅ Stop memory monitoring
    if (this.memoryCleanupTimer) {
      clearInterval(this.memoryCleanupTimer);
      this.memoryCleanupTimer = null;
    }
    
    // ✅ Clear timeouts
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
    
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
      this.connectionRetryTimeout = null;
    }
    
    // ✅ NEW: Clear vessel data cache
    this.vesselDataCache.clear();
    
    // ✅ Unsubscribe from WebSocket events
    if (this.vesselUpdatesSubscription) {
      this.vesselUpdatesSubscription.unsubscribe();
    }
    if (this.connectionStatusSubscription) {
      this.connectionStatusSubscription.unsubscribe();
    }
    if (this.connectionStatsSubscription) {
      this.connectionStatsSubscription.unsubscribe();
    }
    if (this.loadingCompleteSubscription) {
      this.loadingCompleteSubscription.unsubscribe();
    }
    
    // ✅ Cleanup WebSocket service
    this.webSocketService.cleanup();
    
    // ✅ Cleanup optimized manager
    if (this.optimizedManager) {
      this.optimizedManager.cleanup();
      this.optimizedManager = null;
    }
    
    // ✅ Clean up map layers
    if (this.map) {
      if (this.vesselLayer) {
        this.vesselLayer.clearLayers();
        this.map.removeLayer(this.vesselLayer);
        this.vesselLayer = null;
      }
      
      if (this.clusterLayer) {
        this.clusterLayer.clearLayers();
        this.map.removeLayer(this.clusterLayer);
        this.clusterLayer = null;
      }
    }
    
    // ✅ Clear canvas renderer
    this.canvasRenderer = null;
    
    // ✅ Complete subjects
    this.loadingStateSubject.complete();
    
    // ✅ Clear references
    this.map = null;
    this.L = null;
    
    // ✅ Force garbage collection
    if (window.gc) {
      window.gc();
    }
    
    console.log('🚀 VesselService cleanup completed - Memory optimized with data aging');
  }
}
