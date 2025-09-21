// ecosystem.angular.config.js
const os = require('os');
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'angular-app',
      script: 'node_modules/@angular/cli/bin/ng',
      args: [
        'serve',
        '--ssl',
        `--ssl-key=${path.join(os.homedir(), 'key.pem')}`,
        `--ssl-cert=${path.join(os.homedir(), 'cert.pem')}`,
        '--host=localhost',
        '--port=4200'
      ],
      instances: 1,                    // ✅ Single instance untuk development server
      exec_mode: 'fork',              // ✅ Fork mode (bukan cluster)
      watch: false,                   // ✅ Disable watch (ng serve sudah punya auto-reload)
      
      env: {
        NODE_ENV: 'development',
        NG_CLI_ANALYTICS: 'false'     // Disable Angular analytics
      },
      
      env_production: {
        NODE_ENV: 'production',
        NG_CLI_ANALYTICS: 'false'
      },
      
      // ✅ Performance settings untuk development
      max_memory_restart: '2G',       // Angular dev server butuh memory lebih
      min_uptime: '10s',
      max_restarts: 5,
      
      // ✅ Logging
      log_file: './logs/angular-combined.log',
      out_file: './logs/angular-out.log',
      error_file: './logs/angular-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // ✅ Kill settings
      kill_timeout: 5000,
      wait_ready: false,              // ng serve tidak support ready signal
    }
  ]
};
