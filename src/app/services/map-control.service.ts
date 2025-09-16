// map-control.service.ts
import { Injectable, signal } from '@angular/core';

export interface MapControl {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapControlsService {
  private controlsSignal = signal<MapControl[]>([
    {
      id: 'ruler',
      name: 'Penggaris',
      icon: 'fas fa-ruler-combined',
      enabled: false,
      description: 'Mengukur jarak dan area di peta (km, nm, meter)'
    },
    {
      id: 'marker',
      name: 'Marker',
      icon: 'fas fa-map-pin',
      enabled: false,
      description: 'Menambahkan marker kustom dengan koordinat'
    },
    {
      id: 'fullscreen',
      name: 'Fullscreen',
      icon: 'fas fa-expand',
      enabled: false,
      description: 'Mode tampilan layar penuh'
    },
    {
      id: 'geolocation',
      name: 'Lokasi Saya',
      icon: 'fas fa-location-arrow',
      enabled: false,
      description: 'Tampilkan lokasi GPS saat ini'
    },
    {
      id: 'draw',
      name: 'Gambar',
      icon: 'fas fa-pen',
      enabled: false,
      description: 'Menggambar polygon dan hitung luas area'
    },
     { 
          id: 'vts', 
          name: 'VTS Stations', 
          icon: 'fas fa-tower-broadcast', 
          enabled: true, 
          description: 'Toggle VTS stations visibility' 
        },
        {
          id: 'aton',
          name: 'AtoN',
          icon: 'fas fa-anchor',
          enabled: true,
          description: 'Toggle AtoN visibility'
        }
   
  ]);

  getControls(): MapControl[] {
    return this.controlsSignal();
  }

  getControlById(id: string): MapControl | undefined {
    return this.controlsSignal().find(control => control.id === id);
  }

  toggleControl(controlId: string): void {
    this.controlsSignal.update(controls =>
      controls.map(control => {
        if (control.id === controlId) {
          return { ...control, enabled: !control.enabled };
        } else {
          // Disable other controls when one is activated (except fullscreen)
          if (controlId !== 'fullscreen' && controlId !== 'geolocation') {
            return { ...control, enabled: false };
          }
          return control;
        }
      })
    );
  }

  isControlEnabled(controlId: string): boolean {
    const control = this.getControlById(controlId);
    return control ? control.enabled : false;
  }

  // ✅ TAMBAHAN: Enable specific control
  enableControl(controlId: string): void {
    this.controlsSignal.update(controls =>
      controls.map(control =>
        control.id === controlId
          ? { ...control, enabled: true }
          : control
      )
    );
  }

  // ✅ TAMBAHAN: Disable specific control
  disableControl(controlId: string): void {
    this.controlsSignal.update(controls =>
      controls.map(control =>
        control.id === controlId
          ? { ...control, enabled: false }
          : control
      )
    );
  }

  // ✅ TAMBAHAN: Disable all controls
  disableAllControls(): void {
    this.controlsSignal.update(controls =>
      controls.map(control => ({ ...control, enabled: false }))
    );
  }
  
}
