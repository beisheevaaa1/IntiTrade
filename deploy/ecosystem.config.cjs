const projectDir = process.env.PROJECT_DIR || "/var/www/university-marketplace";

module.exports = {
  apps: [
    {
      name: "university-marketplace-api",
      cwd: `${projectDir}/backend/runtime-current`,
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "512M",
      kill_timeout: 12000,
      listen_timeout: 10000,
      time: true,
      combine_logs: true,
      output: "/var/log/intitrade/api.log",
      error: "/var/log/intitrade/api-error.log",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
