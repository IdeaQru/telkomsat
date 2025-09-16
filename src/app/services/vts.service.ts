// vts.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
// ✅ Interface sesuai dengan format API response Anda
export interface VTSApiResponse {
  success: boolean;
  data: VTSRawData[];
}

export interface VTSRawData {
  mmsi: string;
  shipname: string;
  dynamicData: {
    data: {
      lon: number;
      lat: number;
      aistype: number;
      mmsi: string;
      class: string;
    };
    createdAt: string;
    updatedAt: string;
  };
  receivedTime: string;
}

// ✅ Interface untuk VTS yang sudah diproses
export interface VTS {
  id: string;
  mmsi: string;
  name: string;
  latitude: number;
  longitude: number;
  aisType: number;
  class: string;
  lastUpdate: Date;
  status: 'active' | 'inactive';
}

@Injectable({
  providedIn: 'root'
})
export class VtsService {
  private readonly apiUrl = 'https://demo.osi.my.id/api/vts';
  // private readonly apiUrl = `${environment.apiUrl}/vts`;
  private map: any;
  private L: any;
  private vtsMarkers: Map<string, any> = new Map();
  private vtsLayer: any;
  
  // State management
  private vtsDataSubject = new BehaviorSubject<VTS[]>([]);
  public vtsData$ = this.vtsDataSubject.asObservable();
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ✅ Initialize service dengan peta
  public initialize(map: any, L: any): void {
    this.map = map;
    this.L = L;
    
    // Create VTS layer group
    this.vtsLayer = this.L.layerGroup().addTo(this.map);
    
    console.log('🏛️ VtsService initialized');
  }

  // ✅ Fetch VTS data dari API dan transform sesuai format
  public getVtsList(): Observable<VTS[]> {
    this.loadingSubject.next(true);
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    
    return this.http.get<VTSApiResponse>(this.apiUrl, { headers }).pipe(
      map((response: VTSApiResponse) => {
        if (response.success && response.data) {
          return this.transformVtsData(response.data);
        }
        return [];
      }),
      tap((data: VTS[]) => {
        console.log(`📡 Received and transformed ${data.length} VTS stations from API`);
        this.vtsDataSubject.next(data);
        this.loadingSubject.next(false);
      }),
      catchError((error:any) => {
        console.error('❌ Error fetching VTS data:', error);
        this.loadingSubject.next(false);
        
        // Return sample data jika API gagal
     
        
        // console.log('📊 Using sample VTS data due to API error');
        // this.vtsDataSubject.next(sampleVts);
        return of([]);
      })
    );
  }

  // ✅ Transform raw API data ke format VTS yang bersih
  private transformVtsData(rawData: VTSRawData[]): VTS[] {
    return rawData
      .filter(item => item.dynamicData?.data?.lat && item.dynamicData?.data?.lon)
      .map(item => {
        const { dynamicData } = item;
        const { data } = dynamicData;
        
        // Determine status berdasarkan waktu update
        const lastUpdateTime = new Date(item.receivedTime);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
        const status: 'active' | 'inactive' = hoursDiff < 1 ? 'active' : 'inactive';

        return {
          id: `vts-${item.mmsi}`,
          mmsi: item.mmsi,
          name: item.shipname !== 'Unknown' ? item.shipname : `VTS-${item.mmsi}`,
          latitude: data.lat,
          longitude: data.lon,
          aisType: data.aistype,
          class: data.class,
          lastUpdate: lastUpdateTime,
          status: status
        };
      })
      .filter(vts => 
        // Filter koordinat valid
        vts.latitude >= -90 && vts.latitude <= 90 &&
        vts.longitude >= -180 && vts.longitude <= 180 &&
        !(vts.latitude === 0 && vts.longitude === 0)
      );
  }

  // ✅ Load dan tampilkan VTS markers
  public loadAndShowVtsMarkers(): void {
    if (!this.map || !this.L) {
      console.warn('⚠️ Map not initialized, cannot show VTS markers');
      return;
    }

    this.getVtsList().subscribe((vtsList: VTS[]) => {
      this.clearVtsMarkers();
      this.createVtsMarkers(vtsList);
      console.log(`✅ Displayed ${vtsList.length} VTS markers on map`);
    });
  }

  // ✅ Create VTS markers
  private createVtsMarkers(vtsList: VTS[]): void {
    vtsList.forEach(vts => {
      try {
        const marker = this.createVtsMarker(vts);
        if (marker) {
          this.vtsLayer.addLayer(marker);
          this.vtsMarkers.set(vts.id, marker);
        }
      } catch (error) {
        console.error(`❌ Error creating marker for VTS ${vts.id}:`, error);
      }
    });
  }

  // ✅ Create individual VTS marker dengan styling berbeda berdasarkan AIS type
  private createVtsMarker(vts: VTS): any {
    const isActive = vts.status === 'active';
    const aisTypeClass = this.getAisTypeClass(vts.aisType);
    
    // Custom VTS icon berdasarkan AIS type
    const vtsHtml = `
      <div class="vts-marker ${isActive ? 'active' : 'inactive'} ${aisTypeClass}"
           data-vts-id="${vts.id}"
           title="${vts.name}">
        <div class="vts-icon">
          <div class="vts-symbol">${this.getAisTypeSymbol(vts.aisType)}</div>
          <div class="vts-status ${isActive ? 'status-active' : 'status-inactive'}"></div>
        </div>
        
      </div>
    `;

    const vtsIcon = this.L.divIcon({
      html: vtsHtml,
      className: 'custom-vts-marker',
      iconSize: [30, 30],
      iconAnchor: [25, 30],
      popupAnchor: [0, -30]
    });

    const marker = this.L.marker([vts.latitude, vts.longitude], {
      icon: vtsIcon,
      title: vts.name
    });

    // ✅ Bind popup dengan info detail
    this.bindVtsPopup(marker, vts);

    // ✅ Event handlers
    marker.on('mouseover', () => {
      this.highlightVts(marker, vts);
    });

    marker.on('mouseout', () => {
      this.removeVtsHighlight(marker, vts);
    });

    return marker;
  }

  // ✅ Get AIS type class untuk styling
  private getAisTypeClass(aisType: number): string {
    switch (aisType) {
      case 4: return 'base-station';
      case 9: return 'sar-aircraft';
      case 21: return 'aid-navigation';
      default: return 'unknown-type';
    }
  }

  // ✅ Get AIS type symbol
  private getAisTypeSymbol(aisType: number): string {
    switch (aisType) {
      case 4: return '📡'; // Base Station
      case 9: return '🚁'; // SAR Aircraft
      case 21: return '🚨'; // Aid to Navigation
      default: return '📡'; // Unknown
    }
  }

  // ✅ Bind VTS popup dengan informasi lengkap
  private bindVtsPopup(marker: any, vts: VTS): void {
    const statusColor = vts.status === 'active' ? '#10B981' : '#EF4444';
    const statusText = vts.status === 'active' ? 'ACTIVE' : 'INACTIVE';
    const aisTypeName = this.getAisTypeName(vts.aisType);
    const timeAgo = this.getTimeAgo(vts.lastUpdate);
    
    const popupContent = `
      <div class="vts-popup">
        <div class="popup-header">
          <div class="vts-title">
            <span class="vts-symbol">${this.getAisTypeSymbol(vts.aisType)}</span>
            <strong>${vts.name}</strong>
          </div>
          <div class="vts-status" style="color: ${statusColor}">
            ● ${statusText}
          </div>
        </div>
        
        <div class="popup-content">
          <div class="info-row">
            <span class="label">MMSI:</span>
            <span class="value">${vts.mmsi}</span>
          </div>
          <div class="info-row">
            <span class="label">AIS Type:</span>
            <span class="value">${aisTypeName} (${vts.aisType})</span>
          </div>
          <div class="info-row">
            <span class="label">Class:</span>
            <span class="value">${vts.class || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="label">Position:</span>
            <span class="value">${vts.latitude.toFixed(6)}°, ${vts.longitude.toFixed(6)}°</span>
          </div>
          <div class="info-row">
            <span class="label">Last Update:</span>
            <span class="value">${timeAgo}</span>
          </div>
        </div>
        
        <div class="popup-actions">
          <button onclick="navigator.clipboard.writeText('${vts.latitude}, ${vts.longitude}')" class="copy-coords-btn">
            📋 Copy Coordinates
          </button>
          <button onclick="console.log('Focus on VTS:', '${vts.mmsi}')" class="focus-btn">
            🎯 Focus on Map
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 320,
      className: 'vts-popup-container'
    });
  }

  // ✅ Get AIS type name
  private getAisTypeName(aisType: number): string {
    const aisTypes: { [key: number]: string } = {
      4: 'Base Station',
      9: 'SAR Aircraft',
      21: 'Aid to Navigation',
      1: 'Position Report (Class A)',
      2: 'Position Report (Class A)',
      3: 'Position Report (Class A)',
      5: 'Static and Voyage Related Data',
      18: 'Standard Class B Position Report',
      19: 'Extended Class B Position Report'
    };
    return aisTypes[aisType] || `Unknown Type (${aisType})`;
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

  // ✅ Highlight VTS on hover
  private highlightVts(marker: any, vts: VTS): void {
    if (marker._icon) {
      const markerElement = marker._icon.querySelector('.vts-marker');
      if (markerElement) {
        markerElement.style.transform = 'scale(1.2)';
        markerElement.style.zIndex = '1000';
      }
    }
  }

  // ✅ Remove VTS highlight
  private removeVtsHighlight(marker: any, vts: VTS): void {
    if (marker._icon) {
      const markerElement = marker._icon.querySelector('.vts-marker');
      if (markerElement) {
        markerElement.style.transform = 'scale(1)';
        markerElement.style.zIndex = '';
      }
    }
  }

  // ✅ Clear semua VTS markers
  public clearVtsMarkers(): void {
    if (this.vtsLayer) {
      this.vtsLayer.clearLayers();
    }
    this.vtsMarkers.clear();
    console.log('🧹 VTS markers cleared');
  }

  // ✅ Toggle VTS visibility
  public toggleVtsVisibility(show: boolean): void {
    if (!this.vtsLayer) return;
    
    if (show) {
      if (!this.map.hasLayer(this.vtsLayer)) {
        this.map.addLayer(this.vtsLayer);
      }
    } else {
      if (this.map.hasLayer(this.vtsLayer)) {
        this.map.removeLayer(this.vtsLayer);
      }
    }
  }

  // ✅ Refresh VTS data
  public refreshVtsData(): void {
    console.log('🔄 Refreshing VTS data...');
    this.loadAndShowVtsMarkers();
  }

  // ✅ Get VTS count
  public getVtsCount(): number {
    return this.vtsMarkers.size;
  }

  // ✅ Focus pada VTS tertentu
  public focusOnVts(vtsId: string): void {
    const marker = this.vtsMarkers.get(vtsId);
    if (marker && this.map) {
      this.map.setView(marker.getLatLng(), 12);
      marker.openPopup();
    }
  }

  // ✅ Get current VTS data
  public getCurrentVtsData(): VTS[] {
    return this.vtsDataSubject.value;
  }

  // ✅ Cleanup
  public cleanup(): void {
    this.clearVtsMarkers();
    
    if (this.map && this.vtsLayer) {
      this.map.removeLayer(this.vtsLayer);
    }
    
    this.vtsDataSubject.complete();
    this.loadingSubject.complete();
    
    console.log('🧹 VtsService cleaned up');
  }
}
