// ecosystem.config.js - FIXED to use npm
const path = require('path');
const os = require('os');

module.exports = {
  apps: [
    {
      name: 'angular-app',
      
      // ✅ SOLUTION: Use npm instead of direct ng command
      script: 'npm',
      args: ['run', 'start'],
      
      // ✅ Alternative method (also works):
      // script: 'npm',
      // args: ['start'],
      
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
