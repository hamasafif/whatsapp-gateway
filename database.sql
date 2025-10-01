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

-- 2. paired WhatsApp devices (sudah pakai accesstoken)
CREATE TABLE `devices` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `number` VARCHAR(50) NOT NULL,
  `pushname` VARCHAR(255) NULL,
  `status` VARCHAR(100) NULL,
  `accesstoken` TEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. runtime JWT secret (so we can rotate without code change)
CREATE TABLE settings (
  k VARCHAR(50)  PRIMARY KEY,
  v TEXT
);

-- Inisialisasi JWT secret pertama kali
INSERT INTO settings(k,v) VALUES('jwt_secret', UUID());

-- 4. API Keys (untuk akses dengan x-api-key)
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generate API key pertama kali dengan UUID
INSERT INTO api_keys(`key`) VALUES (UUID());
