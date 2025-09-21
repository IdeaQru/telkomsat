// src/app/services/poi-area.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpEventType } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PaginationProgress {
  currentPage: number;
  totalPages: number;
  totalVessels: number;
  fetchedVessels: number;
  progress: number;
  message: string;
  isComplete: boolean;
  stage: 'counting' | 'processing' | 'downloading' | 'complete' | 'error';
}

export interface POIAreaBounds {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
  startDate: Date;
  endDate: Date;
  dataType: 'vessel' | 'ais' | 'track' | 'all';
}

export interface POIAreaCountResponse {
  success: boolean;
  totalCount: number;
  totalPages: number;
  estimatedTime: number;
  dataBreakdown: {
    currentVessels: number;
    archivedVessels: number;
    totalUnique: number;
  };
  recommendations: {
    approach: string;
    estimatedDownloadTime: string;
    memoryUsage: string;
    suggestion: string;
  };
  areaAnalysis: {
    boundingBoxSize: number;
    density: number;
    classification: string;
  };
}

export interface POIAreaDataResponse {
  success: boolean;
  vessels: any[];
  pagination?: {
    page: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  statistics: any;
  exportData: any;
  performance?: any;
  mode: string;
  totalFetched?: number;
  isComplete?: boolean;
  downloadReady?: {
    csv: { ready: boolean; estimatedSize: string; records: number };
    pdf: { ready: boolean; estimatedSize: string; limitation?: string };
  };
}

@Injectable({
  providedIn: 'root'
})
export class POIAreaService {
  private readonly apiUrl = `${environment.apiUrl}/api/ais-data`;
  
  
  private progressSubject = new BehaviorSubject<PaginationProgress>({
    currentPage: 0,
    totalPages: 0,
    totalVessels: 0,
    fetchedVessels: 0,
    progress: 0,
    message: 'Ready',
    isComplete: false,
    stage: 'counting'
  });

  constructor(private http: HttpClient) {}

  getPaginationProgress(): Observable<PaginationProgress> {
    return this.progressSubject.asObservable();
  }

  /**
   * 📊 STEP 1: Get Area Count & Analysis
   */
  async getPOIAreaCount(bounds: POIAreaBounds): Promise<POIAreaCountResponse> {
    this.updateProgress({
      currentPage: 0,
      totalPages: 0,
      totalVessels: 0,
      fetchedVessels: 0,
      progress: 5,
      message: 'Analyzing area and counting vessels...',
      isComplete: false,
      stage: 'counting'
    });

    const params = this.buildHttpParams(bounds);
    
    try {
      const response = await this.http.get<POIAreaCountResponse>(`${this.apiUrl}/poi-area/count`, { params }).toPromise();
      
      this.updateProgress({
        currentPage: 0,
        totalPages: response?.totalPages || 0,
        totalVessels: response?.totalCount || 0,
        fetchedVessels: 0,
        progress: 10,
        message: `Found ${response?.totalCount || 0} vessels in ${response?.totalPages || 0} pages`,
        isComplete: false,
        stage: 'counting'
      });

      return response!;
    } catch (error) {
      this.handleError('Failed to count vessels in area', error);
      throw error;
    }
  }

  /**
   * 🚀 STEP 2: Download All Data with Progress
   */
  async downloadAllPOIAreaData(bounds: POIAreaBounds): Promise<POIAreaDataResponse> {
    try {
      // Step 1: Get count first
      const countResult = await this.getPOIAreaCount(bounds);
      
      if (countResult.totalCount === 0) {
        this.updateProgress({
          currentPage: 0,
          totalPages: 0,
          totalVessels: 0,
          fetchedVessels: 0,
          progress: 100,
          message: 'No vessels found in the specified area',
          isComplete: true,
          stage: 'complete'
        });
        return {
          success: true,
          vessels: [],
          statistics: null,
          exportData: null,
          mode: 'auto-fetch',
          totalFetched: 0,
          isComplete: true
        };
      }

      // Step 2: Check if data is too large for single request
      if (countResult.totalCount > 10000) {
        return this.downloadLargeDataset(bounds, countResult);
      }

      // Step 3: Auto-fetch all data
      this.updateProgress({
        currentPage: 0,
        totalPages: countResult.totalPages,
        totalVessels: countResult.totalCount,
        fetchedVessels: 0,
        progress: 15,
        message: `Starting download of ${countResult.totalCount} vessels...`,
        isComplete: false,
        stage: 'processing'
      });

      const params = this.buildHttpParams(bounds).set('autoFetch', 'true');
      const response = await this.http.get<POIAreaDataResponse>(`${this.apiUrl}/poi-area/all`, { params }).toPromise();

      this.updateProgress({
        currentPage: response?.totalFetched || 0,
        totalPages: countResult.totalPages,
        totalVessels: response?.totalFetched || 0,
        fetchedVessels: response?.totalFetched || 0,
        progress: 100,
        message: `✅ Successfully downloaded ${response?.totalFetched || 0} vessels!`,
        isComplete: true,
        stage: 'complete'
      });

      return response!;

    } catch (error) {
      this.handleError('Failed to download POI area data', error);
      throw error;
    }
  }

  /**
   * 🔄 Download Large Dataset with Manual Pagination
   */
  private async downloadLargeDataset(bounds: POIAreaBounds, countResult: POIAreaCountResponse): Promise<POIAreaDataResponse> {
    this.updateProgress({
      currentPage: 0,
      totalPages: countResult.totalPages,
      totalVessels: countResult.totalCount,
      fetchedVessels: 0,
      progress: 20,
      message: `Large dataset detected (${countResult.totalCount} vessels). Processing in batches...`,
      isComplete: false,
      stage: 'processing'
    });

    const allVessels: any[] = [];
    let currentPage = 1;
    const totalPages = countResult.totalPages;

    // Fetch pages manually with progress tracking
    while (currentPage <= totalPages) {
      try {
        const pageParams = this.buildHttpParams(bounds)
          .set('page', currentPage.toString())
          .set('pageSize', '100');

        const pageResponse = await this.http.get<POIAreaDataResponse>(`${this.apiUrl}/poi-area`, { params: pageParams }).toPromise();

        if (pageResponse?.vessels) {
          allVessels.push(...pageResponse.vessels);
        }

        // Update progress
        const progress = Math.min(Math.round((currentPage / totalPages) * 80) + 20, 95);
        this.updateProgress({
          currentPage,
          totalPages,
          totalVessels: countResult.totalCount,
          fetchedVessels: allVessels.length,
          progress,
          message: `Downloaded ${allVessels.length}/${countResult.totalCount} vessels (Page ${currentPage}/${totalPages})`,
          isComplete: false,
          stage: 'processing'
        });

        currentPage++;

        // Small delay to prevent overwhelming the server
        if (currentPage <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        console.error(`Error fetching page ${currentPage}:`, error);
        currentPage++;
      }
    }

    // Final progress update
    this.updateProgress({
      currentPage: totalPages,
      totalPages,
      totalVessels: allVessels.length,
      fetchedVessels: allVessels.length,
      progress: 100,
      message: `✅ Successfully downloaded ${allVessels.length} vessels from large dataset!`,
      isComplete: true,
      stage: 'complete'
    });

    return {
      success: true,
      vessels: allVessels,
      statistics: null,
      exportData: this.prepareExportData(allVessels, bounds),
      mode: 'large-dataset',
      totalFetched: allVessels.length,
      isComplete: true,
      downloadReady: {
        csv: { ready: true, estimatedSize: this.estimateFileSize(allVessels.length, 'csv'), records: allVessels.length },
        pdf: { 
          ready: allVessels.length <= 5000, 
          estimatedSize: allVessels.length <= 5000 ? this.estimateFileSize(allVessels.length, 'pdf') : 'Too large',
          limitation: allVessels.length > 5000 ? 'Dataset too large for PDF format' : undefined
        }
      }
    };
  }

  /**
   * ⚡ Quick Count for Area Preview
   */
  async getQuickCount(bounds: POIAreaBounds): Promise<any> {
    const params = new HttpParams()
      .set('minLongitude', bounds.minLongitude.toString())
      .set('maxLongitude', bounds.maxLongitude.toString())
      .set('minLatitude', bounds.minLatitude.toString())
      .set('maxLatitude', bounds.maxLatitude.toString());

    return this.http.get<any>(`${this.apiUrl}/poi-area/quick-count`, { params })
      .pipe(
        catchError(error => {
          console.error('Quick count failed:', error);
          return throwError(error);
        })
      ).toPromise();
  }

  /**
   * 🔧 Helper Methods
   */
  private buildHttpParams(bounds: POIAreaBounds): HttpParams {
    return new HttpParams()
      .set('minLongitude', bounds.minLongitude.toString())
      .set('maxLongitude', bounds.maxLongitude.toString())
      .set('minLatitude', bounds.minLatitude.toString())
      .set('maxLatitude', bounds.maxLatitude.toString())
      .set('startDate', bounds.startDate.toISOString())
      .set('endDate', bounds.endDate.toISOString())
      .set('dataType', bounds.dataType);
  }

  private updateProgress(progress: PaginationProgress): void {
    this.progressSubject.next(progress);
  }

  private handleError(message: string, error: any): void {
    console.error(message, error);
    this.updateProgress({
      currentPage: 0,
      totalPages: 0,
      totalVessels: 0,
      fetchedVessels: 0,
      progress: 0,
      message: `Error: ${message}`,
      isComplete: true,
      stage: 'error'
    });
  }

  private prepareExportData(vessels: any[], bounds: POIAreaBounds): any {
    return {
      summary: {
        exportedAt: new Date(),
        totalRecords: vessels.length,
        bounds: bounds,
        dataType: bounds.dataType
      },
      headers: [
        'MMSI', 'Vessel Name', 'Latitude', 'Longitude', 'Speed (knots)',
        'Course (°)', 'Vessel Type', 'Navigation Status', 'Timestamp', 'Source'
      ],
      records: vessels
    };
  }

  private estimateFileSize(count: number, format: 'csv' | 'pdf'): string {
    const bytesPerVessel = format === 'csv' ? 200 : 100;
    const totalBytes = count * bytesPerVessel + (format === 'pdf' ? 50000 : 0);
    
    if (totalBytes < 1024) return `${totalBytes} bytes`;
    if (totalBytes < 1024 * 1024) return `${Math.ceil(totalBytes / 1024)} KB`;
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
