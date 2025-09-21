import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatNativeDateModule } from '@angular/material/core';

export interface PlayVessel {
  mmsi: string;
  name?: string;
  type?: string;
}

export interface PlaybackState {
  isActive: boolean;
  progress: number;
  currentTime: Date;
  duration: number;
  speed: number;
}

@Component({
  selector: 'app-playback-tracking',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatInputModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatNativeDateModule
  ],
  templateUrl: './playback-tracking.html',
  styleUrls: ['./playback-tracking.scss']
})
export class PlaybackTrackingComponent {
  @Input() availableVessels: PlayVessel[] = [];
  @Input() playbackState: PlaybackState = {
    isActive: false,
    progress: 0,
    currentTime: new Date(),
    duration: 0,
    speed: 1
  };

  @Output() startPlayback = new EventEmitter<{
    startDate: Date;
    endDate: Date;
    vessels: string[];
  }>();
  @Output() pausePlayback = new EventEmitter<void>();
  @Output() stopPlayback = new EventEmitter<void>();
  @Output() speedChange = new EventEmitter<number>();
  @Output() dateRangeChange = new EventEmitter<{
    startDate: Date;
    endDate: Date;
  }>();
  @Output() vesselSelectionChange = new EventEmitter<string[]>();
  @Output() playbackOptionChange = new EventEmitter<{
    option: string;
    enabled: boolean;
  }>();

  // Form Data
  playbackStartDate: Date = new Date();
  playbackEndDate: Date = new Date();
  selectedVesselsForPlayback: string[] = [];
  playbackSpeed = 1;
  
  // Options
  showPlaybackTracks = true;
  showPlaybackSpeed = false;
  showPlaybackEvents = false;

  speedOptions = [
    { value: 0.5, label: '0.5x' },
    { value: 1, label: '1x (Normal)' },
    { value: 2, label: '2x' },
    { value: 5, label: '5x' },
    { value: 10, label: '10x' }
  ];

  canStartPlayback(): boolean {
    return this.selectedVesselsForPlayback.length > 0 && 
           this.playbackStartDate && 
           this.playbackEndDate &&
           !this.playbackState.isActive;
  }

  onStartPlayback() {
    this.startPlayback.emit({
      startDate: this.playbackStartDate,
      endDate: this.playbackEndDate,
      vessels: this.selectedVesselsForPlayback
    });
  }

  onPausePlayback() {
    this.pausePlayback.emit();
  }

  onStopPlayback() {
    this.stopPlayback.emit();
  }

  onSpeedChange() {
    this.speedChange.emit(this.playbackSpeed);
  }

  onDateChange() {
    this.dateRangeChange.emit({
      startDate: this.playbackStartDate,
      endDate: this.playbackEndDate
    });
  }

  onVesselSelectionChange() {
    this.vesselSelectionChange.emit(this.selectedVesselsForPlayback);
  }

  onPlaybackOptionChange(option: string, enabled: boolean) {
    this.playbackOptionChange.emit({ option, enabled });
  }
}
