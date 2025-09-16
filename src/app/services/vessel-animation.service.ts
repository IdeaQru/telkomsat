import { Injectable } from '@angular/core';

export interface AnimationConfig {
  duration: number;
  showTrail: boolean;
  trailColor: string;
  trailWidth: number;
  trailOpacity: number;
  fadeOutDuration: number;
}

@Injectable({
  providedIn: 'root'
})
export class VesselAnimationService {
  private activeAnimations: Map<number, number> = new Map();
  private trailLayers: Map<number, any> = new Map();

  private defaultConfig: AnimationConfig = {
    duration: 2000,
    showTrail: true,
    trailColor: '#00ff00',
    trailWidth: 3,
    trailOpacity: 0.8,
    fadeOutDuration: 3000
  };

  constructor() {
    console.log('🎬 VesselAnimationService initialized');
  }

  // ✅ FIXED: All required parameters first, then optional parameters
  public animateVesselMovement(
    marker: any,                                    // Required
    fromLatLng: [number, number],                  // Required
    toLatLng: [number, number],                    // Required
    mmsi: number,                                  // Required
    config: Partial<AnimationConfig> = {},         // Optional with default
    heading?: number,                              // Optional
    L?: any,                                       // Optional
    map?: any                                      // Optional
  ): void {
    const animConfig = { ...this.defaultConfig, ...config };

    // Cancel existing animation for this vessel
    this.cancelAnimation(mmsi);

    // Create trail if enabled
    if (animConfig.showTrail && L && map) {
      this.createMovementTrail(fromLatLng, toLatLng, mmsi, L, map, animConfig);
    }

    // Start smooth marker animation
    this.startMarkerAnimation(marker, fromLatLng, toLatLng, mmsi, animConfig, heading);
  }

  // ✅ FIXED: Parameter ordering for createMovementTrail
  private createMovementTrail(
    fromLatLng: [number, number],
    toLatLng: [number, number],
    mmsi: number,
    L: any,
    map: any,
    config: AnimationConfig
  ): void {
    // Remove existing trail
    this.removeTrail(mmsi, map);

    // Create polyline trail
    const trailLine = L.polyline([fromLatLng, toLatLng], {
      color: config.trailColor,
      weight: config.trailWidth,
      opacity: config.trailOpacity,
      className: `vessel-trail-${mmsi}`,
      dashArray: '5, 10'
    });

    // Add animated dots along the trail
    const dots = this.createTrailDots(fromLatLng, toLatLng, L, config);

    // Add to map
    trailLine.addTo(map);
    dots.forEach(dot => dot.addTo(map));

    // Store trail data
    this.trailLayers.set(mmsi, {
      line: trailLine,
      dots: dots,
      createdAt: Date.now()
    });

    // Auto fade out trail
    setTimeout(() => {
      this.fadeOutTrail(mmsi, map, config);
    }, config.fadeOutDuration);
  }

  // ✅ Create animated dots along trail
  private createTrailDots(
    fromLatLng: [number, number],
    toLatLng: [number, number],
    L: any,
    config: AnimationConfig
  ): any[] {
    const dots: any[] = [];
    const numDots = 8;

    for (let i = 1; i <= numDots; i++) {
      const ratio = i / (numDots + 1);
      const lat = fromLatLng[0] + (toLatLng[0] - fromLatLng[0]) * ratio;
      const lng = fromLatLng[1] + (toLatLng[1] - fromLatLng[1]) * ratio;

      const dot = L.circleMarker([lat, lng], {
        radius: 3,
        fillColor: config.trailColor,
        fillOpacity: config.trailOpacity,
        stroke: false,
        className: 'vessel-trail-dot'
      });

      // Add pulsing animation with delay
      setTimeout(() => {
        if (dot._path) {
          dot._path.style.animation = `vessel-dot-pulse 0.6s ease-out`;
        }
      }, i * 100);

      dots.push(dot);
    }

    return dots;
  }

  // ✅ FIXED: Parameter ordering for startMarkerAnimation
  private startMarkerAnimation(
    marker: any,
    fromLatLng: [number, number],
    toLatLng: [number, number],
    mmsi: number,
    config: AnimationConfig,
    heading?: number                               // Optional parameter last
  ): void {
    const startTime = performance.now();
    const duration = config.duration;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation (ease-out)
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      // Calculate interpolated position
      const currentLat = fromLatLng[0] + (toLatLng[0] - fromLatLng[0]) * easedProgress;
      const currentLng = fromLatLng[1] + (toLatLng[1] - fromLatLng[1]) * easedProgress;

      // Update marker position
      marker.setLatLng([currentLat, currentLng]);

      // Update rotation if heading provided
      if (heading !== undefined && marker._icon) {
        const vesselIcon = marker._icon.querySelector('.vessel-icon');
        if (vesselIcon) {
          vesselIcon.style.transform = `rotate(${heading}deg)`;
          vesselIcon.classList.add('moving');
        }
      }

      // Add moving class for visual effects
      if (marker._icon) {
        marker._icon.classList.add('vessel-moving');
      }

      if (progress < 1) {
        const animationId = requestAnimationFrame(animate);
        this.activeAnimations.set(mmsi, animationId);
      } else {
        // Animation complete
        this.activeAnimations.delete(mmsi);
        if (marker._icon) {
          marker._icon.classList.remove('vessel-moving');
          const vesselIcon = marker._icon.querySelector('.vessel-icon');
          if (vesselIcon) {
            vesselIcon.classList.remove('moving');
          }
        }
        console.log(`✅ Animation completed for vessel ${mmsi}`);
      }
    };

    const animationId = requestAnimationFrame(animate);
    this.activeAnimations.set(mmsi, animationId);
  }

  // ✅ Fade out trail
  private fadeOutTrail(mmsi: number, map: any, config: AnimationConfig): void {
    const trailData = this.trailLayers.get(mmsi);
    if (!trailData) return;

    const startTime = performance.now();
    const duration = 1000;

    const fade = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const opacity = config.trailOpacity * (1 - progress);

      // Fade trail line
      if (trailData.line && trailData.line.setStyle) {
        trailData.line.setStyle({ opacity: opacity });
      }

      // Fade dots
      trailData.dots.forEach((dot: any) => {
        if (dot && dot.setStyle) {
          dot.setStyle({ fillOpacity: opacity });
        }
      });

      if (progress < 1) {
        requestAnimationFrame(fade);
      } else {
        this.removeTrail(mmsi, map);
      }
    };

    requestAnimationFrame(fade);
  }

  // ✅ Remove trail
  private removeTrail(mmsi: number, map: any): void {
    const trailData = this.trailLayers.get(mmsi);
    if (!trailData) return;

    // Remove line
    if (trailData.line) {
      map.removeLayer(trailData.line);
    }

    // Remove dots
    trailData.dots.forEach((dot: any) => {
      if (dot) {
        map.removeLayer(dot);
      }
    });

    this.trailLayers.delete(mmsi);
  }

  // ✅ Cancel animation
  public cancelAnimation(mmsi: number): void {
    const animationId = this.activeAnimations.get(mmsi);
    if (animationId) {
      cancelAnimationFrame(animationId);
      this.activeAnimations.delete(mmsi);
    }
  }

  // ✅ Cancel all animations
  public cancelAllAnimations(): void {
    this.activeAnimations.forEach((animationId) => {
      cancelAnimationFrame(animationId);
    });
    this.activeAnimations.clear();
  }

  // ✅ Cleanup
  public cleanup(map: any): void {
    this.cancelAllAnimations();

    // Remove all trails
    this.trailLayers.forEach((trailData, mmsi) => {
      this.removeTrail(mmsi, map);
    });

    console.log('🧹 VesselAnimationService cleaned up');
  }

  // ✅ Get animation statistics
  public getAnimationStats(): any {
    return {
      activeAnimations: this.activeAnimations.size,
      activeTrails: this.trailLayers.size,
      config: this.defaultConfig
    };
  }

  // ✅ Update config
  public updateConfig(newConfig: Partial<AnimationConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...newConfig };
    console.log('🔧 Animation config updated:', this.defaultConfig);
  }
}
