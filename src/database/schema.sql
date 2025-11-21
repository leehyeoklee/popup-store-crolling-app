-- 유저 테이블
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(50) NOT NULL UNIQUE,
    profile_image VARCHAR(500),
    name VARCHAR(50),
    nickname VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS popup_stores (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Popup ID (기본키)',
    name VARCHAR(255) NOT NULL COMMENT '이름',
    address VARCHAR(500) COMMENT '주소',
    mapx FLOAT COMMENT '위도 (X)',
    mapy FLOAT COMMENT '경도 (Y)',
    start_date DATE COMMENT '시작일',
    end_date DATE COMMENT '종료일',
    description TEXT COMMENT '설명',
    site_link VARCHAR(500) COMMENT '사이트 링크',
    weekly_view_count INT DEFAULT 0 COMMENT '주간 뷰 수',
    favorite_count INT DEFAULT 0 COMMENT '즐겨찾기 수',
    hash VARCHAR(64) COMMENT '팝업 데이터 해시값',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_name (name),
    INDEX idx_name (name),
    INDEX idx_favorite_count (favorite_count DESC),
    INDEX idx_weekly_view_count (weekly_view_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 이미지 테이블 (별도 테이블로 관리)
CREATE TABLE IF NOT EXISTS popup_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    popup_id INT NOT NULL,
    image_url VARCHAR(1000) NOT NULL,
    FOREIGN KEY (popup_id) REFERENCES popup_stores(id) ON DELETE CASCADE,
    INDEX idx_popup_id (popup_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 카테고리 테이블
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Category ID (기본키)',
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '카테고리명',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 팝업-카테고리 중간 테이블 (M:N 관계)
CREATE TABLE IF NOT EXISTS popup_categories (
    popup_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (popup_id, category_id),
    FOREIGN KEY (popup_id) REFERENCES popup_stores(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_popup_id (popup_id),
    INDEX idx_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 유저-팝업 즐겨찾기 연결 테이블
CREATE TABLE IF NOT EXISTS favorites (
    user_id INT NOT NULL,
    popup_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, popup_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (popup_id) REFERENCES popup_stores(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_popup_id (popup_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 

-- 팝업 제보 테이블
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT '팝업 이름',
    address VARCHAR(500) COMMENT '주소',
    description TEXT COMMENT '제보 내용',
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 리프레시 토큰 저장 테이블
CREATE TABLE IF NOT EXISTS user_refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(512) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 카테고리 데이터 (실제 데이터 분석 기반)
INSERT IGNORE INTO categories (name) VALUES 
('fashion'),
('beauty'),
('food'),
('character'),
('exhibition'),
('entertainment'),
('lifestyle'),
('theme_park'),
('animation'),
('tech'),
('culture'),
('sports'),
('etc');