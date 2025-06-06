module.exports = {
  apps: [
    {
      name: 'prompt-manager-server',
      script: './server/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};