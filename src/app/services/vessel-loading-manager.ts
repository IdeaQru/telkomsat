// src/services/vessel-loading-manager.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Vessel } from './vessel-websocket.service';

export interface LoadingState {
  isLoading: boolean;
  message: string;
  progress: number;
  hasData: boolean;
  lastUpdate: Date | null;
  error: string | null;
}

export class VesselLoadingManager {
  private loadingStateSubject = new BehaviorSubject<LoadingState>({
    isLoading: true,
    message: 'Initializing real-time vessel tracking...',
    progress: 0,
    hasData: false,
    lastUpdate: null,
    error: null
  });

  public loadingState$ = this.loadingStateSubject.asObservable();
  
  private loadingTimeout: any;
  private firstDataReceived = false;

  constructor(private zone: NgZone) {
    console.log('🔄 VesselLoadingManager initialized');
  }

  /**
   * 🚀 Start loading sequence
   */
  public startLoadingSequence(): void {
    const loadingSteps = [
      { message: 'Connecting to vessel tracking backend...', progress: 10 },
      { message: 'Establishing WebSocket connection...', progress: 25 },
      { message: 'Authenticating with AIS data stream...', progress: 40 },
      { message: 'Initializing MarkerCluster engine...', progress: 55 },
      { message: 'Processing real-time vessel data...', progress: 70 },
      { message: 'Optimizing viewport renderer...', progress: 85 },
      { message: 'Loading Indonesian maritime traffic...', progress: 95 }
    ];

    let currentStep = 0;
    
    const stepInterval = setInterval(() => {
      if (currentStep < loadingSteps.length && !this.firstDataReceived) {
        this.updateState({
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

    // ✅ Extended timeout for WebSocket connection
    this.loadingTimeout = setTimeout(() => {
      if (!this.firstDataReceived) {
        this.updateState({
          isLoading: false,
          message: 'No real-time data available',
          progress: 0,
          hasData: false,
          lastUpdate: null,
          error: 'Unable to establish connection to vessel tracking system. Please refresh to retry.'
        });
      }
    }, 20000); // 20 seconds timeout
  }

  /**
   * 🔄 Update loading state
   */
  public updateState(newState: Partial<LoadingState>): void {
    this.zone.run(() => {
      const currentState = this.loadingStateSubject.value;
      const updatedState = { ...currentState, ...newState };
      this.loadingStateSubject.next(updatedState);
      
      if (newState.isLoading !== undefined) {
        console.log(`🔄 Loading state changed: ${newState.isLoading ? 'LOADING' : 'COMPLETE'}`, updatedState);
      }
    });
  }

  /**
   * 📊 Handle data received
   */
  public handleDataReceived(vessels: Vessel[]): void {
    if (vessels.length > 0 && !this.firstDataReceived) {
      this.zone.run(() => {
        console.log('🚨 FIRST DATA RECEIVED - Hiding loading screen');
        
        this.firstDataReceived = true;
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
          this.loadingTimeout = null;
        }

        this.loadingStateSubject.next({
          isLoading: false,
          message: `${vessels.length} vessels connected via real-time stream`,
          progress: 100,
          hasData: true,
          lastUpdate: new Date(),
          error: null
        });
      });
    }
    
    // ✅ Update existing vessels with new data
    if (vessels.length > 0 && this.firstDataReceived) {
      this.zone.run(() => {
        const currentState = this.loadingStateSubject.value;
        if (currentState.hasData) {
          this.loadingStateSubject.next({
            ...currentState,
            message: `${vessels.length} vessels • Real-time updates active`,
            lastUpdate: new Date()
          });
        }
      });
    }
  }

  /**
   * ❌ Handle error
   */
  public handleError(error?: any): void {
    console.error('[VesselLoadingManager] Error:', error);
    
    this.zone.run(() => {
      this.updateState({
        isLoading: false,
        message: 'Data update failed',
        progress: 0,
        hasData: false,
        lastUpdate: this.loadingStateSubject.value.lastUpdate,
        error: error?.message || 'Failed to receive vessel updates. Retrying...'
      });
    });
  }

  /**
   * 🔄 Reset state
   */
  public resetState(): void {
    this.firstDataReceived = false;
    this.startLoadingSequence();
  }

  /**
   * 📊 Get current state
   */
  public getCurrentState(): LoadingState {
    return this.loadingStateSubject.value;
  }

  /**
   * 🧹 Cleanup
   */
  public cleanup(): void {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
    
    this.loadingStateSubject.complete();
  }
}
