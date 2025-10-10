module.exports = {
          apps: [
                    {
                              name: "whatsapp-gateway",
                              script: "./server.js",
                              watch: false, // ubah ke true jika ingin reload otomatis saat dev
                              instances: 1,
                              autorestart: true,
                              max_memory_restart: "500M",
                              env: {
                                        NODE_ENV: "development",
                                        PORT: 3000,
                              },
                              env_production: {
                                        NODE_ENV: "production",
                                        PORT: 3000,
                              },
                              error_file: "./logs/error.log",
                              out_file: "./logs/output.log",
                              time: true, // tampilkan timestamp di log
                    },
          ],
};
