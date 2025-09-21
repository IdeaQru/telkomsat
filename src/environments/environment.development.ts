// src/environments/environment.development.ts (FIXED - No duplicate exports)

/**
 * ✅ AUTO-DETECT LOCAL IP ADDRESS
 * Fungsi untuk mendapatkan IP address otomatis
 */
function getLocalIPAddress(): string {
  try {
    // ✅ Method 1: Detect dari window.location (untuk browser)
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      
      // Jika bukan localhost atau 127.0.0.1, gunakan hostname yang ada
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        console.log('🌐 Using current hostname:', hostname);
        return hostname;
      }
    }

    // ✅ Method 2: Fallback ke localhost untuk SSR atau default
    return 'localhost';
    
  } catch (error) {
    console.warn('⚠️ IP detection failed, using localhost:', error);
    return 'localhost';
  }
}

/**
 * ✅ AUTO-DETECT BACKEND URL
 * Membuat URL backend berdasarkan environment yang terdeteksi
 */
function createDevelopmentUrls() {
  const backendPort = 3770;
  const detectedHost = getLocalIPAddress();
  
  // ✅ SMART URL GENERATION
  const developmentUrls = {
    apiUrl: `https://${detectedHost}:${backendPort}`,
    websocketUrl: `https://${detectedHost}:${backendPort}`
  };
  
  console.log('🛠️ Development URLs auto-created:', {
    detectedHost,
    urls: developmentUrls,
    method: detectedHost === 'localhost' ? 'fallback' : 'auto-detected'
  });
  
  return developmentUrls;
}

/**
 * ✅ BROWSER IP DETECTION (Advanced)
 * Menggunakan WebRTC untuk detect local IP di browser
 */
async function detectBrowserLocalIP(): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.RTCPeerConnection) {
      resolve(['localhost']);
      return;
    }

    const ips: string[] = [];
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.createDataChannel('');
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => resolve(['localhost']));

    pc.onicecandidate = (event) => {
      if (!event || !event.candidate) {
        pc.close();
        resolve(ips.length > 0 ? ips : ['localhost']);
        return;
      }

      const parts = event.candidate.candidate.split(' ');
      const ip = parts[4];
      
      // Filter valid local IPs
      if (ip && !ips.includes(ip) && 
          !ip.startsWith('127.') && 
          !ip.includes(':') && // Skip IPv6
          ip.match(/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        ips.push(ip);
        console.log('🔍 Local IP detected:', ip);
      }
    };

    // Timeout after 3 seconds
    setTimeout(() => {
      pc.close();
      resolve(ips.length > 0 ? ips : ['localhost']);
    }, 3000);
  });
}

// ✅ CREATE DEVELOPMENT URLS WITH AUTO-DETECTION
const urls = createDevelopmentUrls();

export const environment = {
  production: false,
  
  // ✅ API CONFIGURATION - Auto-detected URLs
  apiUrl: urls.apiUrl,
  websocketUrl: urls.websocketUrl,
  
  // ✅ APPLICATION INFO
  appName: 'AIS Vessel Tracker (Dev)',
  version: '2.0.0-dev',
  buildMode: 'development',
  
  // ✅ FEATURE FLAGS
  features: {
    realTimeVessels: true,
    vtsIntegration: true,
    atonIntegration: true,
    performanceMonitoring: true,
    debugMode: true,
    autoIpDetection: true
  },

  // ✅ DEBUG CONFIGURATION
  debug: {
    websocket: true,
    api: true,
    console: true,
    performance: true,
    ipDetection: true
  },

  // ✅ PORT CONFIGURATION
  ports: {
    api: 3770,
    websocket: 3770,
    frontend: 4200
  },

  // ✅ WEBSOCKET CONFIGURATION
  websocket: {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    timeout: 10000,
    forceNew: false,
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: false
  },

  // ✅ API CONFIGURATION
  api: {
    timeout: 15000,
    retries: 5,
    retryDelay: 500,
    defaultHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  },

  // ✅ SECURITY CONFIGURATION - Dynamic CORS
  security: {
    corsEnabled: true,
    allowCredentials: true,
    allowedOrigins: [
      'https://localhost:4200',
      'https://127.0.0.1:4200',
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'https://localhost:3770',
      'https://127.0.0.1:3770',
    ]
  },

  // ✅ PERFORMANCE CONFIGURATION
  performance: {
    enableServiceWorker: false,
    enableGzip: false,
    enableCaching: false,
    markerUpdateThrottle: 50,
    vesselDataDebounce: 100,
    maxMarkersToShow: 1000
  }
};

// ✅ DEVELOPMENT UTILITIES - Single export, no duplicates
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
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'SSR';
    return {
      mode: 'development',
      apiUrl: environment.apiUrl,
      websocketUrl: environment.websocketUrl,
      buildTime: new Date().toISOString(),
      currentLocation: typeof window !== 'undefined' ? window.location.href : 'SSR',
      detectedHost: getLocalIPAddress(),
      actualHost: currentHost,
      isAutoDetected: currentHost !== 'localhost' && currentHost !== '127.0.0.1'
    };
  },

  getApiEndpoints: () => {
    return {
      vessels: `${environment.apiUrl}/api/vessels`,
      vts: `${environment.apiUrl}/api/vts`,
      aton: `${environment.apiUrl}/api/aton`,
      websocket: `${environment.websocketUrl}/socket.io/`,
      health: `${environment.apiUrl}/api/health`
    };
  },

  testConnection: async (timeout = 5000) => {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${environment.apiUrl}/api/health`, {
        signal: controller.signal,
        headers: environment.api.defaultHeaders
      });
      
      console.log('🔌 Backend connection test:', response.ok ? 'SUCCESS' : 'FAILED');
      return response.ok;
    } catch (error) {
      console.error('❌ Backend connection test failed:', error);
      return false;
    }
  },

  // ✅ Detect dan update CORS origins
  detectAndUpdateOrigins: async () => {
    try {
      const localIPs = await detectBrowserLocalIP();
      const currentHost = getLocalIPAddress();
      
      // Add detected IPs to allowed origins
      localIPs.forEach(ip => {
        const httpsOrigin = `https://${ip}:4200`;
        const httpOrigin = `http://${ip}:4200`;
        
        if (!environment.security.allowedOrigins.includes(httpsOrigin)) {
          environment.security.allowedOrigins.push(httpsOrigin);
        }
        if (!environment.security.allowedOrigins.includes(httpOrigin)) {
          environment.security.allowedOrigins.push(httpOrigin);
        }
      });

      console.log('🔄 Updated CORS origins:', environment.security.allowedOrigins);
      return localIPs;
    } catch (error) {
      console.warn('⚠️ IP detection failed:', error);
      return ['localhost'];
    }
  },

  // ✅ Update URLs dynamically jika terdeteksi IP baru
  updateUrls: (newHost: string) => {
    const newUrls = {
      apiUrl: `https://${newHost}:3770`,
      websocketUrl: `https://${newHost}:3770`
    };

    // Update environment
    environment.apiUrl = newUrls.apiUrl;
    environment.websocketUrl = newUrls.websocketUrl;

    console.log('🔄 URLs updated to:', newUrls);
    return newUrls;
  }
};

// ✅ AUTO-SETUP ON LOAD
if (typeof window !== 'undefined') {
  // Enable WebSocket logging if debug enabled
  if (environment.debug.websocket) {
    developmentUtils.enableSocketIOLogging();
  }

  // Auto-detect and update origins
  if (environment.features.autoIpDetection) {
    developmentUtils.detectAndUpdateOrigins().then(detectedIPs => {
      console.log('🔍 IP Auto-detection completed:', detectedIPs);
      
      // Update URLs if better IP detected
      if (detectedIPs.length > 0 && detectedIPs[0] !== 'localhost') {
        const bestIP = detectedIPs.find(ip => ip.startsWith('192.168.')) || detectedIPs[0];
        if (bestIP !== getLocalIPAddress()) {
          developmentUtils.updateUrls(bestIP);
        }
      }
    });
  }

  // Auto-test connection dengan delay
  setTimeout(() => {
    developmentUtils.testConnection().then(success => {
      const info = developmentUtils.getEnvironmentInfo();
      if (success) {
        console.log(`✅ Backend at ${info.detectedHost}:3770 is reachable`);
        console.log('📍 Connection method:', info.isAutoDetected ? 'Auto-detected' : 'Default localhost');
      } else {
        console.error(`❌ Backend at ${info.detectedHost}:3770 is not reachable`);
        console.error('📍 Connection method:', info.isAutoDetected ? 'Auto-detected' : 'Default localhost');
      }
    });
  }, 5000);
}