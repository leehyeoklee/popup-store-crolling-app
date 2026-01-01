# 🛍️ PopFitUp Data Crawler

<div align="center">

**네이버 지도 기반 팝업스토어 정보 수집 및 AI 자동 분류 시스템**

</div>

### 👥 팀원 (Contributors)

| 학번 | 이름 | 역할 |
| :---: | :---: | :--- |
| **21101217** | **이혁** (팀장) | Backend |
| **21101224** | **정경재** | Frontend |

### 🚀 서비스 배포 현황 (Deployment Status)

| 서비스명 | URL | 상태 |
| :--- | :--- | :--- |
| **PopFitUp Web** | **[https://popfitup.store](https://popfitup.store)** | ![Status](https://img.shields.io/badge/Status-Offline-critical) |

---

## 📌 목차 (Table of Contents)

1. 프로젝트 개요
2. 전체 아키텍처
3. 주요 기능
4. 기술 스택
5. 시작 가이드
6. 데이터베이스 설정 (SQL 포함)
7. 실행 방법
8. 실행 환경 가이드 (GUI 권장 이유)
9. 문제 해결
10. 데모

---

## 1️⃣ 프로젝트 개요

**PopFitUp Data Crawler**는 네이버 지도에 등록된 팝업스토어 정보를 자동으로 수집하고,
AI 기반 카테고리 분류 및 좌표 보정을 거쳐 **정제된 데이터 형태로 MySQL에 저장하는 자동화 파이프라인**입니다.

단순 크롤링을 넘어서 다음 문제를 해결하는 데 목적이 있습니다.

* 네이버 지도 데이터의 **동적 로딩 구조(SPA)**
* 중복 데이터 누적 문제
* 정보 변경 여부 추적의 어려움
* 좌표 누락 및 부정확성
* 수작업 분류로 인한 확장성 한계

---

## 2️⃣ 전체 아키텍처 (Architecture Overview)

```
[ Playwright (Naver Map) ]
          ↓
[ Raw Popup Store Data ]
          ↓
[ Hash 기반 중복·변경 감지 ]
          ↓
[ Naver Local API (좌표 보정) ]
          ↓
[ OpenAI API (카테고리 분류) ]
          ↓
[ MySQL 저장 ]
```

---

## 3️⃣ 주요 기능 (Key Features)

### 🌐 3.1 지능형 웹 크롤링 (Playwright)

네이버 지도는 SPA(Single Page Application) 구조로 되어 있어
정적 HTML 크롤링 방식으로는 데이터 수집이 어렵습니다.

본 프로젝트는 **Playwright 기반 실제 브라우저 렌더링 방식**을 사용합니다.

**수집 항목**

* 팝업스토어명
* 주소
* 운영 기간
* 상세 설명
* 이미지 URL

**특징**

* 페이지네이션 자동 이동
* 아이템 단위 타임아웃 (기본 30초)
* 연속 실패 시 자동 스킵 처리
* 최대 70개 단위 배치 수집


### 🗄️ 3.2 데이터 중복 방지 및 무결성 관리 (MySQL)

크롤링 특성상 동일한 데이터가 반복 수집될 가능성이 높기 때문에
**Hash 기반 변경 감지 전략**을 적용했습니다.

**동작 방식**

* 주요 필드(name, address, period, description 등) 기반 Hash 생성
* 기존 데이터와 Hash 비교

| 상황     | 처리 방식  |
| ------ | ------ |
| 신규 데이터 | INSERT |
| 동일 데이터 | 저장 스킵  |
| 변경 감지  | UPDATE |

이를 통해 **불필요한 API 호출과 DB 쓰기 작업을 최소화**합니다.


### 📍 3.3 좌표 데이터 보정 (Naver Local API)

네이버 지도에서 추출한 주소 정보는
좌표가 없거나 부정확한 경우가 많습니다.

**처리 흐름**

1. 주소 → Naver Local Search API 검색
2. 좌표 정보 획득
3. WGS84(GPS 표준) 좌표계로 변환 후 저장

**안정성 고려**

* API Rate Limit 대응을 위해 요청 간 100ms 딜레이 적용


### 🤖 3.4 AI 기반 카테고리 자동 분류 (OpenAI)

팝업스토어의 이름과 설명은 형식이 제각각이기 때문에
단순 키워드 분류로는 한계가 있습니다.

**OpenAI(GPT-4o-mini)** 를 활용하여 문맥 기반 분류를 수행합니다.

#### 분류 카테고리 체계 (총 13개)

사용되는 카테고리는 아래 13개로 고정되어 있으며,
 **최대 3개** 까지의 가장 적합한 카테고리만 선택합니다.

| 한글 카테고리   | 저장 값            |
| --------- | --------------- |
| 패션        | `fashion`       |
| 뷰티        | `beauty`        |
| 식품/디저트    | `food`          |
| 캐릭터/굿즈    | `character`     |
| 전시/아트     | `exhibition`    |
| 엔터테인먼트    | `entertainment` |
| 라이프스타일/리빙 | `lifestyle`     |
| 테마파크/체험   | `theme_park`    |
| 매니메이션/만화  | `animation`     |
| IT/테크     | `tech`          |
| 문화/출판     | `culture`       |
| 스포츠/피트니스  | `sports`        |
| 기타        | `etc`           |

**특징**

* 13개 사전 정의 카테고리 중 자동 선택
* 다건 데이터를 묶는 Batch 요청으로 비용 절감
* API 장애 시 `etc` 카테고리로 안전 저장

### 🗄️ 3.5 데이터베이스 저장
분류된 결과는 정규화된 DB 구조에 따라 저장됩니다.

#### ERD
<img width="840" height="948" alt="Image" src="https://github.com/user-attachments/assets/bcb34e9f-c9f3-41fb-9b1d-d6bf828267dd" />

* **저장 로직**:
  1. AI가 반환한 카테고리 이름(`name`)으로 `categories` 테이블 조회 (`id` 획득)
  2. `popup_stores`의 `id`와 카테고리 `id`를 매핑하여 `popup_categories` 테이블에 `INSERT`

### 📊 3.6 상세 로깅 시스템

모든 실행 과정은 파일 단위로 기록됩니다.

**로그 내용**

* 크롤링 진행률
* 성공 / 실패 여부
* Hash 비교 결과
* API 호출 결과
* 에러 스택 트레이스

**로그 파일 형식**

```
logs/YYYYMMDD_HHMMSS_키워드.log
```

---

## 4️⃣ 기술 스택 (Tech Stack)

| 영역       | 기술                     |
| -------- | ---------------------- |
| Runtime  | Node.js                |
| Crawling | Playwright             |
| Database | MySQL                  |
| AI       | OpenAI (GPT-4o-mini)   |
| Map API  | Naver Local Search API |

---

## 5️⃣ 시작 가이드 (Getting Started)

### 5.1 사전 요구사항

* Node.js (LTS 권장)
* MySQL 서버
* Naver Developers API Key
* OpenAI API Key


### 5.2 설치 방법

```bash
git clone <repository-url>
cd popup-store-crolling-app

npm install
npx playwright install
```


### 5.3 환경 변수 설정

`.env` 파일 생성 후 아래 내용 입력

```ini
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=

NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=

OPENAI_API_KEY=
SEARCH_KEYWORD=
```

---

## 6️⃣ 데이터베이스 설정 (MySQL)

### 6.1 이벤트 및 트리거 설정

아래 SQL은 **조회수 초기화**와 **즐겨찾기 수 자동 관리**를 위한 설정입니다.

```sql
-- 1. 이벤트 스케줄러 켜기
SET GLOBAL event_scheduler = ON;

DELIMITER $$

-- 2. 주간 조회수 초기화 이벤트
DROP EVENT IF EXISTS reset_weekly_view_count$$

CREATE EVENT reset_weekly_view_count
ON SCHEDULE EVERY 1 WEEK
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    UPDATE popup_stores SET weekly_view_count = 0;
END$$

-- 3. 즐겨찾기 추가 시 카운트 증가 트리거
DROP TRIGGER IF EXISTS favorites_after_insert$$

CREATE TRIGGER favorites_after_insert
AFTER INSERT ON favorites
FOR EACH ROW
BEGIN
    UPDATE popup_stores
    SET favorite_count = (
        SELECT COUNT(*) FROM favorites WHERE popup_id = NEW.popup_id
    )
    WHERE id = NEW.popup_id;
END$$

-- 4. 즐겨찾기 삭제 시 카운트 감소 트리거
DROP TRIGGER IF EXISTS favorites_after_delete$$

CREATE TRIGGER favorites_after_delete
AFTER DELETE ON favorites
FOR EACH ROW
BEGIN
    UPDATE popup_stores
    SET favorite_count = (
        SELECT COUNT(*) FROM favorites WHERE popup_id = OLD.popup_id
    )
    WHERE id = OLD.popup_id;
END$$

DELIMITER ;
```

---

## 7️⃣ 실행 방법 (Usage)
PM2를 사용해, 터미널을 종료해도 서버가 계속 실행됩니다.

### PM2 설치
```bash
sudo npm install pm2 -g
```

### 서버 백그라운드 실행
```bash
pm2 start ./src/server.js --name "popup-backend"
```

### 서버 완전 종료
```bash
pm2 delete popup-backend
```

실행 결과는 `logs` 디렉토리에서 확인할 수 있습니다.

---

## 8️⃣ 실행 환경 가이드

**실제 브라우저 렌더링 기반 크롤링**을 수행하므로
실행 환경의 성능과 그래픽 처리 능력이 안정성에 큰 영향을 줍니다.

### ✅ GUI 환경 권장 이유

* Playwright는 Chromium을 실제로 실행하여 DOM을 렌더링
* GPU 가속이 활성화된 환경에서 렌더링 속도와 안정성이 크게 향상
* 애니메이션, Lazy Loading, Intersection Observer 등
  브라우저 의존 기능들이 정상 동작

### ❌ CLI / 저사양 환경의 문제점

* Headless 환경에서 렌더링 지연 발생 가능
* DOM 로딩 타이밍 불안정 → 타임아웃 빈번 발생
* Docker / Linux CLI 환경에서는 GPU 미지원으로 속도 저하

> 따라서 **Windows / macOS GUI 환경 실행을 권장**합니다.

---

## 9️⃣ 문제 해결 (Troubleshooting)

### ⏱️ DOM 로딩 지연

```javascript
await link.click({ timeout: 10000 });
```

네트워크가 느린 환경에서는 타임아웃 값 조절 가능 

---
## 🔟 데모 시연 영상 (Demo Video)

아래 이미지를 클릭하면 유튜브 영상으로 이동합니다.

[![PopFitUp Demo](https://img.youtube.com/vi/cRrZcI5YlVA/0.jpg)](https://youtu.be/cRrZcI5YlVA)
