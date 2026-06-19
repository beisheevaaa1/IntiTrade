module.exports = {
  apps: [
    {
      name: "university-marketplace-api",
      cwd: "./apps/api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
