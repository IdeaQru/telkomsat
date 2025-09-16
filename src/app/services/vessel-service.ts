import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { Subscription, BehaviorSubject } from 'rxjs';
import { OptimizedMarkerManager, LoadingState, ViewportSettings } from './optimized-marker-manager';
import { VesselPopupService } from './vessel-pop-up.service';
import { TelkomsatApiService, Vessel } from './telkomsat-api-service';

@Injectable({
  providedIn: 'root'
})
export class VesselService implements OnDestroy {
  private map: any;
  private L: any;
  private vesselLayer: any;
  private clusterLayer: any;
  private updatesSubscription!: Subscription;
  private connectionSubscription!: Subscription;
  private loadingCompleteSubscription!: Subscription;
  
  // ✅ OPTIMIZED MARKER MANAGER dengan Supercluster
  private optimizedManager: OptimizedMarkerManager | null = null;
  
  canvasRenderer: any;

  // ✅ LOADING STATE MANAGEMENT
  private loadingStateSubject = new BehaviorSubject<LoadingState>({
    isLoading: true,
    message: 'Connecting to Telkomsat satellite network...',
    progress: 0,
    hasData: false,
    lastUpdate: null,
    error: null
  });

  public loadingState$ = this.loadingStateSubject.asObservable();
  private loadingTimeout: any;
  private firstDataReceived = false;

  constructor(
    private telkomsatApiService: TelkomsatApiService,
    private vesselPopupService: VesselPopupService, // ✅ Inject popup service
    private zone: NgZone
  ) {
    this.startLoadingSequence();
  }

  // ✅ Telkomsat-specific loading sequence
  private startLoadingSequence(): void {
    const loadingSteps = [
      { message: 'Connecting to Telkomsat AIS API...', progress: 10 },
      { message: 'Authenticating with satellite network...', progress: 25 },
      { message: 'Initializing Supercluster engine...', progress: 40 },
      { message: 'Processing AIS transponder data...', progress: 60 },
      { message: 'Optimizing viewport manager...', progress: 75 },
      { message: 'Loading maritime traffic from Indonesia waters...', progress: 90 }
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
    }, 600);

    this.loadingTimeout = setTimeout(() => {
      if (!this.firstDataReceived) {
        this.updateLoadingState({
          isLoading: false,
          message: 'No vessel data available from satellite',
          progress: 0,
          hasData: false,
          lastUpdate: null,
          error: 'Unable to connect to Telkomsat satellite network. Please check your connection.'
        });
      }
    }, 15000);
  }

  private updateLoadingState(newState: Partial<LoadingState>): void {
    this.zone.run(() => {
      const currentState = this.loadingStateSubject.value;
      this.loadingStateSubject.next({ ...currentState, ...newState });
    });
  }

  // ✅ Initialize method dengan Supercluster
  public initialize(map: any, L: any): void {
    this.map = map;
    this.L = L;
    
    // Canvas renderer untuk performa optimal
    this.canvasRenderer = this.L.canvas({ padding: 0.5 });
    
    // Create optimized layer groups
    this.vesselLayer = this.L.layerGroup().addTo(this.map);
    this.clusterLayer = this.L.layerGroup().addTo(this.map);
    
    // ✅ Initialize OptimizedMarkerManager dengan Supercluster
    this.optimizedManager = new OptimizedMarkerManager(
      this.map,
      this.L,
      this.vesselLayer,
      this.clusterLayer,
      this,
      this.zone
    );

    // ✅ SET POPUP SERVICE ke manager
    this.optimizedManager.setPopupService(this.vesselPopupService);
    
    // ✅ Configure optimal settings untuk satellite data
    this.optimizedManager.setSettings({
      updateThrottle: 50,
      maxVisibleMarkers: 1500,
      maxClusters: 300,
      clusterRadius: 45,
      viewportPadding: 0.2
    });
    
    // ✅ START API POLLING
    this.telkomsatApiService.startPolling();
    
    this.subscribeToVesselUpdates();
    this.subscribeToConnectionStatus();
    
    console.log('🚀 VesselService initialized with Supercluster integration');
    console.log('📊 Supercluster optimizer stats:', this.optimizedManager.getStats());
  }

  // ✅ Subscribe to vessel updates
// ✅ PERBAIKAN di subscribeToVesselUpdates method
// ✅ CRITICAL FIX: vessel.service.ts - Force hide loading when data received
private subscribeToVesselUpdates(): void {
  this.updatesSubscription = this.telkomsatApiService.vesselUpdates$.subscribe({
    next: (vessels: Vessel[]) => {
      console.log(`[VesselService] Received ${vessels.length} vessels from Telkomsat API`);
      
      // ✅ IMMEDIATE FORCE HIDE LOADING when vessels > 0
      if (vessels.length > 0) {
        this.zone.run(() => {
          console.log('🚨 FORCE HIDING LOADING - Data received:', vessels.length);
          
          // ✅ CRITICAL: Update loading state immediately
          this.firstDataReceived = true;
          if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
          }

          // ✅ FORCE UPDATE loading state with explicit values
          this.loadingStateSubject.next({
            isLoading: false,           // ✅ EXPLICIT FALSE
            message: `${vessels.length} vessels loaded successfully`,
            progress: 100,
            hasData: true,              // ✅ EXPLICIT TRUE
            lastUpdate: new Date(),
            error: null
          });

          // ✅ TRIPLE EMIT to ensure change detection
          setTimeout(() => {
            this.loadingStateSubject.next({
              isLoading: false,
              message: `${vessels.length} vessels active`,
              progress: 100,
              hasData: true,
              lastUpdate: new Date(),
              error: null
            });
          }, 10);
        });
      }
      
      if (this.optimizedManager) {
        this.optimizedManager.updateVessels(vessels);
      }
    },
    error: (err) => {
      console.error('[VesselService] Error receiving vessel updates:', err);
      this.handleUpdateError();
    }
  });
}



  private subscribeToConnectionStatus(): void {
    this.connectionSubscription = this.telkomsatApiService.connectionStatus$.subscribe({
      next: (status: string) => {
        if (status === 'connected') {
          this.updateLoadingState({
            isLoading: true,
            message: 'Satellite connection established, loading Supercluster...',
            progress: 95,
            hasData: false,
            lastUpdate: null,
            error: null
          });
        } else if (status === 'disconnected') {
          this.updateLoadingState({
            isLoading: false,
            message: 'Satellite connection lost',
            progress: 0,
            hasData: this.optimizedManager?.getStats().totalVessels > 0,
            lastUpdate: this.loadingStateSubject.value.lastUpdate,
            error: 'Lost connection to Telkomsat satellite network'
          });
        }
      }
    });
  }

  private handleUpdateError(): void {
    this.updateLoadingState({
      isLoading: false,
      message: 'Satellite connection error',
      progress: 0,
      hasData: false,
      lastUpdate: null,
      error: 'Failed to receive vessel data from satellite. Retrying...'
    });
    
    setTimeout(() => {
      this.startLoadingSequence();
      this.firstDataReceived = false;
    }, 10000);
  }

  // ✅ CREATE VESSEL MARKER (simplified - popup handled by service)
  public createVesselMarker(vessel: Vessel): any {
    try {
      const rotation = vessel.heading ?? vessel.course ?? 0;
      const iconColor = this.getVesselIconColor(vessel);
      
      const vesselHtml = `
        <div class="vessel-icon vessel-${iconColor}" 
             style="transform: rotate(${rotation}deg);"
             data-mmsi="${vessel.mmsi}"
             title="${vessel.name || `MMSI: ${vessel.mmsi}`}">
          <div class="arrow-shape"></div>
        </div>
      `;

      const vesselIcon = this.L.divIcon({
        html: vesselHtml,
        className: 'custom-vessel-marker optimized',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      });

      const marker = this.L.marker([vessel.latitude, vessel.longitude], {
        icon: vesselIcon,
        title: vessel.name || `MMSI: ${vessel.mmsi}`,
        renderer: this.canvasRenderer
      });

      // ✅ USE POPUP SERVICE to bind popup
      this.vesselPopupService.bindPopupToMarker(marker, vessel, this.L, 'vessel');
      marker.vesselData = vessel;

      marker.on('click', (e: any) => {
        this.L.DomEvent.stopPropagation(e);
      });

      return marker;
    } catch (error) {
      console.error('Error creating vessel marker:', error);
      return null;
    }
  }

  // ✅ Helper methods (dipertahankan)
  private getVesselIconColor(vessel: Vessel): string {
    const vesselType = vessel.vesselType;
    
    if (vesselType >= 80 && vesselType <= 89) return 'tanker';       
    if (vesselType >= 70 && vesselType <= 79) return 'cargo';        
    if (vesselType >= 60 && vesselType <= 69) return 'passenger';    
    if (vesselType >= 40 && vesselType <= 49) return 'highspeed';    
    if (vesselType >= 50 && vesselType <= 59) return 'special';      
    if (vesselType === 30) return 'fishing';      
    if (vesselType >= 31 && vesselType <= 39) return 'special';      
    if (vesselType >= 20 && vesselType <= 29) return 'wing';         
    if (vesselType >= 1 && vesselType <= 19) return 'reserved';     
    return 'unknown';      
  }

  // ✅ PUBLIC API METHODS
  public refreshVesselData(): void {
    this.firstDataReceived = false;
    this.startLoadingSequence();
    this.telkomsatApiService.requestAllVessels();
  }

  public getCurrentLoadingState(): LoadingState {
    return this.loadingStateSubject.value;
  }

  public getVesselCount(): number {
    return this.optimizedManager?.getStats().totalVessels || 0;
  }

  public isApiConnected(): boolean {
    return this.telkomsatApiService.isConnected();
  }

  public getViewportStats(): any {
    return this.optimizedManager?.getStats() || null;
  }

  public setPollingInterval(intervalMs: number): void {
    this.telkomsatApiService.setPollingInterval(intervalMs);
  }

  public setOptimizationLevel(level: 'ultra' | 'high' | 'medium' | 'low'): void {
    if (!this.optimizedManager) return;

    const settings: { [key: string]: Partial<ViewportSettings> } = {
      ultra: {
        updateThrottle: 30,
        maxVisibleMarkers: 2000,
        maxClusters: 400,
        clusterRadius: 40,
        viewportPadding: 0.1
      },
      high: {
        updateThrottle: 50,
        maxVisibleMarkers: 1500,
        maxClusters: 300,
        clusterRadius: 45,
        viewportPadding: 0.2
      },
      medium: {
        updateThrottle: 100,
        maxVisibleMarkers: 1000,
        maxClusters: 200,
        clusterRadius: 50,
        viewportPadding: 0.3
      },
      low: {
        updateThrottle: 200,
        maxVisibleMarkers: 500,
        maxClusters: 100,
        clusterRadius: 60,
        viewportPadding: 0.4
      }
    };

    this.optimizedManager.setSettings(settings[level]);
    console.log(`🚀 Supercluster optimization level set to: ${level.toUpperCase()}`);
  }

  // ✅ NEW: Access popup service for external use
  public getPopupService(): VesselPopupService {
    return this.vesselPopupService;
  }

  // ✅ NEW: Update marker rotation (delegated from manager)
  public updateMarkerRotation(marker: any, vessel: Vessel): void {
    const rotation = vessel.heading ?? vessel.course ?? 0;
    if (marker._icon) {
      const vesselIcon = marker._icon.querySelector('.vessel-icon');
      if (vesselIcon) {
        vesselIcon.style.transform = `rotate(${rotation}deg)`;
      }
    }
  }

  // ✅ CLEANUP
  public cleanup(): void {
    console.log('🚀 Starting Supercluster VesselService cleanup...');
    
    if (this.updatesSubscription) {
      this.updatesSubscription.unsubscribe();
    }
    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
    }
    if (this.loadingCompleteSubscription) {
      this.loadingCompleteSubscription.unsubscribe();
    }
    
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    
    this.telkomsatApiService.cleanup();
    
    if (this.optimizedManager) {
      this.optimizedManager.cleanup();
    }
    
    if (this.map && this.vesselLayer) {
      this.vesselLayer.clearLayers();
      this.map.removeLayer(this.vesselLayer);
    }
    
    if (this.map && this.clusterLayer) {
      this.clusterLayer.clearLayers();
      this.map.removeLayer(this.clusterLayer);
    }
    
    this.loadingStateSubject.complete();
    
    console.log('🚀 Supercluster VesselService fully cleaned up');
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
