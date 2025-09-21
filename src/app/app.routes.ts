// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  // ✅ Default redirect ke map
  {
    path: '',
    redirectTo: '/map',
    pathMatch: 'full'
  },

  // ✅ Map Component - FULL PAGE
  {
    path: 'map',
    loadComponent: () => import('./map/map').then(m => m.MapComponent),
    title: 'Vessel Tracking - Live Map'
  },

  // ✅ POI Area Component - FULL PAGE REPLACEMENT
  {
    path: 'poi-area',
    loadComponent: () => import('./components/poi-area/poi-area').then(m => m.PoiArea),
    title: 'Download Data by Area'
  },

 

  // ✅ Wildcard route
  {
    path: '**',
    redirectTo: '/map'
  }
];
