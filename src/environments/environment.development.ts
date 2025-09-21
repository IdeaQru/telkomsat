// src/environments/environment.development.ts
function createUrls() {
  const backendPort = 3770; // Single port untuk semua services
  
  const defaultUrls = {
    apiUrl: `https://31.57.178.243:${backendPort}`,
    websocketUrl: `https://31.57.178.243:${backendPort}` // ✅ HTTP, bukan WS untuk Socket.IO
  };

  // Check for browser environment
  if (typeof window !== 'undefined' && 
      typeof document !== 'undefined' && 
      window.location) {
    try {
      const origin = window.location.origin;
      // Development mode: API di 3000, frontend di 4200
      return {
        apiUrl: origin.replace(':4200', ':3000'),
        websocketUrl: origin.replace('http://', 'ws://').replace(':4200', ':8888')
      };
    } catch (error) {
      console.warn('Environment URL creation failed:', error);
    }
  }

  return defaultUrls;
}

const urls = createUrls();

export const environment = {
  production: false,
  apiUrl: urls.apiUrl,
  websocketUrl: urls.websocketUrl,
  appName: 'AIS Vessel Tracker [DEV]',
  debug: {
    websocket: true,   // Enable debug in development
    api: true,
    console: true
  },
  ports: {
    api: 3000,
    websocket: 3000
  }
};
