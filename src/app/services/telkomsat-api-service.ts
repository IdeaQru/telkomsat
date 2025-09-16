import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, timer, EMPTY, interval, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap, tap, take, timeout, delay, finalize } from 'rxjs/operators';

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
  cog: string;
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
  eta: string;
  name: string;
  callsign: string;
  class: string;
  type: string;
  flag: string;
  status: string;
  destination: string;
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
  vesselType: number;
  navStatus: number;
  destination?: string;
  eta?: string;
  timestamp: Date;
  length?: number;
  width?: number;
  source?: string;
  
}

@Injectable({
  providedIn: 'root'
})
export class TelkomsatApiService {
  private readonly API_BASE_URL = 'https://ais.telkomsat.co.id/api';
  private readonly API_KEY = '7tpJTqNGgXQe3LwmhDlhUtCT0Tg9btUA89kIsG1ThJleBKuE';
  
  private vesselUpdatesSubject = new BehaviorSubject<Vessel[]>([]);
  private connectionStatusSubject = new BehaviorSubject<string>('disconnected');
  private loadingCompleteSubject = new BehaviorSubject<{hasData: boolean, error?: any}>({hasData: false});
  
  public vesselUpdates$ = this.vesselUpdatesSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public loadingComplete$ = this.loadingCompleteSubject.asObservable();
  
  private pollingInterval = 30000;
  private pollingSubscription: any;
  private isPolling = false;
  private vesselCache: Map<number, Vessel> = new Map();

  constructor(private http: HttpClient) {}

  // ✅ START POLLING - Fixed return types
  public startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.connectionStatusSubject.next('connecting');
    
    console.log('🛰️ Starting Telkomsat API with massive collection strategy...');
    
    // ✅ Initial collection
    this.collectVesselsMassively().subscribe({
      next: (vessels) => {
        console.log(`✅ Initial massive collection: ${vessels.length} vessels`);
      },
      error: (error) => {
        console.error('❌ Initial collection failed:', error);
        this.handleConnectionError();
      }
    });
    
    // ✅ Setup regular polling
    this.pollingSubscription = timer(this.pollingInterval, this.pollingInterval)
      .pipe(
        switchMap(() => this.collectVesselsMassively()),
        tap((vessels) => {
          console.log(`🔄 Polling update: ${vessels.length} total vessels`);
        }),
        catchError((error) => {
          console.error('❌ Polling error:', error);
          this.handleConnectionError();
          return of([] as Vessel[]); // ✅ Fixed: Always return Observable<Vessel[]>
        })
      )
      .subscribe();
  }

  // ✅ MASSIVE COLLECTION STRATEGY - Fixed return types
  private collectVesselsMassively(): Observable<Vessel[]> {
    console.log('🚀 Starting MASSIVE vessel collection with parallel requests...');
    
    // ✅ Create 30 parallel requests (reduced for stability)
    const parallelRequests = Array.from({length: 30}, (_, i) => {
      return this.createVariedRequest(i).pipe(
        delay(i * 200), // Stagger by 200ms each
        timeout(15000),
        catchError((error) => {
          console.warn(`⚠️ Request ${i} failed:`, error.message);
          return of([] as Vessel[]); // ✅ Fixed: Always return Observable<Vessel[]>
        })
      );
    });

    return forkJoin(parallelRequests).pipe(
      map((results: Vessel[][]) => {
        // ✅ Combine all results
        const allVessels = results.flat();
        console.log(`🔗 Combined ${results.length} responses: ${allVessels.length} total vessels`);
        
        // ✅ Deduplicate by MMSI and keep latest timestamp
        const uniqueVessels = this.deduplicateVessels(allVessels);
        console.log(`🎯 After deduplication: ${uniqueVessels.length} unique vessels`);
        
        // ✅ Update cache and notify
        this.updateCacheAndNotify(uniqueVessels);
        
        return uniqueVessels;
      }),
      catchError((error) => {
        console.error('❌ Massive collection failed:', error);
        this.handleConnectionError();
        return of([] as Vessel[]); // ✅ Fixed: Always return Observable<Vessel[]>
      })
    );
  }

  // ✅ CREATE VARIED REQUEST - Fixed return types
  private createVariedRequest(index: number): Observable<Vessel[]> {
    const formData = new FormData();
    formData.append('key', this.API_KEY);
    
    // ✅ Try different parameter combinations to get different data
    const strategies = [
      // Strategy 1: Different limits
      () => formData.append('limit', (100 + index * 10).toString()),
      
      // Strategy 2: Different offsets  
      () => formData.append('offset', (index * 25).toString()),
      
      // Strategy 3: Different pages
      () => formData.append('page', (index + 1).toString()),
      
      // Strategy 4: Different timestamps
      () => formData.append('timestamp', (Date.now() - index * 60000).toString()),
      
      // Strategy 5: Different random seeds
      () => formData.append('seed', Math.random().toString()),
      
      // Strategy 6: Different sorting
      () => formData.append('sort', ['mmsi', 'name', 'timestamp', 'lat', 'lon'][index % 5]),
      
      // Strategy 7: Different time windows
      () => formData.append('since', new Date(Date.now() - index * 3600000).toISOString()),
      
      // Strategy 8: Random combinations
      () => {
        formData.append('random', index.toString());
        formData.append('batch', Math.floor(index / 5).toString());
      }
    ];
    
    // Apply strategy for each request
    strategies[index % strategies.length]();
    
    // ✅ Add additional parameters
    formData.append('request_id', `batch_${index}_${Date.now()}`);
    formData.append('client', 'angular_app');
    
    return this.http.post<TelkomsatVesselResponse>(`${this.API_BASE_URL}/vesselArea`, formData)
      .pipe(
        map((response: TelkomsatVesselResponse) => {
          if (response.code === 200 && response.data && Array.isArray(response.data)) {
            const vessels = this.mapTelkomsatVesselsToVessels(response.data);
            console.log(`📡 Request ${index}: ${vessels.length} vessels (${response.count}/${response.total_count})`);
            return vessels;
          }
          console.log(`❌ Request ${index}: No data (code: ${response.code})`);
          return [] as Vessel[]; // ✅ Fixed: Always return Vessel[]
        }),
        catchError((error) => {
          console.error(`❌ Request ${index} failed:`, error);
          return of([] as Vessel[]); // ✅ Fixed: Always return Observable<Vessel[]>
        })
      );
  }

  // ✅ ENHANCED DEDUPLICATION - Fixed return types
  private deduplicateVessels(vessels: Vessel[]): Vessel[] {
    if (!Array.isArray(vessels) || vessels.length === 0) {
      return [] as Vessel[]; // ✅ Fixed: Handle edge cases
    }
    
    const vesselMap = new Map<number, Vessel>();
    
    vessels.forEach(vessel => {
      if (vessel && vessel.mmsi) { // ✅ Safety check
        const existing = vesselMap.get(vessel.mmsi);
        
        if (!existing) {
          vesselMap.set(vessel.mmsi, vessel);
        } else {
          // Keep vessel with latest timestamp
          if (new Date(vessel.timestamp) > new Date(existing.timestamp)) {
            vesselMap.set(vessel.mmsi, vessel);
          }
        }
      }
    });
    
    const result = Array.from(vesselMap.values());
    console.log(`🧹 Deduplication: ${vessels.length} → ${result.length} unique vessels`);
    
    return result;
  }

  // ✅ UPDATE CACHE AND NOTIFY - New method to centralize this logic
  private updateCacheAndNotify(vessels: Vessel[]): void {
    this.vesselCache.clear();
    vessels.forEach(vessel => {
      this.vesselCache.set(vessel.mmsi, vessel);
    });
    
    this.vesselUpdatesSubject.next(vessels);
    this.loadingCompleteSubject.next({
      hasData: vessels.length > 0,
      error: undefined
    });
    this.connectionStatusSubject.next('connected');
  }

  // ✅ SEQUENTIAL COLLECTION - Fixed return types
  public collectVesselsSequentially(): Observable<Vessel[]> {
    console.log('📋 Starting SEQUENTIAL vessel collection...');
    
    let allVessels: Vessel[] = [];
    
    return interval(2000).pipe(
      take(20), // 20 requests total
      switchMap((index) => {
        console.log(`📡 Sequential request ${index + 1}/20`);
        return this.createVariedRequest(index);
      }),
      tap((vessels) => {
        if (Array.isArray(vessels) && vessels.length > 0) {
          allVessels = [...allVessels, ...vessels];
          const unique = this.deduplicateVessels(allVessels);
          console.log(`📊 Sequential progress: ${unique.length} total unique vessels`);
        }
      }),
      finalize(() => {
        const finalVessels = this.deduplicateVessels(allVessels);
        this.updateCacheAndNotify(finalVessels);
      }),
      map(() => this.deduplicateVessels(allVessels)), // ✅ Fixed: Always return current state
      catchError((error) => {
        console.error('❌ Sequential collection failed:', error);
        return of([] as Vessel[]); // ✅ Fixed: Always return Observable<Vessel[]>
      })
    );
  }

  // ✅ FORCE MAXIMUM COLLECTION - Fixed return types
  public forceMaximumCollection(): Observable<Vessel[]> {
    console.log('💪 FORCE MAXIMUM COLLECTION - Emergency mode activated!');
    
    // Clear cache first
    this.vesselCache.clear();
    
    // Run both strategies in parallel
    const parallel$ = this.collectVesselsMassively();
    const sequential$ = this.collectVesselsSequentially();
    
    return forkJoin([parallel$, sequential$]).pipe(
      map(([parallelResult, sequentialResult]) => {
        const combined = [...parallelResult, ...sequentialResult];
        const final = this.deduplicateVessels(combined);
        
        console.log(`💪 MAXIMUM COLLECTION RESULT: ${final.length} unique vessels`);
        console.log(`   - Parallel strategy: ${parallelResult.length} vessels`);
        console.log(`   - Sequential strategy: ${sequentialResult.length} vessels`);
        console.log(`   - Combined: ${combined.length} total`);
        console.log(`   - Final unique: ${final.length} vessels`);
        
        this.updateCacheAndNotify(final);
        return final;
      }),
      catchError((error) => {
        console.error('💥 Maximum collection failed:', error);
        this.handleConnectionError();
        return of([] as Vessel[]); // ✅ Fixed: Always return Observable<Vessel[]>
      })
    );
  }

  // ✅ MAPPING - Enhanced with better error handling
  private mapTelkomsatVesselsToVessels(telkomsatVessels: TelkomsatVessel[]): Vessel[] {
    if (!Array.isArray(telkomsatVessels)) {
      console.warn('⚠️ mapTelkomsatVesselsToVessels: Input is not an array');
      return [] as Vessel[];
    }
    
    return telkomsatVessels
      .filter(tv => tv && tv.mmsi && tv.lat && tv.lon && tv.mmsi !== '0')
      .map(tv => {
        try {
          const vessel: Vessel = {
            mmsi: parseInt(tv.mmsi),
            latitude: parseFloat(tv.lat),
            longitude: parseFloat(tv.lon),
            course: parseFloat(tv.cog) || 0,
            speed: parseFloat(tv.sog) || 0,
            heading: tv.heading && tv.heading !== '511' && tv.heading !== null ? parseFloat(tv.heading) : undefined,
            name: tv.name && tv.name.trim() ? tv.name.trim() : undefined,
            callSign: tv.callsign && tv.callsign.trim() ? tv.callsign.trim() : undefined,
            vesselType: this.mapVesselTypeToNumber(tv.type),
            navStatus: this.mapStatusToNumber(tv.status),
            destination: tv.destination && tv.destination.trim() ? tv.destination.trim() : undefined,
            eta: tv.eta && tv.eta.trim() ? tv.eta.trim() : undefined,
            timestamp: this.parseDateTime(tv.data_date, tv.data_time),
            length: tv.dimension?.length || undefined,
            width: tv.dimension?.width || undefined,
            source: tv.source
          };
          return vessel;
        } catch (error) {
          console.warn('⚠️ Failed to parse vessel:', tv.mmsi, error);
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

  // ✅ Helper methods
  private mapVesselTypeToNumber(type: string): number {
    if (!type) return 0;
    
    const typeMap: {[key: string]: number} = {
      'Cargo': 70, 'Tanker': 80, 'Tankers': 80, 'Passenger': 60, 'Fishing': 30,
      'Tug': 52, 'Pilot': 50, 'Search and Rescue': 51, 'Pleasure Craft': 37,
      'High Speed Craft': 40, 'Other/Auxiliary': 90, 'Unknown': 0
    };
    return typeMap[type] || 0;
  }

  private mapStatusToNumber(status: string): number {
    if (!status) return 15;
    
    const statusMap: {[key: string]: number} = {
      'Under Way Using Engine': 0, 'Under Way Using Engine 0': 0,
      'At Anchor': 1, 'At Anchor 1': 1, 'Not Under Command': 2,
      'Restricted Manoeuvrability': 3, 'Constrained by Draught': 4,
      'Moored': 5, 'Aground': 6, 'Engaged in Fishing': 7,
      'Under Way Sailing': 8, 'Not Defined Default': 15, 'Not Defined': 15
    };
    return statusMap[status] || 15;
  }

  private parseDateTime(date: string, time: string): Date {
    try {
      if (!date || !time) return new Date();
      return new Date(`${date}T${time}Z`);
    } catch {
      return new Date();
    }
  }

  private handleConnectionError(): void {
    this.connectionStatusSubject.next('disconnected');
    this.loadingCompleteSubject.next({
      hasData: this.vesselCache.size > 0,
      error: new Error('Failed to connect to Telkomsat API')
    });
  }

  // ✅ PUBLIC METHODS - All with proper return types

  public setPollingInterval(intervalMs: number): void {
    this.pollingInterval = intervalMs;
    console.log(`⏰ Polling interval set to ${intervalMs}ms`);
    
    if (this.isPolling) {
      this.stopPolling();
      setTimeout(() => {
        this.startPolling();
      }, 1000);
    }
  }

  public fetchSpecificVessels(mmsiList: string[]): Observable<Vessel[]> {
    console.log(`🎯 Fetching specific vessels: ${mmsiList.join(', ')}`);
    
    const formData = new FormData();
    formData.append('key', this.API_KEY);
    
    mmsiList.forEach(mmsi => {
      formData.append('mmsi[]', mmsi);
    });
    
    return this.http.post<TelkomsatVesselResponse>(`${this.API_BASE_URL}/vessel`, formData)
      .pipe(
        timeout(15000),
        map((response: TelkomsatVesselResponse) => {
          if (response.code === 200 && response.data) {
            const vessels = this.mapTelkomsatVesselsToVessels(response.data);
            console.log(`✅ Retrieved ${vessels.length} specific vessels from Telkomsat`);
            return vessels;
          }
          return [] as Vessel[];
        }),
        catchError((error) => {
          console.error('❌ Error fetching specific vessels:', error);
          return of([] as Vessel[]); // ✅ Fixed: Always return Observable<Vessel[]>
        })
      );
  }

  public stopPolling(): void {
    this.isPolling = false;
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    this.connectionStatusSubject.next('disconnected');
    console.log('⏹️ Telkomsat API polling stopped');
  }

  public requestAllVessels(): void {
    console.log('🔄 Manual request for all vessels...');
    this.forceMaximumCollection().subscribe({
      next: (vessels) => {
        console.log(`✅ Manual request completed: ${vessels.length} vessels`);
      },
      error: (error) => {
        console.error('❌ Manual request failed:', error);
      }
    });
  }

  public forceAggressiveCollection(): void {
    console.log('⚡ Starting ULTRA-AGGRESSIVE collection...');
    this.forceMaximumCollection().subscribe({
      next: (vessels) => {
        console.log(`⚡ Aggressive collection result: ${vessels.length} vessels`);
      },
      error: (error) => {
        console.error('❌ Aggressive collection failed:', error);
      }
    });
  }

  public getCurrentVesselCount(): number {
    return this.vesselCache.size;
  }

  public getAllCachedVessels(): Vessel[] {
    return Array.from(this.vesselCache.values());
  }

  public isConnected(): boolean {
    return this.connectionStatusSubject.value === 'connected';
  }

  public getConnectionStatus(): string {
    return this.connectionStatusSubject.value;
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
      last_update: vessels.length > 0 ? Math.max(...vessels.map(v => v.timestamp.getTime())) : null
    };
  }

  public clearCache(): void {
    console.log('🧹 Clearing vessel cache...');
    this.vesselCache.clear();
    this.vesselUpdatesSubject.next([]);
  }

  public getCachedVessel(mmsi: number): Vessel | undefined {
    return this.vesselCache.get(mmsi);
  }

  public healthCheck(): Observable<boolean> {
    console.log('🏥 Performing API health check...');
    
    const formData = new FormData();
    formData.append('key', this.API_KEY);
    
    return this.http.post<TelkomsatVesselResponse>(`${this.API_BASE_URL}/vesselArea`, formData)
      .pipe(
        timeout(10000),
        map((response: TelkomsatVesselResponse) => {
          const isHealthy = response.code === 200;
          console.log(`🏥 Health check result: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
          return isHealthy;
        }),
        catchError((error) => {
          console.error('❌ Health check failed:', error);
          return of(false);
        })
      );
  }

  public cleanup(): void {
    console.log('🧹 Starting TelkomsatApiService cleanup...');
    
    this.stopPolling();
    this.vesselCache.clear();
    
    this.vesselUpdatesSubject.complete();
    this.connectionStatusSubject.complete();
    this.loadingCompleteSubject.complete();
    
    console.log('✅ TelkomsatApiService cleanup completed');
  }
}
