module.exports = {
  apps: [
    {
      name: "versiongate-engine",
      script: "src/server.ts",
      interpreter: "bun",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
