// src/environments/environment.development.ts (DEVELOPMENT)

function createDevelopmentUrls() {
  const backendPort = 3770;
  
  // ✅ DEVELOPMENT: Selalu gunakan localhost:3770
  const developmentUrls = {
    apiUrl: `https://localhost:${backendPort}`,
    websocketUrl: `https://localhost:${backendPort}`
  };
  
  console.log('🛠️ Development URLs created:', developmentUrls);
  return developmentUrls;
}

// ✅ CREATE DEVELOPMENT URLS
const urls = createDevelopmentUrls();

export const environment = {
  production: false,
  
  // ✅ API CONFIGURATION - Development always uses localhost:3770
  apiUrl: urls.apiUrl,
  websocketUrl: urls.websocketUrl,
  
  // ✅ APPLICATION INFO
  appName: 'AIS Vessel Tracker (Dev)',
  version: '2.0.0-dev',
  buildMode: 'development',
  
  // ✅ FEATURE FLAGS - More permissive in development
  features: {
    realTimeVessels: true,
    vtsIntegration: true,
    atonIntegration: true,
    performanceMonitoring: true,
    debugMode: true // ✅ Debug enabled in development
  },

  // ✅ DEBUG CONFIGURATION - All enabled in development
  debug: {
    websocket: true,
    api: true,
    console: true,
    performance: true
  },

  // ✅ PORT CONFIGURATION
  ports: {
    api: 3770,        // Backend API port
    websocket: 3770,  // WebSocket port (same as API)  
    frontend: 4200    // Angular dev server port
  },

  // ✅ WEBSOCKET CONFIGURATION - Development optimized
  websocket: {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,    // More attempts in dev
    reconnectionDelay: 500,      // Faster reconnection in dev
    timeout: 10000,              // Shorter timeout in dev
    forceNew: false,
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: false
  },

  // ✅ API CONFIGURATION - Development timeouts
  api: {
    timeout: 15000,              // Shorter timeout for faster feedback
    retries: 5,                  // More retries for debugging
    retryDelay: 500,
    defaultHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  },

  // ✅ SECURITY CONFIGURATION - More permissive in development
  security: {
    corsEnabled: true,
    allowCredentials: true,
    allowedOrigins: [
      'https://localhost:4200',
      'https://127.0.0.1:4200',
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'https://localhost:3770',
      'https://127.0.0.1:3770'
    ]
  },

  // ✅ PERFORMANCE CONFIGURATION - Development optimized
  performance: {
    enableServiceWorker: false,  // Disabled for easier debugging
    enableGzip: false,
    enableCaching: false,        // Disabled for fresh data
    markerUpdateThrottle: 50,    // Faster updates for development
    vesselDataDebounce: 100,
    maxMarkersToShow: 1000       // More markers for testing
  }
};

// ✅ DEVELOPMENT UTILITIES
export const developmentUtils = {
  enableSocketIOLogging: () => {
    if (typeof window !== 'undefined') {
      (window as any).localStorage.debug = 'socket.io-client:socket';
    }
  },

  disableSocketIOLogging: () => {
    if (typeof window !== 'undefined') {
      delete (window as any).localStorage.debug;
    }
  },

  getEnvironmentInfo: () => {
    return {
      mode: 'development',
      apiUrl: environment.apiUrl,
      websocketUrl: environment.websocketUrl,
      buildTime: new Date().toISOString(),
      currentLocation: typeof window !== 'undefined' ? window.location.href : 'SSR',
      targetBackend: 'localhost:3770'
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
  },

  testConnection: async () => {
    try {
      const response = await fetch(`${environment.apiUrl}/health`);
      console.log('🔌 Backend connection test:', response.ok ? 'SUCCESS' : 'FAILED');
      return response.ok;
    } catch (error) {
      console.error('❌ Backend connection test failed:', error);
      return false;
    }
  }
};

// ✅ AUTO-ENABLE SOCKET.IO LOGGING IN DEVELOPMENT
if (environment.debug.websocket) {
  developmentUtils.enableSocketIOLogging();
}

// ✅ LOG DEVELOPMENT INFO (verbose)
console.log('🛠️ Development Environment Loaded:', {
  ...developmentUtils.getEnvironmentInfo(),
  endpoints: developmentUtils.getApiEndpoints(),
  debugMode: environment.features.debugMode,
  debugFlags: environment.debug
});

// ✅ AUTO-TEST CONNECTION IN DEVELOPMENT
setTimeout(() => {
  developmentUtils.testConnection().then(success => {
    if (success) {
      console.log('✅ Backend at localhost:3770 is reachable');
    } else {
      console.warn('⚠️ Backend at localhost:3770 is not reachable. Make sure backend server is running.');
    }
  });
}, 2000);
