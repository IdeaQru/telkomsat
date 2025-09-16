import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subscription, catchError, filter, interval, startWith, switchMap, Observable } from 'rxjs';

// Angular Material Imports
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';

// Services
import { MapService } from '../services/map-service';
import { VesselService } from '../services/vessel-service';
import { LoadingState } from '../services/optimized-marker-manager';
import { VtsService, VTS } from '../services/vts.service';
import { AtonService, AtoN } from '../services/aton.service';
import { VesselLoadingComponent } from '../vessel-loading/vessel-loading';
import { TelkomsatApiService } from '../services/telkomsat-api-service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatExpansionModule,
    VesselLoadingComponent,
  ],
  templateUrl: './map.html',
  styleUrls: ['./map.scss']
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('sidebar') sidebar!: MatSidenav;
  
  // ✅ STATE MANAGEMENT
  loadingState: LoadingState = {
    isLoading: true,
    message: 'Initializing...',
    progress: 0,
    hasData: false,
    lastUpdate: null,
    error: null
  };

  vesselCount = 0;
  vtsCount = 0;
  atonCount = 0;
  isConnected = false;
  sidebarOpen = false;
  statsMinimized = false;

  // ✅ VTS STATE
  vtsData: VTS[] = [];
  vtsLoading = false;
  vtsVisible = true;
  lastVtsUpdate: Date | null = null;

  // ✅ ATON STATE
  atonData: AtoN[] = [];
  atonLoading = false;
  atonVisible = true;
  lastAtonUpdate: Date | null = null;

  // ✅ SUBSCRIPTIONS & TIMERS
  private connectionSubscription?: Subscription;
  private vtsSubscription?: Subscription;
  private atonSubscription?: Subscription;
  private syncTimer?: Subscription;
  private vtsPollingTimer?: Subscription;
  private atonPollingTimer?: Subscription;
  
  // ✅ POLLING INTERVALS (changeable)
  private vtsPollingInterval = 30000; // 30 detik
  private atonPollingInterval = 30000; // 30 detik
  
  // ✅ POLLING CONTROLS
  vtsPollingEnabled = true;
  atonPollingEnabled = true;

  constructor(
    public mapService: MapService,
    public vesselService: VesselService, // ✅ PUBLIC for template access

    private vtsService: VtsService,
    private atonService: AtonService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private telkomsatApi: TelkomsatApiService
  ) {}

  // Modifikasi ngOnInit untuk include polling setup
  async ngOnInit() {
    console.log('🚀 MapComponent ngOnInit started');
    
    try {
      // ✅ 1. Initialize map first
      await this.mapService.initializeMap('map');
      console.log('🗺️ Map initialized successfully');

      // ✅ 2. Setup all subscriptions
      this.setupConnectionMonitoring();
      this.setupVtsSubscription();
      this.setupAtonSubscription();
      this.setupSyncTimer();
      
      // ✅ 3. Setup polling for VTS and AtoN
      this.setupVtsPolling();
      this.setupAtonPolling();

      // ✅ 4. Initialize data dengan sequential loading
      this.initializeMapData();

      console.log('✅ MapComponent initialization complete');
      
    } catch (error) {
      console.error('❌ Error in ngOnInit:', error);
      this.handleInitializationError(error);
    }
  }

  // ✅ SETUP VTS POLLING dengan auto-refresh
  private setupVtsPolling(): void {
    this.vtsPollingTimer = interval(this.vtsPollingInterval)
      .pipe(
        startWith(0), // Immediate first call
        filter(() => this.vtsPollingEnabled), // Only poll when enabled
       
        catchError(error => {
          console.error('❌ VTS polling error:', error);
          // Return empty observable to continue polling
          return EMPTY;
        })
      )
      .subscribe({
        next: () => {
          console.log('✅ VTS polling completed successfully');
        },
        error: (error) => {
          console.error('❌ VTS polling subscription error:', error);
        }
      });
  }
  private updateCounts(): void {
    this.vesselCount = this.vesselService.getVesselCount();
    this.vtsCount = this.vtsService.getVtsCount();
    this.atonCount = this.atonService.getAtonCount();
    
    // ✅ UPDATE LEGEND COUNTS
    this.mapService.updateLegendCounts(this.vesselCount, this.vtsCount, this.atonCount);
  }
  // ✅ SETUP ATON POLLING dengan auto-refresh
  private setupAtonPolling(): void {
    this.atonPollingTimer = interval(this.atonPollingInterval)
      .pipe(
        startWith(0), // Immediate first call
        filter(() => this.atonPollingEnabled), // Only poll when enabled
      
        catchError(error => {
          console.error('❌ AtoN polling error:', error);
          // Return empty observable to continue polling
          return EMPTY;
        })
      )
      .subscribe({
        next: () => {
          console.log('✅ AtoN polling completed successfully');
        },
        error: (error) => {
          console.error('❌ AtoN polling subscription error:', error);
        }
      });
  }

  // ✅ ADVANCED POLLING CONTROLS
  startVtsPolling(): void {
    if (!this.vtsPollingEnabled) {
      this.vtsPollingEnabled = true;
      console.log('🏛️ VTS polling enabled');
    }
  }

  stopVtsPolling(): void {
    this.vtsPollingEnabled = false;
    console.log('🏛️ VTS polling disabled');
  }

  startAtonPolling(): void {
    if (!this.atonPollingEnabled) {
      this.atonPollingEnabled = true;
      console.log('⚓ AtoN polling enabled');
    }
  }

  stopAtonPolling(): void {
    this.atonPollingEnabled = false;
    console.log('⚓ AtoN polling disabled');
  }

  // ✅ DYNAMIC POLLING INTERVAL CONTROL
  updateVtsPollingInterval(newInterval: number): void {
    if (this.vtsPollingTimer) {
      this.vtsPollingTimer.unsubscribe();
    }
    this.vtsPollingInterval = newInterval;
    this.setupVtsPolling();
    console.log(`🏛️ VTS polling interval updated to ${newInterval}ms`);
  }

  updateAtonPollingInterval(newInterval: number): void {
    if (this.atonPollingTimer) {
      this.atonPollingTimer.unsubscribe();
    }
    this.atonPollingInterval = newInterval;
    this.setupAtonPolling();
    console.log(`⚓ AtoN polling interval updated to ${newInterval}ms`);
  }

  // ✅ ENHANCED VISIBILITY TOGGLES dengan polling consideration
  toggleVtsVisibility(): void {
    this.vtsVisible = !this.vtsVisible;
    this.vtsService.toggleVtsVisibility(this.vtsVisible);
    
    // Auto-start polling when visibility is turned on
    if (this.vtsVisible) {
      this.startVtsPolling();
    }
    
    console.log(`🏛️ VTS visibility: ${this.vtsVisible ? 'ON' : 'OFF'}`);
  }

  toggleAtonVisibility(): void {
    this.atonVisible = !this.atonVisible;
    this.atonService.toggleAtonVisibility(this.atonVisible);
    
    // Auto-start polling when visibility is turned on
    if (this.atonVisible) {
      this.startAtonPolling();
    }
    
    console.log(`⚓ AtoN visibility: ${this.atonVisible ? 'ON' : 'OFF'}`);
  }

  // ✅ MANUAL FORCE REFRESH yang tidak mengganggu polling
  forceRefreshVts(): void {
    console.log('🔄 Force refreshing VTS data...');
    this.vtsService.refreshVtsData();
  }

  forceRefreshAton(): void {
    console.log('🔄 Force refreshing AtoN data...');
    this.atonService.refreshAtonData();
  }

  // ✅ POLLING STATUS INDICATORS
  getVtsPollingStatus(): { enabled: boolean; nextUpdate: string; interval: number } {
    return {
      enabled: this.vtsPollingEnabled,
      nextUpdate: this.calculateNextUpdate(this.vtsPollingInterval),
      interval: this.vtsPollingInterval / 1000 // in seconds
    };
  }

  getAtonPollingStatus(): { enabled: boolean; nextUpdate: string; interval: number } {
    return {
      enabled: this.atonPollingEnabled,
      nextUpdate: this.calculateNextUpdate(this.atonPollingInterval),
      interval: this.atonPollingInterval / 1000 // in seconds
    };
  }

  private calculateNextUpdate(interval: number): string {
    const next = new Date(Date.now() + interval);
    return next.toLocaleTimeString('id-ID');
  }

  // ✅ INITIALIZE MAP DATA dengan proper timing
  private initializeMapData(): void {
    // Load VTS data setelah map ready
    setTimeout(() => {
      console.log('🏛️ Loading VTS data...');
      this.vtsService.loadAndShowVtsMarkers();
    }, 2000);

    // Load AtoN data setelah VTS dengan delay lebih lama
    setTimeout(() => {
      console.log('⚓ Loading AtoN data...');
      this.atonService.loadAndShowAtonMarkers();
    }, 4000);

    // Update counts secara berkala
    this.updateCounts();
  }

  // ✅ SETUP LOADING STATE SUBSCRIPTION

  // ✅ SETUP CONNECTION MONITORING
  private setupConnectionMonitoring(): void {
    this.connectionSubscription = this.telkomsatApi.connectionStatus$?.subscribe({
      next: (status: string) => {
        this.zone.run(() => {
          this.isConnected = (status === 'connected');
          
          // Enable/disable polling based on connection status
          if (this.isConnected) {
            this.vtsPollingEnabled = true;
            this.atonPollingEnabled = true;
            console.log('🔌 Connection restored - polling enabled');
          } else {
            console.log('🔌 Connection lost - continuing polling for reconnection');
          }
          
          console.log(`🔌 Connection status updated: ${status} (${this.isConnected})`);
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('❌ Connection monitoring error:', error);
      }
    });

    this.isConnected = this.vesselService.isApiConnected();
  }

  // ✅ SETUP VTS SUBSCRIPTION
  private setupVtsSubscription(): void {
    this.vtsSubscription = this.vtsService.vtsData$.subscribe({
      next: (vtsData: VTS[]) => {
        this.zone.run(() => {
          this.vtsData = vtsData;
          this.vtsCount = vtsData.length;
          this.lastVtsUpdate = vtsData.length > 0 ? new Date() : null;
          
          console.log(`🏛️ VTS data updated: ${this.vtsCount} stations`);
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('❌ VTS subscription error:', error);
      }
    });

    // Subscribe to VTS loading state
    this.vtsService.loading$.subscribe({
      next: (loading: boolean) => {
        this.zone.run(() => {
          this.vtsLoading = loading;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ✅ SETUP ATON SUBSCRIPTION
  private setupAtonSubscription(): void {
    this.atonSubscription = this.atonService.atonData$.subscribe({
      next: (atonData: AtoN[]) => {
        this.zone.run(() => {
          this.atonData = atonData;
          this.atonCount = atonData.length;
          this.lastAtonUpdate = atonData.length > 0 ? new Date() : null;
          
          console.log(`⚓ AtoN data updated: ${this.atonCount} stations`);
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('❌ AtoN subscription error:', error);
      }
    });

    // Subscribe to AtoN loading state
    this.atonService.loading$.subscribe({
      next: (loading: boolean) => {
        this.zone.run(() => {
          this.atonLoading = loading;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ✅ SETUP SYNC TIMER
  private setupSyncTimer(): void {
    this.syncTimer = interval(10000).subscribe(() => {
      this.zone.run(() => {
        this.updateCounts();
        
        // Sync loading state jika diperlukan
        const serviceState = this.vesselService.getCurrentLoadingState();
        const componentState = this.loadingState;
        
        if (serviceState && componentState) {
          this.loadingState = {
            ...componentState,
            isLoading: serviceState.isLoading,
            message: serviceState.message,
            progress: serviceState.progress,
            hasData: serviceState.hasData,
            lastUpdate: serviceState.lastUpdate ? new Date(serviceState.lastUpdate) : null,
            error: serviceState.error
          };
          this.cdr.detectChanges();
        }
      });
    });
  }

  // ✅ UPDATE COUNTS


  // ✅ ERROR HANDLERS
  private handleInitializationError(error: any): void {
    this.zone.run(() => {
      this.loadingState = {
        isLoading: false,
        message: 'Initialization failed',
        progress: 0,
        hasData: false,
        lastUpdate: null,
        error: `Failed to initialize: ${error.message || error}`
      };
      this.cdr.detectChanges();
    });
  }

  private handleLoadingStateError(error: any): void {
    this.zone.run(() => {
      this.loadingState = {
        isLoading: false,
        message: 'State synchronization error',
        progress: 0,
        hasData: false,
        lastUpdate: null,
        error: `Sync failed: ${error.message || error}`
      };
      this.cdr.detectChanges();
    });
  }

  // ✅ LOADING EVENT HANDLERS
  onRetryConnection(): void {
    console.log('🔄 Retry connection triggered');
    
    this.zone.run(() => {
      this.loadingState = {
        isLoading: true,
        message: 'Retrying connection...',
        progress: 0,
        hasData: false,
        lastUpdate: null,
        error: null
      };
      this.cdr.detectChanges();
    });
    
    setTimeout(() => {
      this.vesselService.refreshVesselData();
      this.refreshVtsData();
      this.refreshAtonData();
    }, 100);
  }

  onRefreshData(): void {
    console.log('🔍 Refresh all data triggered');
    this.vesselService.refreshVesselData();
    this.refreshVtsData();
    this.refreshAtonData();
  }

  // ✅ VTS METHODS
  refreshVtsData(): void {
    console.log('🔄 Refreshing VTS data...');
    this.vtsService.refreshVtsData();
  }

  focusOnVts(vtsId: string): void {
    this.vtsService.focusOnVts(vtsId);
    console.log(`🎯 Focused on VTS: ${vtsId}`);
  }

  getVtsStatusSummary(): { active: number; inactive: number } {
    const active = this.vtsData.filter(vts => vts.status === 'active').length;
    const inactive = this.vtsData.filter(vts => vts.status === 'inactive').length;
    return { active, inactive };
  }

  // ✅ ATON METHODS
  refreshAtonData(): void {
    console.log('🔄 Refreshing AtoN data...');
    this.atonService.refreshAtonData();
  }

  focusOnAton(atonId: string): void {
    this.atonService.focusOnAton(atonId);
    console.log(`🎯 Focused on AtoN: ${atonId}`);
  }

  getAtonStatusSummary(): { active: number; inactive: number } {
    const active = this.atonData.filter(aton => aton.status === 'active').length;
    const inactive = this.atonData.filter(aton => aton.status === 'inactive').length;
    return { active, inactive };
  }

  // ✅ SIDEBAR MANAGEMENT
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    
    if (this.sidebar) {
      this.sidebar.toggle();
      
      setTimeout(() => {
        try {
          this.mapService.resizeMap();
        } catch (error) {
          console.warn('Map resize warning:', error);
        }
      }, 300);
    }
  }

  toggleStatsPanel(): void {
    this.statsMinimized = !this.statsMinimized;
  }

  // ✅ MAP CONTROLS
  selectLayer(layerName: string): void {
    try {
      this.mapService.switchLayer(layerName);
      console.log(`🗺️ Switched to layer: ${layerName}`);
    } catch (error) {
      console.error('❌ Error switching layer:', error);
    }
  }

  async onControlToggle(controlId: string, isEnabled: boolean): Promise<void> {
    try {
      await this.mapService.handleControlToggle(controlId, isEnabled);
      
      // ✅ HANDLE VTS CONTROL TOGGLE
      if (controlId === 'vts') {
        this.vtsVisible = isEnabled;
        this.vtsService.toggleVtsVisibility(isEnabled);
        
        // Auto-control polling based on visibility
        if (isEnabled) {
          this.startVtsPolling();
        }
      }
      
      // ✅ HANDLE ATON CONTROL TOGGLE
      if (controlId === 'aton') {
        this.atonVisible = isEnabled;
        this.atonService.toggleAtonVisibility(isEnabled);
        
        // Auto-control polling based on visibility
        if (isEnabled) {
          this.startAtonPolling();
        }
      }
      
      console.log(`🎛️ Control ${controlId} toggled: ${isEnabled}`);
    } catch (error) {
      console.error('❌ Error toggling control:', error);
    }
  }

  // ✅ UTILITY METHODS
  getLayerDescription(layerName: string): string {
    const descriptions: Record<string, string> = {
      'OpenStreetMap': 'Peta standar dengan detail lengkap',
      'Satellite': 'Citra satelit beresolusi tinggi',
      'Dark': 'Mode gelap untuk tampilan malam',
      'Ocean': 'Fokus pada wilayah perairan',
      'Terrain': 'Peta topografi dan relief',
      'Street': 'Peta jalan dan navigasi'
    };
    return descriptions[layerName] || 'Layer peta khusus';
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // ✅ MAP ZOOM CONTROLS
  zoomIn(): void {
    try {
      const map = this.mapService.getMap();
      if (map) {
        map.zoomIn();
        console.log('🔍 Zoom in triggered');
      }
    } catch (error) {
      console.warn('Zoom in warning:', error);
    }
  }

  zoomOut(): void {
    try {
      const map = this.mapService.getMap();
      if (map) {
        map.zoomOut();
        console.log('🔍 Zoom out triggered');
      }
    } catch (error) {
      console.warn('Zoom out warning:', error);
    }
  }

  // ✅ DEBUGGING METHODS (simplified)
  logDebugInfo(): void {
    console.log('🐛 Map Debug Info:', {
      vessels: this.vesselCount,
      vts: { 
        count: this.vtsCount, 
        visible: this.vtsVisible, 
        loading: this.vtsLoading,
        polling: this.vtsPollingEnabled 
      },
      aton: { 
        count: this.atonCount, 
        visible: this.atonVisible, 
        loading: this.atonLoading,
        polling: this.atonPollingEnabled
      },
      connected: this.isConnected,
      loadingComplete: !this.loadingState.isLoading && this.loadingState.hasData
    });
  }

  // ✅ MANUAL CONTROLS untuk testing marker visibility
  testAllMarkers(): void {
    console.log('🧪 Testing all markers visibility...');
    console.log('Vessels:', this.vesselCount, 'markers');
    console.log('VTS:', this.vtsCount, 'markers, visible:', this.vtsVisible, 'polling:', this.vtsPollingEnabled);
    console.log('AtoN:', this.atonCount, 'markers, visible:', this.atonVisible, 'polling:', this.atonPollingEnabled);
    
    // Force map refresh
    const map = this.mapService.getMap();
    if (map) {
      map.invalidateSize();
      setTimeout(() => {
        map.invalidateSize();
      }, 1000);
    }
  }

  refreshAllData(): void {
    console.log('🔄 Manual refresh all data');
    this.vesselService.refreshVesselData();
    this.forceRefreshVts();
    this.forceRefreshAton();
  }

  // ✅ LIFECYCLE CLEANUP dengan polling timers
  ngOnDestroy(): void {
    console.log('🧹 MapComponent cleanup started');
    
    // Stop polling timers first
    if (this.vtsPollingTimer) {
      this.vtsPollingTimer.unsubscribe();
      console.log('✅ VTS polling timer cleaned up');
    }
    
    if (this.atonPollingTimer) {
      this.atonPollingTimer.unsubscribe();
      console.log('✅ AtoN polling timer cleaned up');
    }
    

    
    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
      console.log('✅ Connection subscription cleaned up');
    }
    
    if (this.vtsSubscription) {
      this.vtsSubscription.unsubscribe();
      console.log('✅ VTS subscription cleaned up');
    }
    
    if (this.atonSubscription) {
      this.atonSubscription.unsubscribe();
      console.log('✅ AtoN subscription cleaned up');
    }
    
    if (this.syncTimer) {
      this.syncTimer.unsubscribe();
      console.log('✅ Sync timer cleaned up');
    }
    
    console.log('✅ MapComponent cleanup completed');
  }
}
