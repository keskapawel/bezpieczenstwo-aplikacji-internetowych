/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: 'securedesk-backend',
      script: './backend/dist/server.js',
      cwd: '/opt/securedesk',

      // Załaduj zmienne z backend/.env
      env_production: {
        NODE_ENV: 'production',
      },

      // Logi
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/var/log/pm2/securedesk-error.log',
      out_file: '/var/log/pm2/securedesk-out.log',
      merge_logs: true,

      // Restart policy
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '5s',

      // Graceful reload — czeka aż stary proces obsłuży żądania w locie
      wait_ready: true,
      listen_timeout: 5000,
      kill_timeout: 5000,
    },
  ],
};
