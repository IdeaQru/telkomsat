import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LoadingState } from '../services/optimized-marker-manager';

@Component({
  selector: 'app-vessel-loading',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './vessel-loading.html',
  styleUrls: ['./vessel-loading.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VesselLoadingComponent implements OnDestroy {
  @Input() 
  set loadingState(value: LoadingState) {
    this._loadingState = value;
    
    // ✅ CRITICAL FIX: Auto-trigger change detection when hasData becomes true
    if (value && value.hasData && !value.isLoading) {
      console.log('🎯 hasData=true detected, forcing UI update');
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 10);
    }
  }
  
  get loadingState(): LoadingState {
    return this._loadingState;
  }
  
  private _loadingState!: LoadingState;

  @Output() retry = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();

  // ✅ ADD: ChangeDetectorRef for OnPush strategy
  constructor(private cdr: ChangeDetectorRef) {}

  ngOnDestroy() {
    console.log('🧹 VesselLoadingComponent destroyed');
  }

  // ✅ FIXED: Safe helper methods
  floorValue(value: number | undefined): number {
    return value !== undefined && !isNaN(value) ? Math.floor(value) : 0;
  }

  // ✅ FIXED: Regex escape
  extractVesselCount(message: string | undefined): string {
    if (!message) return '0';
    const match = message.match(/\d+/); // ✅ Single backslash
    return match ? match[0] : '0';
  }

  // ✅ CRITICAL FIX: Progress calculation with hasData override
  getProgressWidth(): string {
    if (!this.loadingState) {
      return '0%';
    }

    const stateProgress = this.floorValue(this.loadingState?.progress || 0);
    
    // ✅ FORCE 100% when hasData=true, regardless of progress value
    const finalProgress = this.loadingState.hasData ? 100 : stateProgress;
    
    console.log('🎯 Progress UI:', finalProgress, 'from state:', stateProgress, 'hasData:', this.loadingState.hasData);
    
    return `${Math.min(Math.max(finalProgress, 0), 100)}%`;
  }

  // ✅ CRITICAL FIX: Enhanced shouldHideLoading with multiple triggers
  get shouldHideLoading(): boolean {
    if (!this.loadingState) {
      console.warn('⚠️ LoadingState is null/undefined');
      return false;
    }

    // ✅ MULTIPLE CONDITIONS: Hide when hasData=true OR progress>=100 OR not loading with data
    const hasData = this.loadingState.hasData;
    const notLoading = !this.loadingState.isLoading;
    const progressComplete = (this.loadingState.progress || 0) >= 100;
    const noError = !this.loadingState.error;
    
    const shouldHide = (hasData && notLoading && noError) || 
                      (progressComplete && hasData) ||
                      (hasData && noError); // ✅ Simple: if hasData=true and no error, hide
    
    console.log('👁️ Should hide loading:', shouldHide, {
      isLoading: this.loadingState.isLoading,
      hasData: hasData,
      progress: this.loadingState.progress,
      error: this.loadingState.error,
      conditions: {
        hasData,
        notLoading,
        progressComplete,
        noError
      }
    });

    // ✅ FORCE change detection when should hide
    if (shouldHide && this.loadingState.hasData) {
      setTimeout(() => {
        console.log('🔄 Forcing change detection because shouldHide=true');
        this.cdr.detectChanges();
      }, 5);
    }
    
    return shouldHide;
  }

  // ✅ ADDITIONAL: Helper to get current progress value for debugging
  get currentProgress(): number {
    if (!this.loadingState) return 0;
    
    // Return 100 if hasData=true, otherwise return actual progress
    return this.loadingState.hasData ? 100 : (this.loadingState.progress || 0);
  }

  // ✅ ADDITIONAL: Helper to check if loading is complete
  get isLoadingComplete(): boolean {
    return this.loadingState?.hasData === true && this.loadingState?.error === null;
  }

  // ✅ Safe event handlers
  onRetry() {
    if (this.retry) {
      console.log('🔄 Retry button clicked');
      this.retry.emit();
    }
  }

  onRefresh() {
    if (this.refresh) {
      console.log('🔄 Refresh button clicked');
      this.refresh.emit();
    }
  }

  // ✅ Safe time calculation
  getTimeAgo(date: Date | null): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 0) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // ✅ DEBUGGING: Method to manually trigger UI update
  forceUpdate(): void {
    console.log('🔄 Manual UI update triggered');
    this.cdr.detectChanges();
  }
}
