import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, combineLatest, interval, merge, EMPTY, BehaviorSubject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, filter, switchMap, tap, catchError, startWith } from 'rxjs/operators';

// Angular Material Imports
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

// Services
import { MapService } from '../services/map-service';
import { VesselService, VesselServiceStats } from '../services/vessel-service';
import { LoadingState } from '../services/optimized-marker-manager';
import { VtsService, VTS } from '../services/vts.service';
import { AtonService, AtoN } from '../services/aton.service';
import { VesselWebSocketService, ConnectionStats, Vessel } from '../services/vessel-websocket.service';

// Components
import { VesselLoadingComponent } from '../vessel-loading/vessel-loading';

// Interfaces
export interface MapComponentState {
  isInitialized: boolean;
  hasError: boolean;
  errorMessage?: string;
  dataLastUpdated: Date | null;
  performanceStats: {
    totalVessels: number;
    realTimeUpdates: number;
    connectionStatus: string;
    renderingTime: number;
  };
}

export interface UIState {
  loadingState: LoadingState;
  isConnected: boolean;
  connectionStats: ConnectionStats;
  vesselCount: number;
  vtsCount: number;
  atonCount: number;
}

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
    MatBadgeModule,
    MatTooltipModule,
    MatSnackBarModule,
    VesselLoadingComponent,
  ],
  templateUrl: './map.html',
  styleUrls: ['./map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('sidebar') sidebar!: MatSidenav;
  
  // ✅ SINGLE DESTROY SUBJECT for all subscriptions
  private readonly destroy$ = new Subject<void>();
  private readonly timeoutIds = new Set<number>();
  private readonly intervalIds = new Set<number>();
  
  // ✅ OPTIMIZED: Combined UI State Observable
  public readonly uiState$ = new BehaviorSubject<UIState>({
    loadingState: {
      isLoading: true,
      message: 'Initializing real-time vessel tracking...',
      progress: 0,
      hasData: false,
      lastUpdate: null,
      error: null
    },
    isConnected: false,
    connectionStats: {
      connected: false,
      reconnectAttempts: 0,
      vesselCount: 0,
      realTimeUpdates: 0
    },
    vesselCount: 0,
    vtsCount: 0,
    atonCount: 0
  });

  // ✅ COMPONENT STATE
  componentState: MapComponentState = {
    isInitialized: false,
    hasError: false,
    dataLastUpdated: null,
    performanceStats: {
      totalVessels: 0,
      realTimeUpdates: 0,
      connectionStatus: 'disconnected',
      renderingTime: 0
    }
  };

  // ✅ UI STATE (readonly getters from BehaviorSubject)
  get vesselCount(): number { return this.uiState$.value.vesselCount; }
  get vtsCount(): number { return this.uiState$.value.vtsCount; }
  get atonCount(): number { return this.uiState$.value.atonCount; }
  get isConnected(): boolean { return this.uiState$.value.isConnected; }
  get loadingState(): LoadingState { return this.uiState$.value.loadingState; }

  // ✅ UI CONTROLS
  sidebarOpen = false;
  statsMinimized = false;
  
  // ✅ VTS STATE
  vtsData: VTS[] = [];
  vtsLoading = false;
  vtsVisible = true;
  lastVtsUpdate: Date | null = null;
  vtsPollingEnabled = true;

  // ✅ ATON STATE  
  atonData: AtoN[] = [];
  atonLoading = false;
  atonVisible = true;
  lastAtonUpdate: Date | null = null;
  atonPollingEnabled = true;

  // ✅ PERFORMANCE STATS
  vesselServiceStats: VesselServiceStats = {
    totalVessels: 0,
    visibleMarkers: 0,
    clusteredMarkers: 0,
    realTimeUpdates: 0,
    connectionStatus: 'disconnected',
    lastUpdate: null,
    performance: {
      updateThrottle: 50,
      renderingTime: 0,
      memoryUsage: 'N/A'
    }
  };

  constructor(
    public mapService: MapService,
    public vesselService: VesselService,
    private webSocketService: VesselWebSocketService,
    private vtsService: VtsService,
    private atonService: AtonService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private snackBar: MatSnackBar
  ) {
    console.log('🚀 MapComponent constructor started with optimized architecture');
  }

  // ✅ OPTIMIZED: Safe setTimeout with cleanup tracking
  private safeSetTimeout(callback: () => void, delay: number): void {
    const timeoutId = window.setTimeout(() => {
      callback();
      this.timeoutIds.delete(timeoutId);
    }, delay);
    this.timeoutIds.add(timeoutId);
  }

  // ✅ OPTIMIZED: Safe setInterval with cleanup tracking
  private safeSetInterval(callback: () => void, delay: number): void {
    const intervalId = window.setInterval(callback, delay);
    this.intervalIds.add(intervalId);
  }

  // ✅ OPTIMIZED ngOnInit with single subscription pattern
  async ngOnInit() {
    console.log('🚀 MapComponent ngOnInit started with memory optimization');
    
    try {
      // ✅ 1. Initialize map first
      await this.mapService.initializeMap('map');
      console.log('🗺️ Map initialized successfully');

      // ✅ 2. Setup optimized subscriptions with single destroy subject
      this.setupOptimizedSubscriptions();
      
      // ✅ 3. Initialize data
      this.initializeMapData();

      // ✅ 4. Mark as initialized
      this.componentState.isInitialized = true;
      console.log('✅ MapComponent initialization complete with optimizations');
      
    } catch (error) {
      console.error('❌ Error in ngOnInit:', error);
      this.handleInitializationError(error);
    }
  }

  // ✅ OPTIMIZED: Single method for all subscriptions
  private setupOptimizedSubscriptions(): void {
    console.log('📡 Setting up optimized subscriptions with single destroy subject');

    // ✅ COMBINED: Loading state + Connection + Vessel updates
    const mainDataStream$ = combineLatest([
      this.vesselService.loadingState$,
      this.webSocketService.connectionStats$,
      this.webSocketService.connectionStatus$,
      this.webSocketService.vesselUpdates$.pipe(startWith([]))
    ]).pipe(
      debounceTime(100), // ✅ Prevent rapid fire updates
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    );

    mainDataStream$.subscribe(([loadingState, connectionStats, connectionStatus, vessels]) => {
      this.zone.run(() => {
        // ✅ Update UI state in single operation
        const currentState = this.uiState$.value;
        this.uiState$.next({
          ...currentState,
          loadingState: { ...loadingState },
          connectionStats: { ...connectionStats },
          isConnected: connectionStatus === 'connected',
          vesselCount: vessels.length
        });

        // ✅ Update component state
        this.componentState.dataLastUpdated = new Date();
        this.componentState.performanceStats.connectionStatus = connectionStatus;
        this.componentState.performanceStats.realTimeUpdates = connectionStats.realTimeUpdates;

        // ✅ Show connection notifications
        this.handleConnectionStatusChange(connectionStatus, currentState.isConnected);
        
        this.cdr.markForCheck();
      });
    });

    // ✅ VTS data subscription
    this.vtsService.vtsData$
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((vtsData: VTS[]) => {
        this.zone.run(() => {
          this.vtsData = vtsData;
          this.lastVtsUpdate = vtsData.length > 0 ? new Date() : null;
          
          // ✅ Update UI state
          const currentState = this.uiState$.value;
          this.uiState$.next({
            ...currentState,
            vtsCount: vtsData.length
          });

          console.log(`🏛️ VTS data updated: ${vtsData.length} stations`);
          this.cdr.markForCheck();
        });
      });

    // ✅ VTS loading state
    this.vtsService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading: boolean) => {
        this.zone.run(() => {
          this.vtsLoading = loading;
          this.cdr.markForCheck();
        });
      });

    // ✅ AtoN data subscription
    this.atonService.atonData$
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((atonData: AtoN[]) => {
        this.zone.run(() => {
          this.atonData = atonData;
          this.lastAtonUpdate = atonData.length > 0 ? new Date() : null;
          
          // ✅ Update UI state
          const currentState = this.uiState$.value;
          this.uiState$.next({
            ...currentState,
            atonCount: atonData.length
          });

          console.log(`⚓ AtoN data updated: ${atonData.length} stations`);
          this.cdr.markForCheck();
        });
      });

    // ✅ AtoN loading state
    this.atonService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading: boolean) => {
        this.zone.run(() => {
          this.atonLoading = loading;
          this.cdr.markForCheck();
        });
      });

    // ✅ OPTIMIZED: Single performance timer (instead of multiple timers)
    interval(10000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.zone.run(() => {
          // ✅ Update vessel service stats
          this.vesselServiceStats = this.vesselService.getVesselServiceStats();
          
          // ✅ Update performance stats
          this.componentState.performanceStats = {
            totalVessels: this.vesselServiceStats.totalVessels,
            realTimeUpdates: this.vesselServiceStats.realTimeUpdates,
            connectionStatus: this.vesselServiceStats.connectionStatus,
            renderingTime: this.vesselServiceStats.performance.renderingTime
          };

          // ✅ Update map legend counts
          this.updateMapLegendCounts();
          
          // ✅ Performance warning
          if (this.vesselServiceStats.performance.renderingTime > 1000) {
            console.warn('⚠️ High rendering time detected:', this.vesselServiceStats.performance.renderingTime + 'ms');
          }
          
          this.cdr.markForCheck();
        });
      });

    // ✅ Setup polling with optimized intervals
    this.setupOptimizedPolling();

    // ✅ WebSocket loading complete events
    this.webSocketService.loadingComplete$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loadingInfo) => {
        if (loadingInfo.hasData) {
          this.zone.run(() => {
            console.log('🚨 WebSocket loading complete event received');
            const currentState = this.uiState$.value;
            this.uiState$.next({
              ...currentState,
              loadingState: {
                ...currentState.loadingState,
                isLoading: false,
                hasData: true,
                lastUpdate: new Date(),
                error: null
              }
            });
            this.cdr.markForCheck();
          });
        }
      });
  }

  // ✅ OPTIMIZED: Polling without setTimeout memory leaks
  private setupOptimizedPolling(): void {
    // ✅ VTS polling with proper interval management
    interval(30000)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this.vtsPollingEnabled && this.isConnected)
      )
      .subscribe(() => {
        this.zone.run(() => {
          this.vtsLoading = true;
          this.vtsService.refreshVtsData();
          
          // ✅ Use safeSetTimeout instead of raw setTimeout
          this.safeSetTimeout(() => {
            this.zone.run(() => {
              this.vtsLoading = false;
              this.cdr.markForCheck();
            });
          }, 2000);
          
          this.cdr.markForCheck();
        });
      });

    // ✅ AtoN polling with proper interval management
    interval(30000)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this.atonPollingEnabled && this.isConnected)
      )
      .subscribe(() => {
        this.zone.run(() => {
          this.atonLoading = true;
          this.atonService.refreshAtonData();
          
          // ✅ Use safeSetTimeout instead of raw setTimeout
          this.safeSetTimeout(() => {
            this.zone.run(() => {
              this.atonLoading = false;
              this.cdr.markForCheck();
            });
          }, 2000);
          
          this.cdr.markForCheck();
        });
      });
  }

  // ✅ Handle connection status changes
  private handleConnectionStatusChange(status: string, wasConnected: boolean): void {
    const isNowConnected = status === 'connected';
    
    if (isNowConnected && !wasConnected) {
      this.showNotification('Real-time connection established', 'success');
      this.vtsPollingEnabled = true;
      this.atonPollingEnabled = true;
    } else if (!isNowConnected && wasConnected) {
      this.showNotification('Real-time connection lost', 'warning');
    }

    // ✅ Update loading state based on connection
    if (status === 'connecting') {
      const currentState = this.uiState$.value;
      this.uiState$.next({
        ...currentState,
        loadingState: {
          ...currentState.loadingState,
          message: 'Establishing real-time connection...',
          isLoading: true
        }
      });
    } else if (status === 'error') {
      const currentState = this.uiState$.value;
      this.uiState$.next({
        ...currentState,
        loadingState: {
          ...currentState.loadingState,
          message: 'Connection failed - retrying...',
          error: 'Unable to establish WebSocket connection'
        }
      });
    }
  }

  // ✅ Initialize map data
  private initializeMapData(): void {
    console.log('📡 Starting WebSocket connection for real-time vessel data');
    this.webSocketService.connect();
    
    // ✅ Load VTS data with delay
    this.safeSetTimeout(() => {
      console.log('🏛️ Loading VTS data...');
      this.vtsService.loadAndShowVtsMarkers();
    }, 2000);

    // ✅ Load AtoN data with delay
    this.safeSetTimeout(() => {
      console.log('⚓ Loading AtoN data...');
      this.atonService.loadAndShowAtonMarkers();
    }, 4000);
  }

  // ✅ Update map legend counts
  private updateMapLegendCounts(): void {
    this.mapService.updateLegendCounts(this.vesselCount, this.vtsCount, this.atonCount);
  }

  // ✅ Show notifications
  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    const config = {
      duration: type === 'error' ? 8000 : 3000,
      panelClass: [`snackbar-${type}`],
      verticalPosition: 'top' as const,
      horizontalPosition: 'right' as const
    };

    this.snackBar.open(message, 'Close', config);
  }

  // ✅ Error handlers
  private handleInitializationError(error: any): void {
    this.zone.run(() => {
      this.componentState.hasError = true;
      this.componentState.errorMessage = `Initialization failed: ${error.message || error}`;
      
      const currentState = this.uiState$.value;
      this.uiState$.next({
        ...currentState,
        loadingState: {
          isLoading: false,
          message: 'Initialization failed',
          progress: 0,
          hasData: false,
          lastUpdate: null,
          error: this.componentState.errorMessage
        }
      });
      
      this.showNotification('Map initialization failed', 'error');
      this.cdr.markForCheck();
    });
  }

  // ✅ NAVIGATION
  navigateToPOIArea(): void {
    console.log('📍 Navigating to POI Area page');
    window.location.href = '/poi-area';
  }

  // ✅ EVENT HANDLERS
  onRetryConnection(): void {
    console.log('🔄 Retry connection triggered');
    
    this.zone.run(() => {
      const currentState = this.uiState$.value;
      this.uiState$.next({
        ...currentState,
        loadingState: {
          isLoading: true,
          message: 'Retrying real-time connection...',
          progress: 0,
          hasData: false,
          lastUpdate: null,
          error: null
        }
      });
      
      this.componentState.hasError = false;
      this.componentState.errorMessage = undefined;
      
      this.cdr.markForCheck();
    });
    
    // ✅ Retry connections
    this.safeSetTimeout(() => {
      this.webSocketService.connect();
      this.refreshVtsData();
      this.refreshAtonData();
    }, 100);
  }

  // ✅ UI METHODS
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    
    if (this.sidebar) {
      this.sidebar.toggle();
      
      this.safeSetTimeout(() => {
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

  selectLayer(layerName: string): void {
    try {
      this.mapService.switchLayer(layerName);
      this.showNotification(`Layer switched to ${layerName}`, 'info');
      console.log(`🗺️ Switched to layer: ${layerName}`);
    } catch (error) {
      console.error('❌ Error switching layer:', error);
      this.showNotification('Layer switch failed', 'error');
    }
  }

  async onControlToggle(controlId: string, isEnabled: boolean): Promise<void> {
    try {
      await this.mapService.handleControlToggle(controlId, isEnabled);
      
      if (controlId === 'vts') {
        this.vtsVisible = isEnabled;
        this.vtsService.toggleVtsVisibility(isEnabled);
        if (isEnabled && this.isConnected) {
          this.vtsPollingEnabled = true;
        }
      }
      
      if (controlId === 'aton') {
        this.atonVisible = isEnabled;
        this.atonService.toggleAtonVisibility(isEnabled);
        if (isEnabled && this.isConnected) {
          this.atonPollingEnabled = true;
        }
      }
      
      this.showNotification(`${controlId.toUpperCase()} ${isEnabled ? 'enabled' : 'disabled'}`, 'info');
      console.log(`🎛️ Control ${controlId} toggled: ${isEnabled}`);
    } catch (error) {
      console.error('❌ Error toggling control:', error);
      this.showNotification('Control toggle failed', 'error');
    }
  }

  // ✅ VTS METHODS
  refreshVtsData(): void {
    console.log('🔄 Refreshing VTS data...');
    this.vtsService.refreshVtsData();
  }

  focusOnVts(vtsId: string): void {
    this.vtsService.focusOnVts(vtsId);
    this.showNotification(`Focused on VTS: ${vtsId}`, 'info');
  }

  toggleVtsVisibility(): void {
    this.vtsVisible = !this.vtsVisible;
    this.vtsService.toggleVtsVisibility(this.vtsVisible);
    
    if (this.vtsVisible && this.isConnected) {
      this.vtsPollingEnabled = true;
    }
    
    this.showNotification(`VTS visibility: ${this.vtsVisible ? 'ON' : 'OFF'}`, 'info');
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
    this.showNotification(`Focused on AtoN: ${atonId}`, 'info');
  }

  toggleAtonVisibility(): void {
    this.atonVisible = !this.atonVisible;
    this.atonService.toggleAtonVisibility(this.atonVisible);
    
    if (this.atonVisible && this.isConnected) {
      this.atonPollingEnabled = true;
    }
    
    this.showNotification(`AtoN visibility: ${this.atonVisible ? 'ON' : 'OFF'}`, 'info');
  }

  getAtonStatusSummary(): { active: number; inactive: number } {
    const active = this.atonData.filter(aton => aton.status === 'active').length;
    const inactive = this.atonData.filter(aton => aton.status === 'inactive').length;
    return { active, inactive };
  }

  // ✅ WEBSOCKET METHODS
  subscribeToVessel(mmsi: number): void {
    this.webSocketService.subscribeToVessel(mmsi);
    this.showNotification(`Tracking vessel ${mmsi}`, 'info');
  }

  subscribeToArea(bounds: { north: number; south: number; east: number; west: number }): void {
    this.webSocketService.subscribeToArea(bounds);
    this.showNotification('Area tracking enabled', 'info');
  }

  forceAggressiveCollection(): void {
    console.log('⚡ Triggering aggressive data collection');
    this.webSocketService.forceAggressiveCollection();
    this.showNotification('Aggressive data collection triggered', 'info');
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

  getRealtimeStats(): {
    connectionStatus: string;
    totalVessels: number;
    realTimeUpdates: number;
    connectedClients: number;
    uptime: string;
    memoryUsage: string;
  } {
    const stats = this.vesselServiceStats;
    const connectionUptime = this.uiState$.value.connectionStats.connectedAt 
      ? new Date().getTime() - this.uiState$.value.connectionStats.connectedAt.getTime()
      : 0;
    
    return {
      connectionStatus: stats.connectionStatus,
      totalVessels: stats.totalVessels,
      realTimeUpdates: stats.realTimeUpdates,
      connectedClients: this.uiState$.value.connectionStats.connected ? 1 : 0,
      uptime: this.formatDuration(connectionUptime),
      memoryUsage: stats.performance.memoryUsage
    };
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // ✅ DEBUG METHODS
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
      webSocketStats: this.uiState$.value.connectionStats,
      realTimeStats: this.getRealtimeStats(),
      loadingComplete: !this.loadingState.isLoading && this.loadingState.hasData,
      activeTimeouts: this.timeoutIds.size,
      activeIntervals: this.intervalIds.size
    });
  }

  refreshAllData(): void {
    console.log('🔄 Manual refresh all data');
    this.webSocketService.connect();
    this.refreshVtsData();
    this.refreshAtonData();
  }

  // ✅ OPTIMIZED CLEANUP with proper resource management
  ngOnDestroy(): void {
    console.log('🧹 MapComponent cleanup started with memory optimization');
    
    // ✅ Clear all timeouts
    this.timeoutIds.forEach(id => {
      clearTimeout(id);
    });
    this.timeoutIds.clear();
    console.log('✅ All timeouts cleared');
    
    // ✅ Clear all intervals
    this.intervalIds.forEach(id => {
      clearInterval(id);
    });
    this.intervalIds.clear();
    console.log('✅ All intervals cleared');
    
    // ✅ Complete UI state subject
    this.uiState$.complete();
    console.log('✅ UI state subject completed');
    
    // ✅ Complete destroy subject (this unsubscribes all subscriptions)
    this.destroy$.next();
    this.destroy$.complete();
    console.log('✅ All subscriptions unsubscribed via destroy subject');
    
    // ✅ Cleanup WebSocket service
    this.webSocketService.cleanup();
    console.log('✅ WebSocket service cleaned up');
    
    console.log('✅ MapComponent cleanup completed with zero memory leaks');
  }
}
