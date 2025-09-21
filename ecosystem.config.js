// ecosystem.config.js - FIXED untuk external access
module.exports = {
  apps: [
    {
      name: 'myapp',
      script: './dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      
      env: {
        NODE_ENV: 'development',
        USE_HTTPS: 'true',
        HOST: '0.0.0.0',        // ✅ KEY FIX untuk development
        PORT: 3770
      },
      
      env_production: {
        NODE_ENV: 'production',
        USE_HTTPS: 'true',
        HOST: '0.0.0.0',        // ✅ KEY FIX untuk production
        PORT: 3770
      }
    }
  ]
};
