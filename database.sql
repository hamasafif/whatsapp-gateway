CREATE DATABASE IF NOT EXISTS wagateway
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wagateway;

-- 1. login users
CREATE TABLE users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50) UNIQUE NOT NULL,
  password   VARCHAR(255)     NOT NULL,   -- bcrypt hash
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. paired WhatsApp devices
CREATE TABLE devices (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  number     VARCHAR(30) UNIQUE NOT NULL,   -- 62812xxx
  pushname   VARCHAR(100),
  status     ENUM('CONNECTED','DISCONNECTED') DEFAULT 'DISCONNECTED',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. runtime JWT secret (so we can rotate without code change)
CREATE TABLE settings (
  k VARCHAR(50)  PRIMARY KEY,
  v TEXT
);
INSERT INTO settings(k,v) VALUES('jwt_secret', UUID());   -- random on first run