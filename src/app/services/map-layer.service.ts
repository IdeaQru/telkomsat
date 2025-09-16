import { Injectable } from '@angular/core';

export interface MapLayer {
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MapLayerService {
  private layers: MapLayer[] = [
    {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    },
    {
      name: 'Satellite',
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      attribution: '© Google Satellite',
      maxZoom: 20
    },
    {
      name: 'Dark',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '© CARTO © OpenStreetMap contributors',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd']
    },
    {
      name: 'Ocean',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri © GEBCO, NOAA',
      maxZoom: 13
    },
    {
      name: 'Streets',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      maxZoom: 19
    },
    {
      name: 'Terrain',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
      maxZoom: 13
    }
  ];

  getLayers(): MapLayer[] {
    return this.layers;
  }

  getLayerByName(name: string): MapLayer | undefined {
    return this.layers.find(layer => layer.name === name);
  }

  createLeafletLayer(layerConfig: MapLayer, L: any): any {
    const options = {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom || 18,
      ...(layerConfig.subdomains && { subdomains: layerConfig.subdomains })
    };

    return L.tileLayer(layerConfig.url, options);
  }
}
