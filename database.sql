CREATE DATABASE IF NOT EXISTS fruit_memory_ai;
USE fruit_memory_ai;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    level INT NOT NULL,
    unlocked TINYINT(1) DEFAULT 0,
    completed TINYINT(1) DEFAULT 0,
    best_score INT DEFAULT 0,
    best_moves INT DEFAULT 0,
    best_time INT DEFAULT 0,
    UNIQUE KEY unique_user_level (user_id, level),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    level INT NOT NULL,
    score INT NOT NULL,
    moves INT NOT NULL,
    time_seconds INT NOT NULL,
    accuracy FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);