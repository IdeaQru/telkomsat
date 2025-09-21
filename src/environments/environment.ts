// src/environments/environment.ts (PRODUCTION)

function createProductionUrls() {
  const backendPort = 3770;
  
  // ✅ PRODUCTION: Gunakan window.location.origin + port 3770
  if (typeof window !== 'undefined' && window.location) {
    const currentOrigin = window.location.origin; // Ambil full origin (protocol + hostname + port jika ada)
    const currentHostname = window.location.hostname;
    const currentProtocol = window.location.protocol;
    
    // ✅ PRODUCTION: Buat URL dengan hostname yang sama tapi port 3770
    const productionUrls = {
      apiUrl: `${currentProtocol}//${currentHostname}:${backendPort}`,
      websocketUrl: `${currentProtocol}//${currentHostname}:${backendPort}`
    };
    
    console.log('🚀 Production URLs created:', {
      currentOrigin,
      currentHostname, 
      currentProtocol,
      backendPort,
      constructedUrls: productionUrls
    });
    
    return productionUrls;
  }
  
  // ✅ FALLBACK untuk SSR atau non-browser environment
  const fallbackUrls = {
    apiUrl: `https://127.0.0.1:${backendPort}`,
    websocketUrl: `https://127.0.0.1:${backendPort}`
  };
  
  console.log('📦 Using fallback production URLs:', fallbackUrls);
  return fallbackUrls;
}

// ✅ CREATE PRODUCTION URLS
const urls = createProductionUrls();

export const environment = {
  production: true,
  
  // ✅ API CONFIGURATION - Production uses window.origin:3770
  apiUrl: urls.apiUrl,
  websocketUrl: urls.websocketUrl,
  
  // ✅ APPLICATION INFO
  appName: 'AIS Vessel Tracker',
  version: '2.0.0',
  buildMode: 'production',
  
  // ✅ FEATURE FLAGS
  features: {
    realTimeVessels: true,
    vtsIntegration: true,
    atonIntegration: true,
    performanceMonitoring: true,
    debugMode: false // ❌ Debug disabled in production
  },

  // ✅ DEBUG CONFIGURATION - Minimal in production
  debug: {
    websocket: false,
    api: false,
    console: false,
    performance: false
  },

  // ✅ PORT CONFIGURATION
  ports: {
    api: 3770,        // Backend API port
    websocket: 3770,  // WebSocket port (same as API)
    frontend: 4200    // Angular port (for reference)
  },

  // ✅ WEBSOCKET CONFIGURATION - Production optimized
  websocket: {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 3,     // Fewer attempts in production
    reconnectionDelay: 2000,     // Longer delay in production
    timeout: 30000,              // Longer timeout in production
    forceNew: false,
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true
  },

  // ✅ API CONFIGURATION - Production timeouts
  api: {
    timeout: 45000,              // Longer timeout for production
    retries: 2,                  // Fewer retries
    retryDelay: 2000,
    defaultHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  },

  // ✅ SECURITY CONFIGURATION
  security: {
    corsEnabled: true,
    allowCredentials: true,
    allowedOrigins: ['*'] // In production, this should be more restrictive
  },

  // ✅ PERFORMANCE CONFIGURATION - Production optimized
  performance: {
    enableServiceWorker: true,   // Enabled in production
    enableGzip: true,
    enableCaching: true,
    markerUpdateThrottle: 200,   // Slower updates for stability
    vesselDataDebounce: 300,
    maxMarkersToShow: 500        // Limited for performance
  }
};

// ✅ PRODUCTION UTILITIES
export const productionUtils = {
  getEnvironmentInfo: () => {
    return {
      mode: 'production',
      apiUrl: environment.apiUrl,
      websocketUrl: environment.websocketUrl,
      buildTime: new Date().toISOString(),
      origin: typeof window !== 'undefined' ? window.location.origin : 'SSR'
    };
  },

  getApiEndpoints: () => {
    return {
      vessels: `${environment.apiUrl}/api/vessels`,
      vts: `${environment.apiUrl}/api/vts`,
      aton: `${environment.apiUrl}/api/aton`,
      websocket: `${environment.websocketUrl}/socket.io/`,
      health: `${environment.apiUrl}/health`
    };
  }
};

// ✅ LOG PRODUCTION INFO (minimal)
if (typeof console !== 'undefined' && !environment.production) {
  console.log('🌟 Production Environment:', {
    apiUrl: environment.apiUrl,
    websocketUrl: environment.websocketUrl,
    version: environment.version
  });
}
