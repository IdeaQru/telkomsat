import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MapLegendService {
  private map: any;
  private L: any;
  private legendControl: any;
  private isLegendOpen = false;

  // ✅ Mapping untuk AtoN PNG assets
  private readonly atonIconMapping: { [key: string]: string } = {
    'north-cardinal': 'north-cardinal.png',
    'south-cardinal': 'south-cardinal.png', 
    'east-cardinal': 'east-cardinal.png',
    'west-cardinal': 'west-cardinal.png',
    'port-hand': 'port-hand.png',
    'starboard-hand': 'starboard-hand.png',
    'safe-water': 'safe-water.png',
    'isolated-water': 'isolated_water.png',
    'special-mark': 'special-mark.png',
    'floating-water': 'floating_water.png',
    'virtual_buoy': 'virtual_buoy.png',
    'default': 'special-mark.png'
  };

  initialize(map: any, L: any): void {
    this.map = map;
    this.L = L;
  }

  createLegend(): any {
    const legend = this.L.control({ position: 'bottomright' });
    
    legend.onAdd = (map: any) => {
      const div = this.L.DomUtil.create('div', 'legend-container');
      this.createLegendButton(div);
      
      // Prevent map events when clicking on legend
      this.L.DomEvent.disableClickPropagation(div);
      this.L.DomEvent.disableScrollPropagation(div);
      
      return div;
    };

    this.legendControl = legend;
    return legend;
  }

  private createLegendButton(container: HTMLElement): void {
    container.innerHTML = `
      <div class="legend-button" id="legend-toggle-btn">
        <div class="legend-icon-wrapper">
          <div class="legend-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
              <circle cx="6" cy="18" r="2" fill="#4CAF50"/>
              <circle cx="12" cy="18" r="2" fill="#FF9800"/>
              <circle cx="18" cy="18" r="2" fill="#2196F3"/>
            </svg>
          </div>
          <span class="legend-label">Legend</span>
        </div>
      </div>

      <div class="legend-popup" id="legend-popup">
        <div class="legend-popup-header">
          <div class="legend-title">
            <div class="title-icon">🗺️</div>
            <h3>Maritime Legend</h3>
          </div>
          <button class="legend-close-btn" id="legend-close-btn">✕</button>
        </div>
        
        <div class="legend-popup-content">
          <!-- Vessels Section dengan HTML arrow shapes -->
          <div class="legend-section vessels-section">
            <div class="section-header">
              <div class="section-icon">🚢</div>
              <div class="section-info">
                <h4>Vessels</h4>
                <span class="section-count" id="vessel-count">0</span>
              </div>
            </div>
            <div class="legend-items">
              <!-- Commercial Vessels -->
              <div class="legend-sub-category">
                <div class="sub-category-title">Commercial Vessels</div>
                
                <!-- Tanker -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-tanker legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>Tanker Ships (80-89)</span>
                </div>
                
                <!-- Cargo -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-cargo legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>Cargo Ships (70-79)</span>
                </div>
                
                <!-- Passenger -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-passenger legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>Passenger Ships (60-69)</span>
                </div>
              </div>

              <!-- Special Purpose -->
              <div class="legend-sub-category">
                <div class="sub-category-title">Special Purpose</div>
                
                <!-- Fishing -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-fishing legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>Fishing Vessels (30)</span>
                </div>
                
                <!-- High Speed -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-highspeed legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>High Speed Craft (40-49)</span>
                </div>
                
                <!-- Special -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-special legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>Special Craft (50-59)</span>
                </div>
              </div>

              <!-- Other Vessels -->
              <div class="legend-sub-category">
                <div class="sub-category-title">Other Vessels</div>
                
                <!-- Wing in Ground -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-wing legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>Wing In Ground (20-29)</span>
                </div>
                
                <!-- Reserved -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-reserved legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>Reserved Types (1-19)</span>
                </div>
                
                <!-- Unknown -->
                <div class="legend-item">
                  <div class="vessel-icon vessel-unknown legend-vessel-preview">
                    <div class="arrow-shape"></div>
                  </div>
                  <span>Unknown Type (0)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- VTS Section -->
          <div class="legend-section vts-section">
            <div class="section-header">
              <div class="section-icon">📡</div>
              <div class="section-info">
                <h4>VTS Stations</h4>
                <span class="section-count" id="vts-count">0</span>
              </div>
            </div>
            <div class="legend-items">
              <div class="legend-item">
                <div class="vts-marker legend-vts-preview">
                  <div class="vts-icon base-station">
                    <div class="vts-symbol">📡</div>
                    <div class="vts-status status-active"></div>
                  </div>
                </div>
                <span>Active VTS Base Station</span>
              </div>
              <div class="legend-item">
                <div class="vts-marker legend-vts-preview">
                  <div class="vts-icon sar-aircraft">
                    <div class="vts-symbol">🚁</div>
                    <div class="vts-status status-inactive"></div>
                  </div>
                </div>
                <span>SAR Aircraft/Inactive</span>
              </div>
              <div class="legend-item">
                <div class="vts-marker legend-vts-preview">
                  <div class="vts-icon aid-navigation">
                    <div class="vts-symbol">🚨</div>
                    <div class="vts-status status-active"></div>
                  </div>
                </div>
                <span>Aid to Navigation</span>
              </div>
            </div>
          </div>

          <!-- AtoN Section dengan PNG Icons -->
          <div class="legend-section aton-section">
            <div class="section-header">
              <div class="section-icon">⚓</div>
              <div class="section-info">
                <h4>Aid to Navigation (AtoN)</h4>
                <span class="section-count" id="aton-count">0</span>
              </div>
            </div>
            <div class="legend-items">
              <!-- Cardinal Marks -->
              <div class="legend-sub-category">
                <div class="sub-category-title">Cardinal Marks</div>
                ${this.createAtonLegendItem('north-cardinal', 'North Cardinal')}
                ${this.createAtonLegendItem('south-cardinal', 'South Cardinal')}
                ${this.createAtonLegendItem('east-cardinal', 'East Cardinal')}
                ${this.createAtonLegendItem('west-cardinal', 'West Cardinal')}
              </div>

              <!-- Lateral Marks -->
              <div class="legend-sub-category">
                <div class="sub-category-title">Lateral Marks</div>
                ${this.createAtonLegendItem('port-hand', 'Port Hand Mark')}
                ${this.createAtonLegendItem('starboard-hand', 'Starboard Hand Mark')}
              </div>

              <!-- Safe Water & Special -->
              <div class="legend-sub-category">
                <div class="sub-category-title">Safe Water & Hazards</div>
                ${this.createAtonLegendItem('safe-water', 'Safe Water')}
                ${this.createAtonLegendItem('isolated-water', 'Isolated Danger')}
                ${this.createAtonLegendItem('special-mark', 'Special Mark')}
              </div>

              <!-- Virtual & Others -->
              <div class="legend-sub-category">
                <div class="sub-category-title">Virtual & Others</div>
                ${this.createAtonLegendItem('virtual_buoy', 'Virtual Buoy')}
                ${this.createAtonLegendItem('floating-water', 'ODAS/Floating')}
                <div class="legend-item">
                  <div class="marker-preview aton-inactive"></div>
                  <span>Inactive AtoN</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Vessel Clusters Section -->
          <div class="legend-section clusters-section">
            <div class="section-header">
              <div class="section-icon">🗂️</div>
              <div class="section-info">
                <h4>Vessel Clusters</h4>
                <span class="section-count" id="cluster-info">Auto</span>
              </div>
            </div>
            <div class="legend-items">
              <div class="legend-item">
                <div class="vessel-cluster cluster-small legend-cluster-preview">
                  <div class="cluster-inner">
                    <span class="cluster-count">25</span>
                    <div class="cluster-icon">⚓</div>
                  </div>
                </div>
                <span>Small Cluster (10-49)</span>
              </div>
              <div class="legend-item">
                <div class="vessel-cluster cluster-medium legend-cluster-preview">
                  <div class="cluster-inner">
                    <span class="cluster-count">75</span>
                    <div class="cluster-icon">⚓</div>
                  </div>
                </div>
                <span>Medium Cluster (50-99)</span>
              </div>
              <div class="legend-item">
                <div class="vessel-cluster cluster-large legend-cluster-preview">
                  <div class="cluster-inner">
                    <span class="cluster-count">150</span>
                    <div class="cluster-icon">⚓</div>
                  </div>
                </div>
                <span>Large Cluster (100+)</span>
              </div>
            </div>
          </div>

          <!-- Status Section -->
          <div class="legend-status-section">
            <div class="status-row">
              <div class="status-indicator online" id="connection-status"></div>
              <span>Real-time AIS Data</span>
            </div>
            <div class="optimization-info" id="optimization-info">
              <div class="opt-row">
                <span>Viewport Optimization:</span>
                <span class="opt-status">ACTIVE</span>
              </div>
              <div class="opt-row">
                <span>Visible Markers:</span>
                <span id="visible-markers-count">0</span>
              </div>
            </div>
            <div class="last-update-time" id="legend-last-update">
              Last updated: --:--:--
            </div>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    this.setupEventListeners();
  }

  // ✅ Helper method untuk create AtoN legend item dengan PNG
  private createAtonLegendItem(markerType: string, displayName: string): string {
    const iconPath = this.getAtonIconPath(markerType);
    return `
      <div class="legend-item">
        <div class="aton-png-preview">
          <img src="${iconPath}" alt="${displayName}" onerror="this.src='marker/special-mark.png'">
        </div>
        <span>${displayName}</span>
      </div>
    `;
  }

  // ✅ Get path untuk AtoN PNG icons
  private getAtonIconPath(markerType: string): string {
    const filename = this.atonIconMapping[markerType] || this.atonIconMapping['default'];
    return `marker/${filename}`;
  }

  // Rest of the methods remain the same...
  private setupEventListeners(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('#legend-toggle-btn')) {
        this.toggleLegendPopup();
      } else if (target.closest('#legend-close-btn')) {
        this.closeLegendPopup();
      } else if (!target.closest('.legend-popup') && this.isLegendOpen) {
        this.closeLegendPopup();
      }
    });
  }

  private toggleLegendPopup(): void {
    this.isLegendOpen = !this.isLegendOpen;
    const popup = document.getElementById('legend-popup');
    const button = document.getElementById('legend-toggle-btn');
    
    if (popup && button) {
      if (this.isLegendOpen) {
        popup.classList.add('show');
        button.classList.add('active');
      } else {
        popup.classList.remove('show');
        button.classList.remove('active');
      }
    }
  }

  private closeLegendPopup(): void {
    this.isLegendOpen = false;
    const popup = document.getElementById('legend-popup');
    const button = document.getElementById('legend-toggle-btn');
    
    if (popup && button) {
      popup.classList.remove('show');
      button.classList.remove('active');
    }
  }

  // ✅ Update counts dengan viewport optimization info
  updateCounts(vesselCount: number, vtsCount: number, atonCount: number, connectionStatus: boolean = true, viewportStats?: any): void {
    const vesselCountEl = document.getElementById('vessel-count');
    const vtsCountEl = document.getElementById('vts-count');
    const atonCountEl = document.getElementById('aton-count');
    const lastUpdateEl = document.getElementById('legend-last-update');
    const statusEl = document.getElementById('connection-status');
    const visibleMarkersEl = document.getElementById('visible-markers-count');
    const clusterInfoEl = document.getElementById('cluster-info');

    if (vesselCountEl) vesselCountEl.textContent = vesselCount.toString();
    if (vtsCountEl) vtsCountEl.textContent = vtsCount.toString();
    if (atonCountEl) atonCountEl.textContent = atonCount.toString();
    
    if (lastUpdateEl) {
      const now = new Date();
      lastUpdateEl.textContent = `Last updated: ${now.toLocaleTimeString('id-ID')}`;
    }

    if (statusEl) {
      statusEl.className = `status-indicator ${connectionStatus ? 'online' : 'offline'}`;
    }

    // ✅ Update viewport optimization info
    if (viewportStats && visibleMarkersEl) {
      visibleMarkersEl.textContent = viewportStats.visibleMarkers.toString();
    }

    if (viewportStats && clusterInfoEl) {
      clusterInfoEl.textContent = viewportStats.clusterMarkers > 0 ? 
        `${viewportStats.clusterMarkers} clusters` : 'Individual';
    }
  }

  addToMap(): void {
    if (this.map && this.legendControl) {
      this.legendControl.addTo(this.map);
    }
  }

  removeFromMap(): void {
    if (this.map && this.legendControl) {
      this.map.removeControl(this.legendControl);
    }
  }

  cleanup(): void {
    this.removeFromMap();
    this.legendControl = null;
    this.isLegendOpen = false;
  }
}
