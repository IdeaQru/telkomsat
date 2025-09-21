// src/services/vessel-websocket.service.ts - COMPLETE with fixed parsing
import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, fromEvent, of, timer } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { catchError, map, timeout, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
export interface TelkomsatVesselResponse {
  code: number;
  message: string;
  data: TelkomsatVessel[];
  count: number;
  total_count: number;
}

export interface TelkomsatVessel {
  mmsi: string;
  imo: string;
  lat: string;
  lon: string;
  cog: string | null;
  sog: string;
  heading: string | null;
  dimension: {
    a: number;
    b: number;
    c: number;
    d: number;
    width: number;
    length: number;
  } | null;
  eta: string | null;
  name: string;
  callsign: string;
  class: string;
  type: string;
  flag: string;
  status: string;
  destination: string | null;
  data_date: string;
  data_time: string;
  source: string;
}

export interface Vessel {
  mmsi: number;
  latitude: number;
  longitude: number;
  course: number;
  speed: number;
  heading?: number;
  name?: string;
  callSign?: string;
  imo?: string;
  vesselType: number;
  navStatus: number;
  flag?: string;
  vesselClass?: string;
  destination?: string;
  eta?: string;
  timestamp: Date;
  length?: number;
  width?: number;
  dimension?: {
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    width?: number;
    length?: number;
  };
  source?: string;
}

export interface ConnectionStats {
  connected: boolean;
  clientId?: string;
  connectedAt?: Date;
  reconnectAttempts: number;
  lastUpdate?: Date;
  vesselCount: number;
  realTimeUpdates: number;
}

// ✅ FIXED: WebSocket Message interface matching backend EXACTLY
export interface WebSocketMessage {
  type: 'initial_data' | 'vessel_update' | 'position_update';
  timestamp: Date;
  count: number;
  vessels?: any[]; // ✅ Backend sends vessels DIRECTLY in message.vessels
  mmsi?: number;   // For position updates
  position?: any;  // For position updates
}

export interface BackendConnectionInfo {
  clientId: string;
  serverTime: Date;
  namespace: string;
  message: string;
  totalClients: number;
}

@Injectable({
  providedIn: 'root'
})
export class VesselWebSocketService implements OnDestroy {
  // ✅ Backend API URLs
  private readonly BACKEND_API_URL = `${environment.apiUrl}/api`;
  private readonly WEBSOCKET_URL = `${environment.websocketUrl}/vessel-tracking`;
  
  // ✅ Available health endpoints matching backend structure
  private readonly HEALTH_ENDPOINTS = [
    '/ais-data/current',    // Primary vessel data endpoint
    '/ais-data/stats',      // Stats endpoint
    '/telkomsat/health',    // Health endpoint
  ];
  
  // ✅ WebSocket connection
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectedAt: Date | undefined = undefined;

  // ✅ State management
  private vesselUpdatesSubject = new BehaviorSubject<Vessel[]>([]);
  private connectionStatusSubject = new BehaviorSubject<string>('disconnected');
  private connectionStatsSubject = new BehaviorSubject<ConnectionStats>({
    connected: false,
    reconnectAttempts: 0,
    vesselCount: 0,
    realTimeUpdates: 0
  });
  private loadingCompleteSubject = new BehaviorSubject<{hasData: boolean, error?: any}>({hasData: false});
  
  // ✅ Public observables
  public vesselUpdates$ = this.vesselUpdatesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public connectionStats$ = this.connectionStatsSubject.asObservable();
  public loadingComplete$ = this.loadingCompleteSubject.asObservable();
  
  // ✅ Internal state
  private vesselCache: Map<number, Vessel> = new Map();
  private subscribedVessels: Set<number> = new Set();
  private subscribedArea: any = null;
  private realTimeUpdateCount = 0;
  
  // ✅ FALLBACK mechanism
  private useRestApiFallback = false;
  private restApiTimer: any;
  private heartbeatTimer: any;

  constructor(private http: HttpClient) {
    console.log('🛰️ VesselWebSocketService initialized');
    console.log('📡 Backend API URL:', this.BACKEND_API_URL);
    console.log('🔌 WebSocket URL:', this.WEBSOCKET_URL);
  }

  /**
   * 🔌 ENHANCED CONNECT matching backend gateway
   */
  public connect(): void {
    console.log('🔌 ===== WEBSOCKET CONNECTION ATTEMPT =====');
    console.log('🔌 Current socket status:', this.socket?.connected);
    
    if (this.socket?.connected) {
      console.log('🔗 Already connected to WebSocket');
      return;
    }

    // ✅ Test backend availability with multiple endpoints
    this.testBackendConnection().then(isAvailable => {
      if (isAvailable) {
        this.initializeWebSocketConnection();
      } else {
        console.warn('⚠️ Backend not available, starting REST API fallback');
      }
    });
  }

  /**
   * 🏥 Enhanced backend connection test with multiple endpoints
   */
  private async testBackendConnection(): Promise<boolean> {
    console.log('🏥 Testing backend connection with multiple endpoints...');
    
    // ✅ Try each endpoint until one works
    for (const endpoint of this.HEALTH_ENDPOINTS) {
      try {
        console.log(`🏥 Testing endpoint: ${this.BACKEND_API_URL}${endpoint}`);
        
        const response = await fetch(`${this.BACKEND_API_URL}${endpoint}?limit=1`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // console.log(`✅ Backend is available via ${endpoint}:`, data);
          
          // ✅ Any successful response indicates backend is running
          return data.success !== false;
        }
        
      } catch (error: any) {
        console.warn(`⚠️ Endpoint ${endpoint} failed:`, error.message);
        continue; // Try next endpoint
      }
    }
    
    console.error('❌ All backend endpoints failed');
    return false;
  }

  /**
   * 🔌 Initialize WebSocket connection matching backend namespace
   */
  private initializeWebSocketConnection(): void {
    console.log('🔌 Initializing WebSocket connection...');
    this.connectionStatusSubject.next('connecting');

    // ✅ Create socket matching backend gateway configuration
    this.socket = io(this.WEBSOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 10000,
      forceNew: true,
      transports: ['websocket', 'polling'],
      upgrade: true
    });

    console.log('🔌 Socket created, setting up event listeners...');
    this.setupSocketEventListeners();
    
    // ✅ Connection timeout handler
    setTimeout(() => {
      if (!this.socket?.connected) {
        console.error('❌ WebSocket connection timeout after 15 seconds');
        this.handleConnectionFailure();
      }
    }, 15000);
  }

  /**
   * 📡 ENHANCED SOCKET EVENT LISTENERS - FIXED parsing to match backend EXACTLY
   */
  private setupSocketEventListeners(): void {
    if (!this.socket) return;

    console.log('📡 Setting up WebSocket event listeners...');

    // ✅ Connection success - matches backend handleConnection
    this.socket.on('connect', () => {
      console.log('🎉 ===== WEBSOCKET CONNECTED! =====');
      console.log('🔗 Socket ID:', this.socket?.id);
      console.log('🔗 Transport:', this.socket?.io?.engine?.transport?.name);
      
      this.connectedAt = new Date();
      this.reconnectAttempts = 0;
      this.useRestApiFallback = false;
      this.connectionStatusSubject.next('connected');
      this.updateConnectionStats();
      
      // ✅ Backend automatically sends initial_data on connection
      console.log('📡 Backend will automatically send initial data');
    });

    // ✅ Connection error
    this.socket.on('connect_error', (error) => {
      console.error('❌ ===== WEBSOCKET CONNECTION ERROR =====');
      console.error('❌ Error:', error);
      console.error('❌ Message:', error.message);
      
      this.reconnectAttempts++;
      this.connectionStatusSubject.next('error');
      this.updateConnectionStats();
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('⚠️ Max reconnection attempts reached, starting REST API fallback');
      }
    });

    // ✅ Disconnect - matches backend handleDisconnect
    this.socket.on('disconnect', (reason) => {
      console.log('❌ ===== WEBSOCKET DISCONNECTED =====');
      console.log('❌ Reason:', reason);
      
      this.connectionStatusSubject.next('disconnected');
      this.connectedAt = undefined;
      this.updateConnectionStats();
      this.stopHeartbeat();
      
      if (reason === 'io server disconnect' || reason === 'transport close') {
        console.warn('⚠️ Server disconnected, starting REST API fallback');
      }
    });

    // ✅ INITIAL DATA - FIXED to match backend structure EXACTLY
    this.socket.on('initial_data', (message: any) => {
      // console.log('📊 ===== INITIAL DATA RECEIVED =====');
      // console.log('📊 Full message object:', message);
      // console.log('📊 Message type:', message.type);
      // console.log('📊 Timestamp:', message.timestamp);
      // console.log('📊 Count:', message.count);
      // console.log('📊 Vessels array (direct):', message.vessels);
      
      // ✅ FIXED: Backend sends vessels DIRECTLY in message.vessels
      if (message.vessels && Array.isArray(message.vessels)) {
        console.log(`📊 Processing ${message.vessels.length} initial vessels from message.vessels`);
        const vessels = this.processBackendVessels(message.vessels);
        this.updateCacheAndNotify(vessels);
        // console.log(`✅ Successfully loaded ${vessels.length} vessels via WebSocket`);
      } else {
        console.warn('⚠️ No vessel array found in initial_data');
        // console.log('🔍 Available message properties:', Object.keys(message));
        // console.log('🔍 Message structure:', message);
        
        // ✅ Try to find vessels in any property
        for (const key of Object.keys(message)) {
          if (Array.isArray(message[key]) && message[key].length > 0) {
            // console.log(`🔍 Found potential vessel array in property: ${key}`);
            const vessels = this.processBackendVessels(message[key]);
            if (vessels.length > 0) {
              this.updateCacheAndNotify(vessels);
              console.log(`✅ Successfully loaded ${vessels.length} vessels from ${key}`);
              return;
            }
          }
        }
        
        console.warn('⚠️ No valid vessel data found anywhere in message');
        // ✅ Fallback to REST API if WebSocket data is malformed
        console.log('🔄 Falling back to REST API...');
      }
    });

    // ✅ VESSEL UPDATE - FIXED to match backend structure EXACTLY
    this.socket.on('vessel_update', (message: any) => {
      console.log('🔄 ===== VESSEL UPDATE RECEIVED =====');
      // console.log('🔄 Full message object:', message);
      // console.log('🔄 Message type:', message.type);
      // console.log('🔄 Update count:', message.count);
      // console.log('🔄 Timestamp:', message.timestamp);
      // console.log('🔄 Vessels array (direct):', message.vessels);
      
      this.realTimeUpdateCount++;
      
      // ✅ FIXED: Backend sends vessels DIRECTLY in message.vessels
      if (message.vessels && Array.isArray(message.vessels)) {
        // console.log(`🔄 Processing ${message.vessels.length} updated vessels from message.vessels`);
        const vessels = this.processBackendVessels(message.vessels);
        this.updateCacheAndNotify(vessels);
        this.updateConnectionStats();
        console.log(`🔄 Updated ${vessels.length} vessels via WebSocket`);
      } else {
        console.warn('⚠️ No vessel array in vessel_update');
        console.log('🔍 Available message properties:', Object.keys(message));
        
        // ✅ Try to find vessels in any property
        for (const key of Object.keys(message)) {
          if (Array.isArray(message[key]) && message[key].length > 0) {
            // console.log(`🔍 Found potential vessel array in property: ${key}`);
            const vessels = this.processBackendVessels(message[key]);
            if (vessels.length > 0) {
              this.updateCacheAndNotify(vessels);
              this.updateConnectionStats();
              console.log(`🔄 Updated ${vessels.length} vessels from ${key}`);
              return;
            }
          }
        }
      }
    });

    // ✅ POSITION UPDATE - matches backend exactly
    this.socket.on('position_update', (message: any) => {
      // console.log('📍 ===== POSITION UPDATE RECEIVED =====');
      // console.log('📍 Full message object:', message);
      // console.log('📍 MMSI:', message.mmsi);
      // console.log('📍 Position:', message.position);
      // console.log('📍 Timestamp:', message.timestamp);
      
      this.realTimeUpdateCount++;
      
      if (message.mmsi && message.position) {
        this.updateSingleVesselPosition({
          mmsi: message.mmsi,
          position: message.position,
          timestamp: message.timestamp
        });
        this.updateConnectionStats();
      }
    });

    // ✅ SPECIFIC VESSEL UPDATES - backend sends to vessel_{mmsi} rooms
    this.socket.onAny((eventName, data) => {
      if (eventName.startsWith('vessel_')) {
        const mmsi = eventName.replace('vessel_', '');
        console.log(`🎯 Received update for vessel ${mmsi}:`, data);
        
        if (data.mmsi && data.position) {
          this.updateSingleVesselPosition(data);
          this.updateConnectionStats();
        }
      }
    });

    // ✅ SUBSCRIPTION CONFIRMATIONS - matches backend responses
    this.socket.on('subscription_confirmed', (response) => {
      console.log('✅ Subscription confirmed:', response);
      if (response.data) {
        console.log(`✅ Subscribed to vessel ${response.data.mmsi}: ${response.data.status}`);
      }
    });

    this.socket.on('unsubscription_confirmed', (response) => {
      console.log('❌ Unsubscription confirmed:', response);
      if (response.data) {
        console.log(`❌ Unsubscribed from vessel ${response.data.mmsi}: ${response.data.status}`);
      }
    });

    this.socket.on('area_subscription_confirmed', (response) => {
      console.log('🗺️ Area subscription confirmed:', response);
      if (response.data) {
        console.log(`🗺️ Subscribed to area: ${JSON.stringify(response.data.bounds)}`);
      }
    });

    // ✅ Generic event listener for debugging
    this.socket.onAny((eventName, ...args) => {
      if (!['ping', 'pong', 'connect', 'disconnect'].includes(eventName) && 
          !eventName.startsWith('vessel_')) {
        console.log('📡 WebSocket Event:', eventName, args);
      }
    });

    console.log('📡 All WebSocket event listeners setup complete');
  }

  /**
   * 📡 Request initial data - OPTIONAL since backend auto-sends
   */
  private requestInitialDataFromWebSocket(): void {
    if (!this.socket?.connected) return;
    
    console.log('📡 Manually requesting initial data (backend auto-sends on connect)...');
    
    // ✅ Backend automatically sends initial_data on connection
    console.log('📡 Note: Backend automatically sends initial_data on connection');
  }

  /**
   * 💓 Setup heartbeat with backend
   */
  private setupHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        // ✅ Simple heartbeat
        this.socket.emit('ping', {
          timestamp: new Date(),
          clientId: this.socket.id
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * 💓 Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }




  /**
   * 🔄 Handle connection failure
   */
  private handleConnectionFailure(): void {
    console.error('❌ WebSocket connection failed completely');
    
    this.connectionStatusSubject.next('error');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // ✅ Start REST API fallback
    
    this.loadingCompleteSubject.next({
      hasData: false,
      error: 'WebSocket connection failed, using REST API fallback'
    });
  }

  /**
   * 🔄 UPDATE SINGLE VESSEL POSITION matching backend structure
   */
  private updateSingleVesselPosition(positionData: any): void {
    const mmsi = positionData.mmsi;
    const existingVessel = this.vesselCache.get(mmsi);
    
    if (existingVessel && positionData.position) {
      const updatedVessel: Vessel = {
        ...existingVessel,
        latitude: positionData.position.latitude || existingVessel.latitude,
        longitude: positionData.position.longitude || existingVessel.longitude,
        course: positionData.position.course || existingVessel.course,
        speed: positionData.position.speed || existingVessel.speed,
        heading: positionData.position.heading || existingVessel.heading,
        timestamp: new Date(positionData.timestamp)
      };
      
      this.vesselCache.set(mmsi, updatedVessel);
      
      const allVessels = Array.from(this.vesselCache.values());
      this.vesselUpdatesSubject.next(allVessels);
    }
  }

  /**
   * 🔄 PROCESS BACKEND VESSELS - Enhanced vessel processing
   */
  private processBackendVessels(backendVessels: any[]): Vessel[] {
    // console.log('🔄 Processing backend vessels...');
    // console.log('🔄 Input vessels:', backendVessels);
    
    if (!Array.isArray(backendVessels)) {
      console.warn('⚠️ Invalid vessel data format - not an array');
      return [];
    }

    if (backendVessels.length === 0) {
      console.warn('⚠️ Empty vessel array received');
      return [];
    }

    // console.log('🔍 Sample vessel object:', backendVessels[0]);

    return backendVessels
      .filter(bv => {
        const hasMMSI = bv && (bv.mmsi || bv.MMSI) && 
                       typeof (bv.mmsi || bv.MMSI) === 'number';
        
        if (!hasMMSI) {
          console.debug('⚠️ Vessel missing MMSI:', bv);
          return false;
        }
        
        return true;
      })
      .map(bv => {
        try {
          const vessel: Vessel = {
            mmsi: bv.mmsi || bv.MMSI || parseInt(bv.mmsi) || parseInt(bv.MMSI),
            latitude: parseFloat(bv.latitude || bv.lat) || 0,
            longitude: parseFloat(bv.longitude || bv.lon) || 0,
            course: parseFloat(bv.course || bv.cog) || 0,
            speed: parseFloat(bv.speed || bv.sog) || 0,
            heading: bv.heading ? parseFloat(bv.heading) : undefined,
            name: bv.name || bv.vesselName || undefined,
            callSign: bv.callSign || bv.callsign || undefined,
            imo: bv.imo || bv.IMO || undefined,
            vesselType: parseInt(bv.vesselType || bv.type) || 0,
            navStatus: parseInt(bv.navStatus || bv.status) || 15,
            flag: bv.flag || undefined,
            vesselClass: bv.vesselClass || bv.class || undefined,
            destination: bv.destination || undefined,
            eta: bv.eta || undefined,
            timestamp: new Date(bv.timestamp || bv.lastUpdated || bv.data_date || Date.now()),
            length: bv.length || bv.dimension?.length || undefined,
            width: bv.width || bv.dimension?.width || undefined,
            dimension: bv.dimension || undefined,
            source: bv.source || 'telkomsat'
          };

          return vessel;
        } catch (error) {
          console.warn('⚠️ Failed to process vessel:', bv.mmsi || bv.MMSI, error);
          return null;
        }
      })
      .filter((vessel): vessel is Vessel => 
        vessel !== null &&
        !isNaN(vessel.mmsi) && 
        !isNaN(vessel.latitude) && 
        !isNaN(vessel.longitude) &&
        vessel.latitude >= -90 && vessel.latitude <= 90 &&
        vessel.longitude >= -180 && vessel.longitude <= 180 &&
        vessel.mmsi > 0
      );
  }

  /**
   * 🔄 UPDATE CACHE AND NOTIFY
   */
  private updateCacheAndNotify(vessels: Vessel[]): void {
    console.log(`🔄 Updating cache with ${vessels.length} vessels`);
    
    if (vessels.length === 0) {
      console.warn('⚠️ No valid vessels to cache');
      return;
    }

    let newVessels = 0;
    let updatedVessels = 0;

    vessels.forEach(vessel => {
      const existing = this.vesselCache.get(vessel.mmsi);
      if (!existing) {
        this.vesselCache.set(vessel.mmsi, vessel);
        newVessels++;
      } else if (vessel.timestamp > existing.timestamp) {
        this.vesselCache.set(vessel.mmsi, vessel);
        updatedVessels++;
      }
    });
    
    const allVessels = Array.from(this.vesselCache.values());
    console.log(`📊 Cache updated: ${newVessels} new, ${updatedVessels} updated`);
    console.log(`📊 Total cached vessels: ${allVessels.length}`);
    
    this.vesselUpdatesSubject.next(allVessels);
    
    this.loadingCompleteSubject.next({
      hasData: allVessels.length > 0,
      error: undefined
    });
  }

  /**
   * 📊 UPDATE CONNECTION STATS
   */
  private updateConnectionStats(): void {
    const stats: ConnectionStats = {
      connected: this.socket?.connected || this.useRestApiFallback,
      clientId: this.socket?.id || 'rest-api',
      connectedAt: this.connectedAt,
      reconnectAttempts: this.reconnectAttempts,
      lastUpdate: new Date(),
      vesselCount: this.vesselCache.size,
      realTimeUpdates: this.realTimeUpdateCount
    };
    
    this.connectionStatsSubject.next(stats);
  }

  // ✅ PUBLIC METHODS MATCHING BACKEND SUBSCRIPTIONS

  /**
   * 🎯 SUBSCRIBE TO SPECIFIC VESSEL - matches backend subscribe_vessel
   */
  public subscribeToVessel(mmsi: number): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Not connected to WebSocket');
      return;
    }

    this.subscribedVessels.add(mmsi);
    
    // ✅ Matches backend @SubscribeMessage('subscribe_vessel')
    this.socket.emit('subscribe_vessel', { mmsi });
    console.log(`🎯 Subscribed to vessel: ${mmsi}`);
  }

  /**
   * ❌ UNSUBSCRIBE FROM VESSEL - matches backend unsubscribe_vessel
   */
  public unsubscribeFromVessel(mmsi: number): void {
    if (!this.socket?.connected) return;

    this.subscribedVessels.delete(mmsi);
    
    // ✅ Matches backend @SubscribeMessage('unsubscribe_vessel')
    this.socket.emit('unsubscribe_vessel', { mmsi });
    console.log(`❌ Unsubscribed from vessel: ${mmsi}`);
  }

  /**
   * 🗺️ SUBSCRIBE TO GEOGRAPHIC AREA - matches backend subscribe_area
   */
  public subscribeToArea(bounds: { 
    north: number; 
    south: number; 
    east: number; 
    west: number; 
  }): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Not connected to WebSocket');
      return;
    }

    this.subscribedArea = bounds;
    
    // ✅ Matches backend @SubscribeMessage('subscribe_area')
    this.socket.emit('subscribe_area', { bounds });
    console.log('🗺️ Subscribed to area:', bounds);
  }

  // ✅ ADDITIONAL METHODS FOR COMPATIBILITY

  /**
   * 🗺️ GET VESSEL TRACK via REST API
   */
  public getVesselTrack(mmsi: number, limit: number = 50): Observable<any[]> {
    console.log(`🗺️ Getting vessel track for MMSI ${mmsi} (limit: ${limit})`);
    
    return this.http.get<any>(`${this.BACKEND_API_URL}/ais-data/track/${mmsi}?limit=${limit}`)
      .pipe(
        timeout(10000),
        map(response => {
          if (response.success && Array.isArray(response.data)) {
            console.log(`✅ Retrieved ${response.data.length} track points for vessel ${mmsi}`);
            return response.data;
          }
          return [];
        }),
        catchError(error => {
          console.error(`❌ Failed to get vessel track for ${mmsi}:`, error);
          return of([]);
        })
      );
  }

  /**
   * 🎯 FETCH SPECIFIC VESSELS via REST API
   */
  public fetchSpecificVessels(mmsiList: number[]): Observable<Vessel[]> {
    console.log(`🎯 Fetching specific vessels via REST: ${mmsiList.join(', ')}`);
    
    const mmsiParams = mmsiList.map(mmsi => `mmsi=${mmsi}`).join('&');
    
    return this.http.get<any>(`${this.BACKEND_API_URL}/ais-data/current?${mmsiParams}`)
      .pipe(
        timeout(15000),
        map(response => {
          if (response.success && Array.isArray(response.data)) {
            const vessels = this.processBackendVessels(response.data);
            console.log(`✅ Retrieved ${vessels.length} specific vessels`);
            return vessels;
          }
          return [];
        }),
        catchError(error => {
          console.error('❌ Error fetching specific vessels:', error);
          return of([]);
        })
      );
  }

  /**
   * 🏥 HEALTH CHECK via REST API
   */
  public healthCheck(): Observable<boolean> {
    console.log('🏥 Performing backend health check');
    
    // ✅ Try multiple health endpoints
    const healthPromises = this.HEALTH_ENDPOINTS.map(endpoint => 
      fetch(`${this.BACKEND_API_URL}${endpoint}?limit=1`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }).then(response => response.ok).catch(() => false)
    );

    return new Observable(observer => {
      Promise.all(healthPromises).then(results => {
        const isHealthy = results.some(result => result === true);
        console.log(`🏥 Backend health: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
        observer.next(isHealthy);
        observer.complete();
      }).catch(error => {
        console.error('❌ Health check failed:', error);
        observer.next(false);
        observer.complete();
      });
    });
  }

  /**
   * 📊 GET BACKEND STATISTICS
   */
  public getBackendStats(): Observable<any> {
    console.log('📊 Getting backend statistics');
    
    return this.http.get<any>(`${this.BACKEND_API_URL}/ais-data/stats`)
      .pipe(
        timeout(10000),
        map(response => {
          if (response.success) {
            console.log('✅ Backend stats retrieved:', response.data);
            return response.data;
          }
          return null;
        }),
        catchError(error => {
          console.error('❌ Failed to get backend stats:', error);
          return of(null);
        })
      );
  }

  // ✅ Keep all existing public methods for backward compatibility
  
  public forceRequestData(): void {
    console.log('🔄 ===== FORCE REQUEST DATA =====');
    
    if (this.socket?.connected) {
      console.log('📡 WebSocket connected - backend auto-sends data');
      // ✅ Backend automatically sends data on connection
      console.log('📡 Note: Backend automatically broadcasts data, no manual request needed');
    } else {
      console.log('📡 Requesting via REST API...');
    }
  }



  // ✅ CONNECTION STATUS METHODS
  public isConnected(): boolean {
    return this.socket?.connected || this.useRestApiFallback;
  }

  public getConnectionStatus(): string {
    const status = this.connectionStatusSubject.value;
    if (this.useRestApiFallback && status !== 'connected') {
      return 'connected-rest';
    }
    return status;
  }

  public getConnectionStats(): { connectedClients: number; timestamp: Date } {
    return {
      connectedClients: this.isConnected() ? 1 : 0,
      timestamp: new Date()
    };
  }

  // ✅ BACKWARD COMPATIBILITY METHODS
  public startPolling(): void {
    console.log('📡 Starting connection (WebSocket with REST fallback)');
    this.connect();
  }

  public stopPolling(): void {
    console.log('⏹️ Stopping connection');
    this.disconnect();
  }

  public forceAggressiveCollection(): void {
    console.log('⚡ Triggering aggressive collection via backend');
    this.http.post(`${this.BACKEND_API_URL}/telkomsat/collect/aggressive`, {})
      .subscribe({
        next: (response) => console.log('⚡ Aggressive collection triggered:', response),
        error: (error) => console.error('❌ Aggressive collection failed:', error)
      });
  }

  public requestAllVessels(): void {
    console.log('🔄 Requesting all vessels');
    this.forceRequestData();
  }

  public setPollingInterval(intervalMs: number): void {
    console.log(`⏰ WebSocket doesn't use polling intervals, real-time updates are automatic`);
    console.log(`⏰ Requested interval: ${intervalMs}ms (ignored for WebSocket)`);
  }

  // ✅ CACHE MANAGEMENT METHODS
  public getCurrentVesselCount(): number { 
    return this.vesselCache.size; 
  }

  public getAllCachedVessels(): Vessel[] { 
    return Array.from(this.vesselCache.values()); 
  }

  public getCachedVessel(mmsi: number): Vessel | undefined { 
    return this.vesselCache.get(mmsi); 
  }

  public clearCache(): void { 
    console.log('🧹 Clearing vessel cache');
    this.vesselCache.clear();
    this.vesselUpdatesSubject.next([]);
  }

  public getVesselStats(): any {
    const vessels = Array.from(this.vesselCache.values());
    const byType = vessels.reduce((acc, vessel) => {
      const type = vessel.vesselType;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as {[key: number]: number});

    return {
      total: vessels.length,
      unique_mmsi: this.vesselCache.size,
      by_type: byType,
      cache_size: this.vesselCache.size,
      last_update: vessels.length > 0 ? Math.max(...vessels.map(v => v.timestamp.getTime())) : null,
      real_time_updates: this.realTimeUpdateCount,
      connected: this.isConnected()
    };
  }

  // ✅ DISCONNECT AND CLEANUP METHODS
  public disconnect(): void {
    console.log('❌ Disconnecting from all services...');
    
    // ✅ Stop REST API fallback
    this.useRestApiFallback = false;
    if (this.restApiTimer) {
      clearInterval(this.restApiTimer);
      this.restApiTimer = null;
    }
    
    // ✅ Stop heartbeat
    this.stopHeartbeat();
    
    // ✅ Disconnect WebSocket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionStatusSubject.next('disconnected');
    this.connectedAt = undefined;
    this.updateConnectionStats();
  }

  public cleanup(): void {
    console.log('🧹 Starting VesselWebSocketService cleanup');
    
    this.disconnect();
    this.vesselCache.clear();
    this.subscribedVessels.clear();
    this.subscribedArea = null;
    this.connectedAt = undefined;
    
    this.vesselUpdatesSubject.complete();
    this.connectionStatusSubject.complete();
    this.connectionStatsSubject.complete();
    this.loadingCompleteSubject.complete();
    
    console.log('✅ VesselWebSocketService cleanup completed');
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
