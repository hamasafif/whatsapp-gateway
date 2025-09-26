
module.exports = {
  apps: [{
    name: 'wa-gateway',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
      WEBHOOK_URL: 'https://n8n.webhook.kamu/webhook-test/wa-in'
    }
  }]
};
