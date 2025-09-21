import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Vessel } from './vessel-websocket.service';

export interface VesselPosition {
  mmsi: number;
  latitude: number;
  longitude: number;
  timestamp: Date;
  heading?: number;
  speed?: number;
}

export interface VesselMovement {
  mmsi: number;
  previousPosition?: VesselPosition;
  currentPosition: VesselPosition;
  distance: number; // meters
  hasMoved: boolean;
  speed: number; // knots
}

// ✅ ADD: VesselTrack interface yang dibutuhkan
export interface VesselTrack {
  mmsi: number;
  positions: VesselPosition[];
  currentPosition: VesselPosition;
  previousPosition?: VesselPosition;
  isMoving: boolean;
  totalDistance: number; // in meters
  averageSpeed: number; // in knots
}

@Injectable({
  providedIn: 'root'
})
export class VesselTrackingService {
  private vesselPositions: Map<number, VesselPosition> = new Map();
  private vesselTracks: Map<number, VesselTrack> = new Map(); // ✅ ADD: Missing property
  private movementSubject = new BehaviorSubject<VesselMovement[]>([]);
  
  public vesselMovements$ = this.movementSubject.asObservable();
  
  private readonly MIN_MOVEMENT_DISTANCE = 20; // 20 meters minimum
  private readonly MAX_TRACK_POINTS = 50; // Maximum positions to store per vessel

  constructor() {
    console.log('🛤️ VesselTrackingService initialized');
  }

  // ✅ UPDATE VESSEL POSITIONS and detect movements
  public updateVesselPositions(vessels: Vessel[]): VesselMovement[] {
    const movements: VesselMovement[] = [];

    vessels.forEach(vessel => {
      const movement = this.processVesselUpdate(vessel);
      if (movement) {
        movements.push(movement);
      }
    });

    // Notify subscribers
    this.movementSubject.next(movements);
    return movements;
  }

  // ✅ PROCESS SINGLE VESSEL UPDATE
  private processVesselUpdate(vessel: Vessel): VesselMovement | null {
    const mmsi = vessel.mmsi;
    const newPosition: VesselPosition = {
      mmsi: mmsi,
      latitude: vessel.latitude,
      longitude: vessel.longitude,
      timestamp: new Date(vessel.timestamp),
      heading: vessel.heading,
      speed: vessel.speed
    };

    const previousPosition = this.vesselPositions.get(mmsi);
    let track = this.vesselTracks.get(mmsi);
    
    if (!previousPosition) {
      // First time seeing this vessel
      this.vesselPositions.set(mmsi, newPosition);
      
      // ✅ CREATE NEW TRACK
      track = {
        mmsi: mmsi,
        positions: [newPosition],
        currentPosition: newPosition,
        isMoving: false,
        totalDistance: 0,
        averageSpeed: vessel.speed || 0
      };
      this.vesselTracks.set(mmsi, track);
      
      return {
        mmsi: mmsi,
        currentPosition: newPosition,
        distance: 0,
        hasMoved: false,
        speed: vessel.speed || 0
      };
    }

    // Calculate distance moved
    const distance = this.calculateDistance(
      previousPosition.latitude,
      previousPosition.longitude,
      newPosition.latitude,
      newPosition.longitude
    );

    const hasMoved = distance >= this.MIN_MOVEMENT_DISTANCE;

    if (hasMoved) {
      // Update stored position
      this.vesselPositions.set(mmsi, newPosition);
      
      // ✅ UPDATE TRACK
      if (track) {
        track.previousPosition = { ...track.currentPosition };
        track.currentPosition = newPosition;
        track.isMoving = true;
        track.totalDistance += distance;
        
        // Add to positions history
        track.positions.push(newPosition);
        
        // Keep only recent positions
        if (track.positions.length > this.MAX_TRACK_POINTS) {
          track.positions = track.positions.slice(-this.MAX_TRACK_POINTS);
        }
        
        // Calculate average speed
        track.averageSpeed = this.calculateAverageSpeed(track.positions);
        
        this.vesselTracks.set(mmsi, track);
      }
      
      console.log(`🚢 Vessel ${mmsi} moved ${distance.toFixed(1)}m`);
      
      return {
        mmsi: mmsi,
        previousPosition: previousPosition,
        currentPosition: newPosition,
        distance: distance,
        hasMoved: true,
        speed: this.calculateSpeed(previousPosition, newPosition, distance)
      };
    } else {
      // Update timestamp but no significant movement
      const updatedPosition = { ...previousPosition, timestamp: newPosition.timestamp };
      this.vesselPositions.set(mmsi, updatedPosition);
      
      // ✅ UPDATE TRACK
      if (track) {
        track.currentPosition = updatedPosition;
        track.isMoving = false;
        this.vesselTracks.set(mmsi, track);
      }
      
      return {
        mmsi: mmsi,
        previousPosition: previousPosition,
        currentPosition: updatedPosition,
        distance: distance,
        hasMoved: false,
        speed: vessel.speed || 0
      };
    }
  }

  // ✅ ADD: MISSING METHOD - Get vessel track by MMSI
  public getVesselTrack(mmsi: number): VesselTrack | undefined {
    return this.vesselTracks.get(mmsi);
  }

  // ✅ ADD: Get all vessel tracks
  public getAllVesselTracks(): VesselTrack[] {
    return Array.from(this.vesselTracks.values());
  }

  // ✅ ADD: Get moving vessels
  public getMovingVessels(): VesselTrack[] {
    return Array.from(this.vesselTracks.values()).filter(track => track.isMoving);
  }

  // ✅ CALCULATE DISTANCE using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // ✅ CALCULATE SPEED
  private calculateSpeed(prev: VesselPosition, curr: VesselPosition, distance: number): number {
    const timeDiff = curr.timestamp.getTime() - prev.timestamp.getTime();
    if (timeDiff <= 0) return 0;

    const timeInHours = timeDiff / (1000 * 3600);
    const distanceInKm = distance / 1000;
    const speedKmh = distanceInKm / timeInHours;
    
    // Convert km/h to knots (1 km/h = 0.539957 knots)
    return speedKmh * 0.539957;
  }

  // ✅ CALCULATE AVERAGE SPEED from recent positions
  private calculateAverageSpeed(positions: VesselPosition[]): number {
    if (positions.length < 2) return 0;
    
    const recent = positions.slice(-5); // Last 5 positions
    let totalDistance = 0;
    let totalTime = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const distance = this.calculateDistance(
        recent[i-1].latitude, recent[i-1].longitude,
        recent[i].latitude, recent[i].longitude
      );
      const time = recent[i].timestamp.getTime() - recent[i-1].timestamp.getTime();
      
      totalDistance += distance;
      totalTime += time;
    }
    
    if (totalTime === 0) return 0;
    
    // Convert m/ms to knots (1 m/s = 1.94384 knots)
    const metersPerSecond = totalDistance / (totalTime / 1000);
    return metersPerSecond * 1.94384;
  }

  // ✅ GET VESSEL MOVEMENT by MMSI
  public getVesselMovement(mmsi: number): VesselPosition | undefined {
    return this.vesselPositions.get(mmsi);
  }

  // ✅ GET TRACKING STATISTICS
  public getTrackingStats(): any {
    const positions = Array.from(this.vesselPositions.values());
    const tracks = Array.from(this.vesselTracks.values());
    const movingVessels = tracks.filter(track => track.isMoving);
    
    return {
      trackedVessels: positions.length,
      totalTracks: tracks.length,
      movingVessels: movingVessels.length,
      stationaryVessels: tracks.length - movingVessels.length,
      averageSpeed: movingVessels.reduce((sum, track) => sum + track.averageSpeed, 0) / movingVessels.length || 0,
      totalDistance: tracks.reduce((sum, track) => sum + track.totalDistance, 0),
      minMovementDistance: this.MIN_MOVEMENT_DISTANCE,
      maxTrackPoints: this.MAX_TRACK_POINTS
    };
  }

  // ✅ CLEAR TRACKING DATA
  public clearTrackingData(): void {
    this.vesselPositions.clear();
    this.vesselTracks.clear();
    this.movementSubject.next([]);
    console.log('🧹 Vessel tracking data cleared');
  }

  // ✅ CLEAR SPECIFIC VESSEL TRACK
  public clearVesselTrack(mmsi: number): void {
    this.vesselPositions.delete(mmsi);
    this.vesselTracks.delete(mmsi);
    console.log(`🧹 Cleared track for vessel ${mmsi}`);
  }

  // ✅ UPDATE TRACKING SETTINGS
  public updateMinMovementDistance(distance: number): void {
    // Note: MIN_MOVEMENT_DISTANCE is readonly, but we can create a setter if needed
    console.log(`🔧 Min movement distance setting: ${distance}m`);
  }

  // ✅ GET VESSEL COUNT
  public getTrackedVesselCount(): number {
    return this.vesselPositions.size;
  }

  // ✅ IS VESSEL BEING TRACKED
  public isVesselTracked(mmsi: number): boolean {
    return this.vesselPositions.has(mmsi);
  }
}
