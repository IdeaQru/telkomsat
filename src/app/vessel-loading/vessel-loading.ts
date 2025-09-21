import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LoadingState } from '../services/optimized-marker-manager';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-vessel-loading',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './vessel-loading.html',
  styleUrls: ['./vessel-loading.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VesselLoadingComponent implements OnDestroy {
  
  // ✅ ADD: Subject untuk proper cleanup
  private destroy$ = new Subject<void>();
  private timeoutIds: Set<number> = new Set();
  
  @Input() 
  set loadingState(value: LoadingState) {
    this._loadingState = value;
    
    // ✅ FIXED: Gunakan markForCheck() instead of setTimeout + detectChanges
    if (value && value.hasData && !value.isLoading) {
      console.log('🎯 hasData=true detected, marking for check');
      this.cdr.markForCheck(); // ✅ Lebih efisien dari detectChanges()
    }
  }
  
  get loadingState(): LoadingState {
    return this._loadingState;
  }
  
  private _loadingState!: LoadingState;

  @Output() retry = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnDestroy() {
    console.log('🧹 VesselLoadingComponent destroyed');
    
    // ✅ CRITICAL: Clear all timeouts
    this.timeoutIds.forEach(id => {
      clearTimeout(id);
    });
    this.timeoutIds.clear();
    
    // ✅ CRITICAL: Complete subject
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ✅ HELPER: Safe setTimeout with cleanup tracking
  private safeSetTimeout(callback: () => void, delay: number): void {
    const timeoutId = window.setTimeout(() => {
      callback();
      this.timeoutIds.delete(timeoutId);
    }, delay);
    this.timeoutIds.add(timeoutId);
  }

  // ✅ FIXED: Safe helper methods
  floorValue(value: number | undefined): number {
    return value !== undefined && !isNaN(value) ? Math.floor(value) : 0;
  }

  // ✅ FIXED: Regex escape
  extractVesselCount(message: string | undefined): string {
    if (!message) return '0';
    const match = message.match(/\d+/);
    return match ? match[0] : '0';
  }

  // ✅ OPTIMIZED: Progress calculation without forcing change detection
  getProgressWidth(): string {
    if (!this.loadingState) {
      return '0%';
    }

    const stateProgress = this.floorValue(this.loadingState?.progress || 0);
    const finalProgress = this.loadingState.hasData ? 100 : stateProgress;
    
    return `${Math.min(Math.max(finalProgress, 0), 100)}%`;
  }

  // ✅ OPTIMIZED: shouldHideLoading without setTimeout
  get shouldHideLoading(): boolean {
    if (!this.loadingState) {
      console.warn('⚠️ LoadingState is null/undefined');
      return false;
    }

    const hasData = this.loadingState.hasData;
    const notLoading = !this.loadingState.isLoading;
    const progressComplete = (this.loadingState.progress || 0) >= 100;
    const noError = !this.loadingState.error;
    
    const shouldHide = (hasData && notLoading && noError) || 
                      (progressComplete && hasData) ||
                      (hasData && noError);
    
    // ✅ FIXED: Use markForCheck() instead of setTimeout + detectChanges
    if (shouldHide && this.loadingState.hasData) {
      // Use microtask for better performance
      Promise.resolve().then(() => {
        if (!this.destroy$.closed) {
          this.cdr.markForCheck();
        }
      });
    }
    
    return shouldHide;
  }

  // ✅ ADDITIONAL: Helper to get current progress value
  get currentProgress(): number {
    if (!this.loadingState) return 0;
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

  // ✅ OPTIMIZED: Manual trigger yang aman
  forceUpdate(): void {
    if (!this.destroy$.closed) {
      console.log('🔄 Manual UI update triggered');
      this.cdr.markForCheck(); // ✅ Gunakan markForCheck() instead of detectChanges()
    }
  }
}
