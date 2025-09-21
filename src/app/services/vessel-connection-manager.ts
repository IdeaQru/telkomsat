// src/services/vessel-connection-manager.ts - FIXED
import { Injectable, NgZone } from '@angular/core';
import { Subscription } from 'rxjs';
import { VesselWebSocketService, Vessel, ConnectionStats } from './vessel-websocket.service';
import { VesselLoadingManager } from './vessel-loading-manager';
import { VesselMarkerManager } from './vessel-marker-manager';

export class VesselConnectionManager {
  // ✅ WebSocket Subscriptions
  private vesselUpdatesSubscription!: Subscription;
  private connectionStatusSubscription!: Subscription;
  private connectionStatsSubscription!: Subscription;
  private loadingCompleteSubscription!: Subscription;
  
  private connectionRetryTimeout: any;
  private markerManager: VesselMarkerManager | null = null;
  private updateCallback: ((vessels: Vessel[]) => void) | null = null;

  constructor(
    private webSocketService: VesselWebSocketService,
    private loadingManager: VesselLoadingManager,
    private zone: NgZone
  ) {
    console.log('🔗 VesselConnectionManager initialized');
  }

  /**
   * 🔗 Set marker manager reference
   */
  public setMarkerManager(markerManager: VesselMarkerManager): void {
    this.markerManager = markerManager;
  }

  /**
   * 📞 Set update callback
   */
  public setUpdateCallback(callback: (vessels: Vessel[]) => void): void {
    this.updateCallback = callback;
  }

  /**
   * 📡 Setup all WebSocket subscriptions
   */
  public setupSubscriptions(): void {
    this.subscribeToVesselUpdates();
    this.subscribeToConnectionStatus();
    this.subscribeToConnectionStats();
    this.subscribeToLoadingComplete();
  }

  /**
   * 📊 Subscribe to real-time vessel updates
   */
  private subscribeToVesselUpdates(): void {
    this.vesselUpdatesSubscription = this.webSocketService.vesselUpdates$.subscribe({
      next: (vessels: Vessel[]) => {
        console.log(`[ConnectionManager] Real-time update: ${vessels.length} vessels received`);
        
        // ✅ Call update callback
        if (this.updateCallback) {
          this.updateCallback(vessels);
        }
      },
      error: (err) => {
        console.error('[ConnectionManager] Error in vessel updates:', err);
        this.loadingManager.handleError(err);
      }
    });
  }

  /**
   * 🔗 Subscribe to WebSocket connection status
   */
  private subscribeToConnectionStatus(): void {
    this.connectionStatusSubscription = this.webSocketService.connectionStatus$.subscribe({
      next: (status: string) => {
        console.log(`[ConnectionManager] Connection status changed: ${status}`);
        
        this.zone.run(() => {
          switch (status) {
            case 'connecting':
              this.loadingManager.updateState({
                isLoading: true,
                message: 'Establishing real-time connection...',
                progress: 30,
                error: null
              });
              break;
              
            case 'connected':
              // ✅ FIXED: Safe access to loadingManager current state
              const currentState = this.loadingManager.getCurrentState();
              this.loadingManager.updateState({
                isLoading: currentState.hasData ? false : true,
                message: currentState.hasData 
                  ? 'Real-time connection active' 
                  : 'Connected • Waiting for vessel data...',
                progress: currentState.hasData ? 100 : 80,
                error: null
              });
              
              // ✅ Clear any retry timeouts
              if (this.connectionRetryTimeout) {
                clearTimeout(this.connectionRetryTimeout);
                this.connectionRetryTimeout = null;
              }
              break;
              
            case 'disconnected':
              // ✅ FIXED: Safe access to markerManager and loadingManager
              const markerStats = this.markerManager?.getStats();
              const loadingState = this.loadingManager.getCurrentState();
              
              this.loadingManager.updateState({
                isLoading: false,
                message: 'Real-time connection lost',
                hasData: markerStats ? markerStats.totalVessels > 0 : false,
                lastUpdate: loadingState.lastUpdate,
                error: 'Connection to vessel tracking system lost. Attempting to reconnect...'
              });
              
              // ✅ Auto-retry connection
              this.scheduleReconnection();
              break;
              
            case 'error':
              this.loadingManager.updateState({
                isLoading: false,
                message: 'Connection failed',
                progress: 0,
                hasData: false,
                lastUpdate: null,
                error: 'Failed to connect to vessel tracking system. Please check your network connection.'
              });
              
              this.scheduleReconnection();
              break;

            case 'connected-rest':
            case 'fallback':
              // ✅ FIXED: Safe access to markerManager
              const fallbackStats = this.markerManager?.getStats();
              
              this.loadingManager.updateState({
                isLoading: false,
                message: 'Connected via REST API fallback',
                hasData: fallbackStats ? fallbackStats.totalVessels > 0 : false,
                error: null
              });
              break;
          }
        });
      },
      error: (err) => {
        console.error('[ConnectionManager] Connection status error:', err);
        this.handleConnectionError();
      }
    });
  }

  /**
   * 📊 Subscribe to connection statistics
   */
  private subscribeToConnectionStats(): void {
    this.connectionStatsSubscription = this.webSocketService.connectionStats$.subscribe({
      next: (stats: ConnectionStats) => {
        // ✅ FIXED: Safe access to loadingManager current state
        const currentState = this.loadingManager.getCurrentState();
        
        // ✅ Update loading state with connection info
        if (stats.connected && stats.vesselCount > 0 && !currentState.hasData) {
          this.zone.run(() => {
            this.loadingManager.updateState({
              isLoading: false,
              message: `${stats.vesselCount} vessels • ${stats.realTimeUpdates} real-time updates`,
              progress: 100,
              hasData: true,
              lastUpdate: new Date(),
              error: null
            });
          });
        }
        
        console.log('[ConnectionManager] Connection stats updated:', stats);
      }
    });
  }

  /**
   * 📊 Subscribe to loading complete events
   */
  private subscribeToLoadingComplete(): void {
    this.loadingCompleteSubscription = this.webSocketService.loadingComplete$.subscribe({
      next: (loadingInfo) => {
        // ✅ FIXED: Safe access to loadingManager current state
        const currentState = this.loadingManager.getCurrentState();
        
        if (loadingInfo.hasData && !currentState.hasData) {
          this.zone.run(() => {
            console.log('🚨 Loading complete event received');
            
            this.loadingManager.updateState({
              isLoading: false,
              message: 'Vessel data loaded successfully',
              progress: 100,
              hasData: true,
              lastUpdate: new Date(),
              error: null
            });
          });
        }
        
        if (loadingInfo.error) {
          this.loadingManager.handleError(loadingInfo.error);
        }
      }
    });
  }

  /**
   * 🔄 Schedule reconnection
   */
  private scheduleReconnection(): void {
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
    }
    
    this.connectionRetryTimeout = setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      this.webSocketService.connect();
    }, 5000); // Retry after 5 seconds
  }

  /**
   * ❌ Handle connection error
   */
  private handleConnectionError(): void {
    this.zone.run(() => {
      this.loadingManager.updateState({
        isLoading: false,
        message: 'Connection error',
        progress: 0,
        hasData: false,
        lastUpdate: null,
        error: 'Unable to establish connection. Please check your network and refresh the page.'
      });
    });
  }

  /**
   * 🧹 Cleanup
   */
  public cleanup(): void {
    console.log('🔗 VesselConnectionManager cleanup starting...');
    
    // ✅ Clear timeout
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
      this.connectionRetryTimeout = null;
    }
    
    // ✅ Unsubscribe from all WebSocket events
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
    
    console.log('🔗 VesselConnectionManager cleanup completed');
  }
}
