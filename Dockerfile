# Dockerfile
FROM node:20.19.5-alpine

# buat folder app
WORKDIR /app

# salin package* dulu untuk cache layer
COPY package*.json ./

# install native deps (qrcode, sharp, etc) lalu npm ci
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev giflib-dev libjpeg-turbo-dev \
 && npm ci --only=production \
 && apk del python3 make g++

# salin source code
COPY . .

# buat folder sessions agar volume bisa mount
RUN mkdir -p sessions

# expose port
EXPOSE 5001

# jalankan
CMD ["node","server.js"]