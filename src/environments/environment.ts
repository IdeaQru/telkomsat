// src/environments/environment.ts
function createUrls() {
  // 🔥 PERBAIKAN: Gunakan port yang SAMA untuk semua services
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
      const currentHost = window.location.hostname;
      const protocol = window.location.protocol;
      
      // 🔥 PERBAIKAN: Sama port untuk API dan WebSocket
      return {
        apiUrl: `${protocol}//${currentHost}`,
        websocketUrl: `${protocol}//${currentHost}` // ✅ Same port, HTTP protocol
      };
    } catch (error) {
      console.warn('Environment URL creation failed:', error);
    }
  }

  return defaultUrls;
}

const urls = createUrls();

export const environment = {
  production: true,
  apiUrl: urls.apiUrl,
  websocketUrl: urls.websocketUrl,
  appName: 'AIS Vessel Tracker',
  debug: {
    websocket: false,
    api: false,
    console: false
  },
  ports: {
    api: 3770,        // ✅ Same port
    websocket: 3770   // ✅ Same port
  }
};
