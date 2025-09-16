import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
// ✅ Interface sesuai format API response
export interface AtoNApiResponse {
  success: boolean;
  data: AtoNRawData[];
}

export interface AtoNRawData {
  _id: string;
  mmsi: number;
  raw: string;
  data: {
    aistype: number;
    mmsi: string;
    aidtype: number;
    shipname: string;
    isVirtual: boolean;
    dimension: number;
    epfdType: number;
    timestamp: number;
    offPosition: number;
    assignedMode: boolean;
    spare: number;
    lon: number;
    lat: number;
  };
  createdAt: string;
  updatedAt: string;
  receivedTime: string;
}

// ✅ Interface untuk AtoN yang sudah diproses
export interface AtoN {
  id: string;
  mmsi: string;
  name: string;
  latitude: number;
  longitude: number;
  aidType: number;
  aisType: number;
  isVirtual: boolean;
  dimension: number;
  epfdType: number;
  lastUpdate: Date;
  status: 'active' | 'inactive';
  markerType: string; // untuk menentukan icon marker
}

@Injectable({
  providedIn: 'root'
})
export class AtonService {
  private readonly apiUrl = 'https://demo.osi.my.id/api/aton';
  // private readonly apiUrl = `${environment.apiUrl}/aton`;
  private map: any;
  private L: any;
  private atonMarkers: Map<string, any> = new Map();
  private atonLayer: any;
  
  // State management
  private atonDataSubject = new BehaviorSubject<AtoN[]>([]);
  public atonData$ = this.atonDataSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ✅ Initialize service dengan peta
  public initialize(map: any, L: any): void {
    this.map = map;
    this.L = L;
    
    // Create AtoN layer group
    this.atonLayer = this.L.layerGroup().addTo(this.map);
    
    console.log('⚓ AtonService initialized');
  }

  // ✅ Fetch AtoN data dari API
  public getAtonList(): Observable<AtoN[]> {
    this.loadingSubject.next(true);
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    
    return this.http.get<AtoNApiResponse>(this.apiUrl, { headers }).pipe(
      map((response: AtoNApiResponse) => {
        if (response.success && response.data) {
          return this.transformAtonData(response.data);
        }
        return [];
      }),
      tap((data: AtoN[]) => {
        console.log(`📡 Received and transformed ${data.length} AtoN stations from API`);
        this.atonDataSubject.next(data);
        this.loadingSubject.next(false);
      }),
      catchError((error) => {
        console.error('❌ Error fetching AtoN data:', error);
        this.loadingSubject.next(false);
        
        // Return sample data jika API gagal
        const sampleAton: AtoN[] = [
          {
            id: 'aton-sample-001',
            mmsi: '995337037',
            name: 'CORAK ZAMAN',
            latitude: 4.10166666666667,
            longitude: 100.535,
            aidType: 30,
            aisType: 21,
            isVirtual: false,
            dimension: 0,
            epfdType: 7,
            lastUpdate: new Date(),
            status: 'active',
            markerType: 'special-mark'
          },
          {
            id: 'aton-sample-002',
            mmsi: '995636005',
            name: 'PIONEER BEACON',
            latitude: 1.28731666666667,
            longitude: 103.656631666667,
            aidType: 13,
            aisType: 21,
            isVirtual: false,
            dimension: 0,
            epfdType: 0,
            lastUpdate: new Date(),
            status: 'active',
            markerType: 'north-cardinal'
          }
        ];
        
        console.log('📊 Using sample AtoN data due to API error');
        this.atonDataSubject.next(sampleAton);
        return of(sampleAton);
      })
    );
  }

  // ✅ Transform raw API data ke format AtoN
  private transformAtonData(rawData: AtoNRawData[]): AtoN[] {
    return rawData
      .filter(item => item.data?.lat && item.data?.lon)
      .map(item => {
        const { data } = item;
        
        // Determine status berdasarkan waktu update
        const lastUpdateTime = new Date(item.receivedTime);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
        const status: 'active' | 'inactive' = hoursDiff < 2 ? 'active' : 'inactive';

        // Determine marker type berdasarkan aid type
        const markerType = this.getMarkerTypeFromAidType(data.aidtype);

        return {
          id: `aton-${item.mmsi}`,
          mmsi: data.mmsi,
          name: data.shipname || `AtoN-${item.mmsi}`,
          latitude: data.lat,
          longitude: data.lon,
          aidType: data.aidtype,
          aisType: data.aistype,
          isVirtual: data.isVirtual,
          dimension: data.dimension,
          epfdType: data.epfdType,
          lastUpdate: lastUpdateTime,
          status: status,
          markerType: markerType
        };
      })
      .filter(aton => 
        // Filter koordinat valid
        aton.latitude >= -90 && aton.latitude <= 90 &&
        aton.longitude >= -180 && aton.longitude <= 180 &&
        !(aton.latitude === 0 && aton.longitude === 0)
      );
  }

  // ✅ Map AID type ke marker file yang sesuai
  private getMarkerTypeFromAidType(aidType: number): string {
    const aidTypeMapping: { [key: number]: string } = {
      1: 'north-cardinal',      // Cardinal North
      2: 'south-cardinal',      // Cardinal South
      3: 'east-cardinal',       // Cardinal East
      4: 'west-cardinal',       // Cardinal West
      5: 'port-hand',           // Port hand mark
      6: 'starboard-hand',      // Starboard hand mark
      7: 'safe-water',          // Safe water
      8: 'isolated-water',      // Isolated danger
      9: 'special-mark',        // Special mark
      10: 'special-mark',       // Light vessel/LANBY/Rigs
      11: 'special-mark',       // Racon
      12: 'floating-water',     // ODAS
      13: 'north-cardinal',     // Light
      14: 'special-mark',       // Leading light
      15: 'special-mark',       // Sector light
      20: 'special-mark',       // Significant object
      28: 'special-mark',       // Wreck
      30: 'special-mark',       // Other
      31: 'virtual_buoy'        // Virtual buoy
    };

    return aidTypeMapping[aidType] || 'special-mark';
  }

  // ✅ Load dan tampilkan AtoN markers
  public loadAndShowAtonMarkers(): void {
    if (!this.map || !this.L) {
      console.warn('⚠️ Map not initialized, cannot show AtoN markers');
      return;
    }

    this.getAtonList().subscribe((atonList: AtoN[]) => {
      this.clearAtonMarkers();
      this.createAtonMarkers(atonList);
      console.log(`✅ Displayed ${atonList.length} AtoN markers on map`);
    });
  }

  // ✅ Create AtoN markers
  private createAtonMarkers(atonList: AtoN[]): void {
    atonList.forEach(aton => {
      try {
        const marker = this.createAtonMarker(aton);
        if (marker) {
          this.atonLayer.addLayer(marker);
          this.atonMarkers.set(aton.id, marker);
        }
      } catch (error) {
        console.error(`❌ Error creating marker for AtoN ${aton.id}:`, error);
      }
    });
  }

  // ✅ Create individual AtoN marker
  private createAtonMarker(aton: AtoN): any {
    const isActive = aton.status === 'active';
    
    // Custom AtoN icon menggunakan file dari assets/marker
    const atonIcon = this.L.icon({
      iconUrl: `marker/${aton.markerType}.png`,
      iconSize: [38, 38],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
      className: `aton-marker ${isActive ? 'active' : 'inactive'}`
    });

    const marker = this.L.marker([aton.latitude, aton.longitude], {
      icon: atonIcon,
      title: aton.name
    });

    // ✅ Bind popup dengan info detail
    this.bindAtonPopup(marker, aton);

    // // ✅ Event handlers
    // marker.on('mouseover', () => {
    //   this.highlightAton(marker, aton);
    // });

    // marker.on('mouseout', () => {
    //   this.removeAtonHighlight(marker, aton);
    // });

    return marker;
  }

  // ✅ Bind AtoN popup dengan informasi lengkap
  private bindAtonPopup(marker: any, aton: AtoN): void {
    const statusColor = aton.status === 'active' ? '#10B981' : '#EF4444';
    const statusText = aton.status === 'active' ? 'ACTIVE' : 'INACTIVE';
    const aidTypeName = this.getAidTypeName(aton.aidType);
    const timeAgo = this.getTimeAgo(aton.lastUpdate);
    
    const popupContent = `
      <div class="aton-popup">
        <div class="popup-header">
          <div class="aton-title">
            <span class="aton-symbol">⚓</span>
            <strong>${aton.name}</strong>
          </div>
          <div class="aton-status" style="color: ${statusColor}">
            ● ${statusText}
          </div>
        </div>
        
        <div class="popup-content">
          <div class="info-row">
            <span class="label">MMSI:</span>
            <span class="value">${aton.mmsi}</span>
          </div>
          <div class="info-row">
            <span class="label">Aid Type:</span>
            <span class="value">${aidTypeName} (${aton.aidType})</span>
          </div>
          <div class="info-row">
            <span class="label">Virtual:</span>
            <span class="value">${aton.isVirtual ? 'Yes' : 'No'}</span>
          </div>
          <div class="info-row">
            <span class="label">Position:</span>
            <span class="value">${aton.latitude.toFixed(6)}°, ${aton.longitude.toFixed(6)}°</span>
          </div>
          <div class="info-row">
            <span class="label">Last Update:</span>
            <span class="value">${timeAgo}</span>
          </div>
        </div>
        
        <div class="popup-actions">
          <button onclick="navigator.clipboard.writeText('${aton.latitude}, ${aton.longitude}')" class="copy-coords-btn">
            📋 Copy Coordinates
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 320,
      className: 'aton-popup-container'
    });
  }

  // ✅ Get Aid Type name
  private getAidTypeName(aidType: number): string {
    const aidTypes: { [key: number]: string } = {
      1: 'Cardinal North', 2: 'Cardinal South', 3: 'Cardinal East', 4: 'Cardinal West',
      5: 'Port Hand Mark', 6: 'Starboard Hand Mark', 7: 'Safe Water',
      8: 'Isolated Danger', 9: 'Special Mark', 10: 'Light Vessel/LANBY/Rigs',
      11: 'Racon', 12: 'ODAS', 13: 'Light', 14: 'Leading Light',
      15: 'Sector Light', 20: 'Significant Object', 28: 'Wreck',
      30: 'Other', 31: 'Virtual Buoy'
    };
    return aidTypes[aidType] || `Unknown Aid Type (${aidType})`;
  }

  // ✅ Get time ago string
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }



  // ✅ Clear semua AtoN markers
  public clearAtonMarkers(): void {
    if (this.atonLayer) {
      this.atonLayer.clearLayers();
    }
    this.atonMarkers.clear();
    console.log('🧹 AtoN markers cleared');
  }

  // ✅ Toggle AtoN visibility
  public toggleAtonVisibility(show: boolean): void {
    if (!this.atonLayer) return;
    
    if (show) {
      if (!this.map.hasLayer(this.atonLayer)) {
        this.map.addLayer(this.atonLayer);
      }
    } else {
      if (this.map.hasLayer(this.atonLayer)) {
        this.map.removeLayer(this.atonLayer);
      }
    }
  }

  // ✅ Refresh AtoN data
  public refreshAtonData(): void {
    console.log('🔄 Refreshing AtoN data...');
    this.loadAndShowAtonMarkers();
  }

  // ✅ Get AtoN count
  public getAtonCount(): number {
    return this.atonMarkers.size;
  }

  // ✅ Focus pada AtoN tertentu
  public focusOnAton(atonId: string): void {
    const marker = this.atonMarkers.get(atonId);
    if (marker && this.map) {
      this.map.setView(marker.getLatLng(), 12);
      marker.openPopup();
    }
  }

  // ✅ Get current AtoN data
  public getCurrentAtonData(): AtoN[] {
    return this.atonDataSubject.value;
  }

  // ✅ Cleanup
  public cleanup(): void {
    this.clearAtonMarkers();
    
    if (this.map && this.atonLayer) {
      this.map.removeLayer(this.atonLayer);
    }
    
    this.atonDataSubject.complete();
    this.loadingSubject.complete();
    
    console.log('🧹 AtonService cleaned up');
  }
}
