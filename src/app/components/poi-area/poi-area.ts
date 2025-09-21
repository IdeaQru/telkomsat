// src/app/components/poi-area/poi-area.component.ts - COMPLETE FIXED VERSION
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as jsPDF from 'jspdf';

import { 
  POIAreaService, 
  POIAreaBounds, 
  PaginationProgress, 
  POIAreaCountResponse,
  POIAreaDataResponse 
} from '../../services/poi-area.service';

@Component({
  selector: 'app-poi-area',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // ✅ Use OnPush for better performance
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatCardModule,
    MatDividerModule,
    MatToolbarModule,
    MatChipsModule,
    MatSnackBarModule
  ],
  templateUrl: './poi-area.html',
  styleUrls: ['./poi-area.scss']
})
export class PoiArea implements OnInit, OnDestroy {
  coordinateForm: FormGroup;
  
  // ✅ Use private properties with getters to prevent direct binding issues
  private _isDownloading = false;
  private _isAnalyzing = false;
  
  get isDownloading(): boolean {
    return this._isDownloading;
  }
  
  get isAnalyzing(): boolean {
    return this._isAnalyzing;
  }
  
  // Progress tracking
  progressInfo: PaginationProgress = {
    currentPage: 0,
    totalPages: 0,
    totalVessels: 0,
    fetchedVessels: 0,
    progress: 0,
    message: 'Ready',
    isComplete: false,
    stage: 'counting'
  };

  // Area analysis results
  areaAnalysis: POIAreaCountResponse | null = null;
  downloadedData: POIAreaDataResponse | null = null;
  
  private progressSubscription?: Subscription;

  // Data type options
  dataTypeOptions = [
    { value: 'vessel', label: 'Current Vessels', icon: 'directions_boat' },
    { value: 'track', label: 'Historical Tracks', icon: 'timeline' },
    { value: 'ais', label: 'AIS Messages', icon: 'radio' },
    { value: 'all', label: 'All Data Types', icon: 'all_inclusive' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private poiService: POIAreaService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef, // ✅ Inject ChangeDetectorRef
    private ngZone: NgZone // ✅ Inject NgZone for async operations
  ) {
    this.coordinateForm = this.fb.group({
      minLongitude: ['', [
        Validators.required,
        Validators.min(-180),
        Validators.max(180)
      ]],
      maxLongitude: ['', [
        Validators.required,
        Validators.min(-180),
        Validators.max(180)
      ]],
      minLatitude: ['', [
        Validators.required,
        Validators.min(-90),
        Validators.max(90)
      ]],
      maxLatitude: ['', [
        Validators.required,
        Validators.min(-90),
        Validators.max(90)
      ]],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      dataType: ['vessel', Validators.required]
    });
  }

  ngOnInit(): void {
    // Set default date range (last 30 days)
    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    this.coordinateForm.patchValue({
      startDate: monthAgo,
      endDate: today
    });

    // Subscribe to progress updates
    this.progressSubscription = this.poiService.getPaginationProgress().subscribe(
      progress => {
        // ✅ Run inside NgZone to ensure proper change detection
        this.ngZone.run(() => {
          this.progressInfo = { ...progress }; // Create new object reference
          this.cdr.markForCheck();
        });
      }
    );

    // Load example coordinates for Jakarta area
    this.loadExampleCoordinates();
    
    // ✅ Initial change detection
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    if (this.progressSubscription) {
      this.progressSubscription.unsubscribe();
    }
  }

  /**
   * 🔍 Analyze Area - FIXED for ExpressionChanged error
   */
  async analyzeArea(): Promise<void> {
    if (!this.coordinateForm.valid || !this.validateBounds()) {
      this.markFormGroupTouched();
      return;
    }

    // ✅ Use safeStateUpdate to prevent ExpressionChanged error
    this.safeStateUpdate(() => {
      this._isAnalyzing = true;
      this.areaAnalysis = null;
    });

    try {
      const bounds = this.getBoundsFromForm();
      const analysis = await this.poiService.getPOIAreaCount(bounds);
      
      // ✅ Update state safely
      this.safeStateUpdate(() => {
        this.areaAnalysis = analysis;
        this._isAnalyzing = false;
      });
      
      this.showNotification(
        `Analysis complete: Found ${analysis.totalCount.toLocaleString()} vessels in area`,
        'success'
      );

    } catch (error: any) {
      console.error('Area analysis failed:', error);
      
      // ✅ Reset state on error
      this.safeStateUpdate(() => {
        this._isAnalyzing = false;
      });
      
      this.showNotification(
        `Analysis failed: ${error.error?.message || error.message || 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * 📊 Quick Count Preview - FIXED
   */
  async quickCount(): Promise<void> {
    if (!this.coordinateForm.valid || !this.validateBounds()) {
      this.markFormGroupTouched();
      return;
    }

    try {
      const bounds = this.getBoundsFromForm();
      const quickResult = await this.poiService.getQuickCount(bounds);
      
      // ✅ Safe access to nested properties
      const estimatedTime = quickResult?.estimates?.estimatedTime || 
                           quickResult?.estimatedTime || 
                           'calculating...';
      
      this.showNotification(
        `Quick count: ${quickResult.count} current vessels in area (${estimatedTime} estimated processing time)`,
        'success'
      );

    } catch (error: any) {
      console.error('Quick count failed:', error);
      this.showNotification(
        `Quick count failed: ${error.error?.message || error.message || 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * 📥 Download PDF Report - FIXED
   */
  async downloadPDF(): Promise<void> {
    if (!this.coordinateForm.valid || !this.validateBounds()) {
      this.markFormGroupTouched();
      return;
    }

    // Check if we need to analyze first
    if (!this.areaAnalysis) {
      this.showNotification('Please analyze area first to get vessel count', 'warning');
      return;
    }

    // Warn for large datasets
    if (this.areaAnalysis.totalCount > 5000) {
      const proceed = confirm(
        `Warning: ${this.areaAnalysis.totalCount.toLocaleString()} vessels detected. ` +
        `PDF generation may be slow and the file will be large. ` +
        `Consider using CSV format instead. Continue with PDF?`
      );
      if (!proceed) return;
    }

    // ✅ Set downloading state safely
    this.safeStateUpdate(() => {
      this._isDownloading = true;
    });

    try {
      const bounds = this.getBoundsFromForm();
      const data = await this.poiService.downloadAllPOIAreaData(bounds);
      
      // ✅ Update downloaded data safely
      this.safeStateUpdate(() => {
        this.downloadedData = data;
      });

      if (data.vessels.length === 0) {
        this.showNotification('No vessels found in the specified area and time range', 'info');
        return;
      }

      // Generate comprehensive PDF
      await this.generateCompletePDF(data, bounds);

    } catch (error: any) {
      console.error('PDF download failed:', error);
      this.showNotification(
        `PDF download failed: ${error.error?.message || error.message || 'Unknown error'}`,
        'error'
      );
    } finally {
      // ✅ Always reset downloading state
      this.safeStateUpdate(() => {
        this._isDownloading = false;
      });
    }
  }

  /**
   * 📄 Download CSV Report - FIXED
   */
  async downloadCSV(): Promise<void> {
    if (!this.coordinateForm.valid || !this.validateBounds()) {
      this.markFormGroupTouched();
      return;
    }

    // Check if we need to analyze first
    if (!this.areaAnalysis) {
      this.showNotification('Please analyze area first to get vessel count', 'warning');
      return;
    }

    // Warn for very large datasets
    if (this.areaAnalysis.totalCount > 50000) {
      const proceed = confirm(
        `Warning: ${this.areaAnalysis.totalCount.toLocaleString()} vessels detected. ` +
        `This is a very large dataset that may take several minutes to process. ` +
        `Consider using date filters to reduce the dataset size. Continue?`
      );
      if (!proceed) return;
    }

    // ✅ Set downloading state safely
    this.safeStateUpdate(() => {
      this._isDownloading = true;
    });

    try {
      const bounds = this.getBoundsFromForm();
      const data = await this.poiService.downloadAllPOIAreaData(bounds);
      
      // ✅ Update downloaded data safely
      this.safeStateUpdate(() => {
        this.downloadedData = data;
      });

      if (data.vessels.length === 0) {
        this.showNotification('No vessels found in the specified area and time range', 'info');
        return;
      }

      // Generate comprehensive CSV
      await this.generateCompleteCSV(data, bounds);

    } catch (error: any) {
      console.error('CSV download failed:', error);
      this.showNotification(
        `CSV download failed: ${error.error?.message || error.message || 'Unknown error'}`,
        'error'
      );
    } finally {
      // ✅ Always reset downloading state
      this.safeStateUpdate(() => {
        this._isDownloading = false;
      });
    }
  }

  // ====================================================================
  // 🔧 UTILITY METHODS FOR TEMPLATE
  // ====================================================================

  /**
   * ✅ Safe methods for template binding (prevent ExpressionChanged error)
   */
  getRecommendationIcon(approach: string): string {
    switch (approach) {
      case 'single-page': return 'looks_one';
      case 'manual-pagination': return 'view_list';
      case 'auto-fetch': return 'autorenew';
      case 'auto-fetch-with-patience': return 'schedule';
      default: return 'info';
    }
  }

  getStageIcon(stage: string): string {
    switch (stage) {
      case 'counting': return 'analytics';
      case 'processing': return 'autorenew';
      case 'downloading': return 'download';
      case 'complete': return 'check_circle';
      case 'error': return 'error';
      default: return 'info';
    }
  }

  estimateFileSize(count: number, format: 'csv' | 'pdf'): string {
    const bytesPerVessel = format === 'csv' ? 200 : 100;
    const totalBytes = count * bytesPerVessel + (format === 'pdf' ? 50000 : 0);
    
    if (totalBytes < 1024) return `${totalBytes} bytes`;
    if (totalBytes < 1024 * 1024) return `${Math.ceil(totalBytes / 1024)} KB`;
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ✅ Safe getters for template binding
  getIsDownloadDisabled(): boolean {
    return this.isDownloading || this.isAnalyzing || !this.areaAnalysis;
  }

  getIsAnalyzeDisabled(): boolean {
    return this.isDownloading || this.isAnalyzing || !this.coordinateForm.valid;
  }

  getProgressValue(): number {
    return this.progressInfo?.progress || 0;
  }

  getProgressMessage(): string {
    return this.progressInfo?.message || 'Ready';
  }

  // ====================================================================
  // 📋 PDF & CSV GENERATION METHODS
  // ====================================================================

  /**
   * 📋 Generate Complete PDF Report
   */
  private async generateCompletePDF(data: POIAreaDataResponse, bounds: POIAreaBounds): Promise<void> {
    const doc = new jsPDF.jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Vessel Data Export Report', 20, 30);
    
    // Generation info
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 45);
    doc.text(`Total Vessels: ${data.totalFetched?.toLocaleString() || data.vessels.length.toLocaleString()}`, 20, 55);
    
    if (data.performance) {
      doc.text(`Processing Time: ${((data.performance.totalTime || 0) / 1000).toFixed(2)} seconds`, 20, 65);
      doc.text(`Data Quality: ${data.performance.dataQuality?.completeness || '100%'} complete`, 20, 75);
    }

    // Area bounds
    doc.setFontSize(14);
    doc.text('Geographic Bounds:', 20, 95);
    doc.setFontSize(11);
    doc.text(`Longitude: ${bounds.minLongitude}° to ${bounds.maxLongitude}°`, 25, 105);
    doc.text(`Latitude: ${bounds.minLatitude}° to ${bounds.maxLatitude}°`, 25, 115);
    
    if (this.areaAnalysis?.areaAnalysis) {
      doc.text(`Area Size: ${this.areaAnalysis.areaAnalysis.boundingBoxSize.toFixed(2)} km²`, 25, 125);
      doc.text(`Density: ${this.areaAnalysis.areaAnalysis.density} vessels/km²`, 25, 135);
    }

    // Time period
    doc.setFontSize(14);
    doc.text('Time Period:', 20, 155);
    doc.setFontSize(11);
    doc.text(`From: ${bounds.startDate.toLocaleDateString()} ${bounds.startDate.toLocaleTimeString()}`, 25, 165);
    doc.text(`To: ${bounds.endDate.toLocaleDateString()} ${bounds.endDate.toLocaleTimeString()}`, 25, 175);

    // Data type
    doc.setFontSize(14);
    doc.text('Data Configuration:', 20, 195);
    doc.setFontSize(11);
    doc.text(`Data Type: ${bounds.dataType.toUpperCase()}`, 25, 205);
    doc.text(`Export Mode: ${data.mode}`, 25, 215);

    // Sample data table
    if (data.vessels.length > 0) {
      doc.setFontSize(14);
      doc.text('Sample Vessel Data (First 20 records):', 20, 235);
      
      let yPos = 250;
      doc.setFontSize(8);
      
      // Headers
      const headers = ['MMSI', 'Name', 'Lat', 'Lon', 'Speed', 'Course', 'Type'];
      headers.forEach((header, index) => {
        doc.text(header, 20 + (index * 25), yPos);
      });
      
      yPos += 10;
      
      // Data rows (first 20)
      const sampleVessels = data.vessels.slice(0, 20);
      sampleVessels.forEach((vessel, index) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        
        const row = [
          vessel.mmsi?.toString() || 'N/A',
          (vessel.name || 'Unknown').substring(0, 12),
          vessel.latitude?.toFixed(4) || 'N/A',
          vessel.longitude?.toFixed(4) || 'N/A',
          (vessel.speed || 0).toFixed(1),
          (vessel.course || 0).toFixed(0),
          (vessel.vesselType || 'Unknown').substring(0, 10)
        ];
        
        row.forEach((cell, cellIndex) => {
          doc.text(cell, 20 + (cellIndex * 25), yPos);
        });
        
        yPos += 8;
      });
    }

    // Save PDF
    const filename = `vessel-data-${data.totalFetched || data.vessels.length}-vessels-${Date.now()}.pdf`;
    doc.save(filename);
    
    this.showNotification(
      `PDF downloaded: ${filename} (${data.totalFetched || data.vessels.length} vessels)`,
      'success'
    );
  }

  /**
   * 📊 Generate Complete CSV
   */
  private async generateCompleteCSV(data: POIAreaDataResponse, bounds: POIAreaBounds): Promise<void> {
    const headers = [
      'MMSI', 'Vessel Name', 'Latitude', 'Longitude', 'Speed (knots)',
      'Course (°)', 'Heading (°)', 'Vessel Type', 'Navigation Status',
      'Call Sign', 'Destination', 'Length (m)', 'Width (m)', 'Timestamp', 'Source', 'Data Source'
    ];

    const csvRows = [
      // Header row
      headers.join(','),
      // Data rows
      ...data.vessels.map(vessel => {
        const row = [
          vessel.mmsi || '',
          `"${(vessel.name || 'Unknown').replace(/"/g, '""')}"`,
          vessel.latitude?.toFixed(6) || '',
          vessel.longitude?.toFixed(6) || '',
          (vessel.speed || 0).toFixed(1),
          (vessel.course || 0).toFixed(0),
          (vessel.heading || 0).toFixed(0),
          `"${(vessel.vesselType || 'Unknown').replace(/"/g, '""')}"`,
          `"${(vessel.navStatus || 'Unknown').replace(/"/g, '""')}"`,
          `"${(vessel.callSign || '').replace(/"/g, '""')}"`,
          `"${(vessel.destination || '').replace(/"/g, '""')}"`,
          vessel.length || 0,
          vessel.width || 0,
          vessel.timestamp || '',
          vessel.source || 'AIS',
          vessel.dataSource || 'current'
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    const filename = `vessel-data-${data.totalFetched || data.vessels.length}-vessels-${Date.now()}.csv`;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showNotification(
      `CSV downloaded: ${filename} (${data.totalFetched || data.vessels.length} vessels)`,
      'success'
    );
  }

  // ====================================================================
  // 🔧 PRIVATE HELPER METHODS
  // ====================================================================

  /**
   * ✅ Safe state update method to prevent ExpressionChanged errors
   */
  private safeStateUpdate(updateFn: () => void): void {
    // Use setTimeout to ensure state changes happen after current change detection cycle
    setTimeout(() => {
      this.ngZone.run(() => {
        updateFn();
        this.cdr.markForCheck(); // Manually trigger change detection
      });
    }, 0);
  }

  private getBoundsFromForm(): POIAreaBounds {
    const formValue = this.coordinateForm.value;
    return {
      minLongitude: parseFloat(formValue.minLongitude),
      maxLongitude: parseFloat(formValue.maxLongitude),
      minLatitude: parseFloat(formValue.minLatitude),
      maxLatitude: parseFloat(formValue.maxLatitude),
      startDate: new Date(formValue.startDate),
      endDate: new Date(formValue.endDate),
      dataType: formValue.dataType
    };
  }

  private validateBounds(): boolean {
    const bounds = this.getBoundsFromForm();
    
    if (bounds.minLongitude >= bounds.maxLongitude) {
      this.showNotification('Max longitude must be greater than min longitude', 'error');
      return false;
    }
    
    if (bounds.minLatitude >= bounds.maxLatitude) {
      this.showNotification('Max latitude must be greater than min latitude', 'error');
      return false;
    }

    if (bounds.startDate >= bounds.endDate) {
      this.showNotification('End date must be after start date', 'error');
      return false;
    }

    return true;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.coordinateForm.controls).forEach(field => {
      const control = this.coordinateForm.get(field);
      control?.markAsTouched({ onlySelf: true });
    });
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: type === 'error' ? 8000 : 5000,
      panelClass: `snack-${type}`
    });
  }

  private loadExampleCoordinates(): void {
    // Jakarta Bay area coordinates as example
    this.coordinateForm.patchValue({
      minLongitude: 106.7,
      maxLongitude: 106.9,
      minLatitude: -6.2,
      maxLatitude: -6.0
    });
    
    // ✅ Safe change detection after form update
    this.cdr.markForCheck();
  }

  getErrorMessage(fieldName: string): string {
    const control = this.coordinateForm.get(fieldName);
    
    if (control?.hasError('required')) {
      return `${fieldName} is required`;
    }
    
    if (control?.hasError('min') || control?.hasError('max')) {
      if (fieldName.includes('longitude')) {
        return 'Longitude must be between -180 and 180';
      }
      if (fieldName.includes('latitude')) {
        return 'Latitude must be between -90 and 90';
      }
    }
    
    return '';
  }

  resetForm(): void {
    // ✅ Safe form reset
    this.safeStateUpdate(() => {
      this.coordinateForm.reset();
      this.coordinateForm.patchValue({
        dataType: 'vessel'
      });
      
      // Reset dates
      const today = new Date();
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      this.coordinateForm.patchValue({
        startDate: monthAgo,
        endDate: today
      });

      // Reset state
      this.areaAnalysis = null;
      this.downloadedData = null;
      this._isDownloading = false;
      this._isAnalyzing = false;
      
      // Load example coordinates
      this.loadExampleCoordinates();
    });
  }

  goBack(): void {
    this.router.navigate(['/map']);
  }
}
