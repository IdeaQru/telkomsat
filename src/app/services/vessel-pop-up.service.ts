import { Injectable } from '@angular/core';
import { Vessel } from './telkomsat-api-service';

@Injectable({
  providedIn: 'root'
})
export class VesselPopupService {

  constructor() {}

  // ✅ GENERATE VESSEL POPUP CONTENT
  public generateVesselPopupContent(vessel: Vessel): string {
    const vesselTypeDesc = this.getVesselTypeDescription(vessel.vesselType);
    const navStatusDesc = this.getNavigationStatusDescription(vessel.navStatus);
    const timeAgo = this.getTimeAgo(new Date(vessel.timestamp));
    
    return `
      <div class="vessel-popup optimized telkomsat-popup">
        <div class="popup-header">
          <strong>${vessel.name || 'Unknown Vessel'}</strong>
          <small class="vessel-type">(${vesselTypeDesc})</small>
          <div class="source-badge">🛰️ Telkomsat</div>
        </div>
        <div class="popup-content">
          <div class="popup-row">
            <span class="label">MMSI:</span>
            <span class="value">${vessel.mmsi}</span>
          </div>
          <div class="popup-row">
            <span class="label">Call Sign:</span>
            <span class="value">${vessel.callSign || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="label">Speed:</span>
            <span class="value">${vessel.speed?.toFixed(1) || '0'} knots</span>
          </div>
          <div class="popup-row">
            <span class="label">Course:</span>
            <span class="value">${vessel.course?.toFixed(0) || '0'}°</span>
          </div>
          ${vessel.heading ? `
          <div class="popup-row">
            <span class="label">Heading:</span>
            <span class="value">${vessel.heading.toFixed(0)}°</span>
          </div>
          ` : ''}
          <div class="popup-row">
            <span class="label">Status:</span>
            <span class="value">${navStatusDesc}</span>
          </div>
          <div class="popup-row">
            <span class="label">Destination:</span>
            <span class="value">${vessel.destination || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="label">eta:</span>
            <span class="value">${vessel.eta || 'N/A'}</span>
          </div>
          <div class="popup-row">
            <span class="label">Position:</span>
            <span class="value">${vessel.latitude.toFixed(4)}°, ${vessel.longitude.toFixed(4)}°</span>
          </div>
          <div class="popup-row">
            <span class="label">Last Update:</span>
            <span class="value">${timeAgo}</span>
          </div>
          ${vessel.length && vessel.width ? `
          <div class="popup-row">
            <span class="label">Dimensions:</span>
            <span class="value">${vessel.length}m × ${vessel.width}m</span>
          </div>
          ` : ''}
          <div class="popup-row">
            <span class="label"> Data Source:</span>
            // <span
          </div>
          
        </div>
        <div class="popup-actions">
        
          <button class="action-btn" onclick="navigator.clipboard.writeText('${vessel.latitude}, ${vessel.longitude}')">
            📋 Copy Position
          </button>
        </div>
      </div>
    `;
  }

  // ✅ GENERATE CLUSTER POPUP CONTENT
  public generateClusterPopupContent(vesselCount: number, center: { lat: number; lng: number }, currentZoom: number): string {
    const zoomToSeeVessels = Math.max(13, currentZoom + 1);
    
    return `
      <div class="cluster-popup optimized telkomsat-cluster">
        <div class="popup-header">
          <strong>${this.formatCount(vesselCount)} Vessels</strong>
          <div class="source-badge">🛰️ Telkomsat Network</div>
        </div>
        <div class="popup-content">
          <div class="cluster-info">
            <p><strong>📍 Position:</strong> ${center.lat.toFixed(4)}°, ${center.lng.toFixed(4)}°</p>
            <p><strong>🔍 Current Zoom:</strong> ${currentZoom.toFixed(1)}</p>
            ${currentZoom < 13 ? 
              `<p><strong>💡 Tip:</strong> Zoom to level 13+ to see individual vessels</p>` :
              `<p><strong>🚢 Individual vessels visible at this zoom level</strong></p>`
            }
          </div>
        </div>
        <div class="popup-actions">
          ${currentZoom < 13 ? 
            `<button class="zoom-btn" data-action="zoom" data-lat="${center.lat}" data-lng="${center.lng}" data-zoom="${zoomToSeeVessels}">
              🔍 Zoom to see vessels
            </button>` :
            `<small>Click cluster to zoom in further</small>`
          }
        </div>
      </div>
    `;
  }

  // ✅ GENERATE MINIMAL POPUP (for performance mode)
  public generateMinimalPopupContent(vessel: Vessel): string {
    return `
      <div class="vessel-popup-minimal">
        <div class="vessel-name-min">${vessel.name || 'Unknown'}</div>
        <div class="vessel-info-min">
          MMSI: ${vessel.mmsi}<br>
          Speed: ${vessel.speed?.toFixed(1) || '0'} knots<br>
          Course: ${vessel.course?.toFixed(0) || '0'}°
        </div>
      </div>
    `;
  }

  // ✅ GET POPUP OPTIONS for different types
  public getPopupOptions(type: 'vessel' | 'cluster' | 'minimal'): any {
    const baseOptions = {
      closeButton: true,
      autoClose: true
    };

    switch (type) {
      case 'vessel':
        return {
          ...baseOptions,
          maxWidth: 380,
          minWidth: 320,
          className: 'optimized-popup-telkomsat',
          autoClose: false
        };
      case 'cluster':
        return {
          ...baseOptions,
          maxWidth: 300,
          className: 'optimized-cluster-popup-telkomsat',
          autoClose: false
        };
      case 'minimal':
        return {
          ...baseOptions,
          maxWidth: 200,
          className: 'optimized-popup-minimal',
          closeButton: false
        };
      default:
        return baseOptions;
    }
  }

  // ✅ HELPER METHODS
  private getVesselTypeDescription(vesselType?: number): string {
    const vesselTypes: { [key: number]: string } = {
      0: 'Unknown', 30: 'Fishing', 31: 'Towing', 32: 'Towing (large)',
      33: 'Dredging', 34: 'Diving', 35: 'Military', 36: 'Sailing',
      37: 'Pleasure craft', 40: 'High-speed craft', 50: 'Pilot vessel',
      51: 'Search and rescue', 52: 'Tug', 53: 'Port tender',
      54: 'Anti-pollution', 55: 'Law enforcement', 58: 'Medical',
      59: 'Special craft', 60: 'Passenger', 70: 'Cargo',
      71: 'Cargo (hazardous A)', 72: 'Cargo (hazardous B)',
      73: 'Cargo (hazardous C)', 74: 'Cargo (hazardous D)',
      80: 'Tanker', 81: 'Tanker (hazardous A)', 82: 'Tanker (hazardous B)',
      83: 'Tanker (hazardous C)', 84: 'Tanker (hazardous D)', 90: 'Other'
    };
    return vesselTypes[vesselType || 0] || 'Unknown';
  }

  private getNavigationStatusDescription(navStatus?: number): string {
    const navStatuses: { [key: number]: string } = {
      0: 'Under way using engine', 1: 'At anchor', 2: 'Not under command',
      3: 'Restricted manoeuvrability', 4: 'Constrained by her draught',
      5: 'Moored', 6: 'Aground', 7: 'Engaged in fishing',
      8: 'Under way sailing', 15: 'Not defined'
    };
    return navStatuses[navStatus || 15] || 'Not defined';
  }

  private getTimeAgo(date: Date): string {
    const now = new Date().toLocaleString('id-ID');
    return now;
  }

  private formatCount(count: number): string {
    if (count >= 1000000) return `${(count/1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count/1000).toFixed(1)}K`;
    return count.toString();
  }

  // ✅ UTILITY METHOD for popup binding
  public bindPopupToMarker(marker: any, vessel: Vessel, L: any, type: 'vessel' | 'minimal' = 'vessel'): void {
    const content = type === 'vessel' 
      ? this.generateVesselPopupContent(vessel)
      : this.generateMinimalPopupContent(vessel);
    
    const options = this.getPopupOptions(type);
    
    marker.bindPopup(content, options);
  }

  public bindClusterPopupToMarker(marker: any, vesselCount: number, center: { lat: number; lng: number }, currentZoom: number, L: any): void {
    const content = this.generateClusterPopupContent(vesselCount, center, currentZoom);
    const options = this.getPopupOptions('cluster');
    
    marker.bindPopup(content, options);
  }
}
