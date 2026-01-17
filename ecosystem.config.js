module.exports = {
  apps: [
    {
      name: 'pielgrzym-bot',
      script: './index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'DD-MM-YYYY HH:mm:ss',
      merge_logs: true,
      time: true,
    },
  ],
}
