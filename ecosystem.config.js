// ecosystem.config.js - FIXED untuk Windows dengan interpreter
const path = require('path');
const os = require('os');

module.exports = {
  apps: [
    {
      name: 'angular-app',
      
      // ✅ SOLUTION: Add interpreter untuk Windows
      script: 'npm',
      args: ['run', 'start'],
      interpreter: 'none',        // ✅ KEY FIX: Jangan gunakan Node.js interpreter
      
      // ✅ Alternative solution: specify full path to cmd.exe
      // interpreter: 'cmd',
      // args: ['/c', 'npm', 'run', 'start'],
      
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      
      env: {
        NODE_ENV: 'development',
        NG_CLI_ANALYTICS: 'false'
      },
      
      env_production: {
        NODE_ENV: 'production', 
        NG_CLI_ANALYTICS: 'false'
      },
      
      max_memory_restart: '2G',
      min_uptime: '10s',
      max_restarts: 5,
      
      log_file: './logs/angular-combined.log',
      out_file: './logs/angular-out.log',
      error_file: './logs/angular-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      kill_timeout: 5000,
      wait_ready: false,
    }
  ]
};
