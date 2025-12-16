# 🛍️ PopFitUp Data Crawler

**네이버 지도 기반 팝업스토어 정보 수집 및 AI 자동 분류 시스템**

이 프로젝트는 **Playwright**를 사용하여 네이버 지도에서 팝업스토어 정보를 자동으로 크롤링하고, **네이버 검색 API**와 **OpenAI(GPT-4o-mini)**를 활용하여 데이터를 가공한 뒤 **MySQL** 데이터베이스에 적재하는 자동화 파이프라인입니다.

---

## ✨ 주요 기능 (Key Features)

### 1. 🌐 지능형 웹 크롤링 (Playwright)

네이버 지도의 동적 콘텐츠를 실시간으로 크롤링하여 팝업스토어 정보를 수집합니다.

**수집 데이터:**
* 팝업스토어 이름 (name)
* 주소 (address)
* 운영 기간 (start_date, end_date)
* 설명 및 소개 (description)
* 웹사이트 링크 (site_link)
* 이미지 URL 목록 (images)

**크롤링 프로세스:**
1. **검색어 기반 자동 검색**: `.env` 파일의 `SEARCH_KEYWORD`를 사용하여 네이버 지도 검색
2. **동적 페이지 로딩**: Playwright를 통해 JavaScript 렌더링된 콘텐츠 접근
3. **상세 정보 추출**: 각 팝업스토어 페이지에 접근하여 상세 정보 수집
4. **페이지네이션 자동 처리**: 다음 페이지 버튼을 자동으로 클릭하며 모든 결과 수집
5. **배치 단위 처리**: 최대 70개 아이템씩 묶어서 효율적으로 처리

**안정성 보장:**
* **타임아웃 설정**: 각 아이템당 30초 타임아웃으로 무한 대기 방지
* **에러 복구**: 개별 아이템 크롤링 실패 시에도 다음 아이템으로 진행
* **연속 실패 감지**: 10회 연속 실패 시 크롤링 중단하여 리소스 낭비 방지
* **헤드리스 모드**: GUI 없이 백그라운드에서 실행 가능

### 2. 🗄️ 데이터 중복 방지 및 무결성 (MySQL)

해시(Hash) 기반의 스마트한 데이터 관리 시스템으로 중복을 방지하고 변경 사항을 자동 감지합니다.

**해시 생성 메커니즘:**
* **해시 구성 요소**: 이름(name) + 주소(address) + 시작일(start_date) + 종료일(end_date) + 이미지 URL 목록(images)
* **알고리즘**: SHA-256 해시를 사용하여 64자의 고유 문자열 생성
* **목적**: 팝업스토어의 핵심 정보가 변경되었는지 빠르게 판단

**중복 체크 프로세스:**
1. **기존 데이터 로드**: DB에서 모든 팝업스토어의 `(name, hash)` 조합을 조회
2. **Set 변환**: 빠른 검색을 위해 JavaScript `Set` 자료구조로 변환
3. **신규 데이터 필터링**: 크롤링된 데이터의 `name + hash`가 기존 Set에 없으면 신규로 판단
4. **변경 감지**: 같은 이름이지만 해시가 다르면 정보가 업데이트된 것으로 판단

**처리 결과:**
* **완전 신규**: DB에 INSERT
* **정보 변경**: 기존 데이터를 UPDATE (주소, 기간, 이미지 등이 수정된 경우)
* **중복 데이터**: API 호출 없이 스킵하여 비용 절감

**로그 기록:**
```
[HASH COMPARE] name: 아디다스 팝업스토어 (신규)
[HASH COMPARE] name: 나이키 팝업, old: a3f2, new: b8d4 (업데이트)
```

### 3. 📍 좌표 데이터 보정 (Naver Local Search API)

크롤링된 주소를 기반으로 정확한 GPS 좌표를 추가하여 지도 기반 서비스를 가능하게 합니다.

**좌표 획득 프로세스:**
1. **API 요청**: 크롤링된 주소로 네이버 로컬 검색 API 호출
2. **결과 매칭**: 팝업스토어 이름과 주소가 일치하는 결과 선택
3. **좌표 추출**: API 응답에서 위도(lat), 경도(lon) 값 추출
4. **좌표계 변환**: 네이버 좌표계(KATEC)에서 WGS84(GPS 표준)로 자동 변환

**API 안정성:**
* **Rate Limit 준수**: 각 API 호출 사이에 100ms 딜레이 적용
* **재시도 로직**: 네트워크 오류 시 최대 3회 재시도
* **Fallback**: 좌표를 찾지 못한 경우 `NULL`로 저장하고 계속 진행

**활용:**
* 지도 기반 검색 기능 구현
* 사용자 위치 기반 주변 팝업스토어 추천
* 지역별 팝업스토어 통계 분석

### 4. 🤖 AI 기반 카테고리 자동 분류 (OpenAI GPT-4o-mini)

팝업스토어의 이름과 설명을 분석하여 13개의 사전 정의된 카테고리 중 가장 적합한 카테고리를 자동으로 지정합니다.

**지원 카테고리:**
```
패션(fashion), 뷰티(beauty), 식품/디저트(food), 캐릭터/굿즈(character), 
전시/아트(exhibition), 엔터테인먼트(entertainment), 라이프스타일/리빙(lifestyle), 
테마파크/체험(theme-park), 애니메이션/만화(animation), IT/테크(tech), 
문화/출판(culture), 스포츠/피트니스(sports), 기타(etc)
```

**분류 프로세스:**
1. **배치 구성**: 최대 70개의 팝업스토어 데이터를 하나의 배치로 묶음
2. **프롬프트 생성**: 팝업스토어 이름과 설명을 JSON 형식으로 구성
3. **AI 요청**: GPT-4o-mini 모델에 배치 분류 요청
4. **결과 파싱**: JSON 응답을 파싱하여 각 팝업에 카테고리 매핑
5. **검증**: 유효하지 않은 카테고리는 'etc'로 대체

**배치 처리 장점:**
* **비용 절감**: 70개를 개별 요청하는 대신 1회 요청으로 처리 (비용 1/70)
* **속도 향상**: API 호출 횟수 감소로 전체 처리 시간 단축
* **안정성**: 일부 아이템 분류 실패 시에도 전체 배치는 계속 진행

**Fallback 처리:**
* OpenAI API 키가 없는 경우: 모든 데이터를 'etc' 카테고리로 저장
* API 호출 실패 시: 해당 배치의 모든 아이템을 'etc'로 저장하고 경고 로그 기록
* 카테고리 파싱 실패 시: 'etc'로 대체하고 계속 진행

### 5. 📊 로깅 시스템 (Logger Class)

모든 작업 과정을 파일로 기록하여 디버깅과 모니터링을 지원합니다.

* **파일명**: `logs/YYYYMMDD_HHMMSS_키워드.log` (예: `logs/20251216_143527_팝업스토어.log`)
* **기록 내용**: 크롤링 진행률, 데이터 수집 결과, 중복 체크, API 호출, 에러 정보

---

## 🛠️ 시작 가이드 (Getting Started)

### 사전 요구사항 (Prerequisites)
* **Node.js:** 최신 LTS 버전 권장
* **MySQL:** 서버가 설치되어 있고 실행 중이어야 함
* **API Keys:**
  * Naver Developers API (Client ID, Secret)
  * OpenAI API Key

### 1. 설치 (Installation)

프로젝트를 클론하고 의존성 패키지를 설치합니다.

```bash
# Repository Clone
git clone <repository-url>
cd popup-store-crolling-app

# Install Dependencies
npm install

# Install Playwright Browsers
npx playwright install
```

### 2. 환경 변수 설정 (Environment Setup)

프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 입력하세요.

```env
# Database Configuration
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# Naver API Configuration
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key

# Default Search Keyword
SEARCH_KEYWORD=default_keyword
```

### 3. 데이터베이스 설정 (Database Setup)

MySQL에서 아래 SQL을 실행하여 이벤트 스케줄러와 트리거를 등록합니다.

**A. 주간 조회수 초기화 이벤트 (Event Scheduler)**
```sql
SET GLOBAL event_scheduler = ON;

CREATE EVENT IF NOT EXISTS reset_weekly_view_count
ON SCHEDULE EVERY 1 WEEK
STARTS CURRENT_TIMESTAMP
DO
  UPDATE popup_stores SET weekly_view_count = 0;
```

**B. 즐겨찾기 카운트 동기화 트리거 (Triggers)**
```sql
DELIMITER $$

-- 즐겨찾기 추가 시 카운트 증가
CREATE TRIGGER favorites_after_insert
AFTER INSERT ON favorites
FOR EACH ROW
BEGIN
    UPDATE popup_stores
    SET favorite_count = (SELECT COUNT(*) FROM favorites WHERE popup_id = NEW.popup_id)
    WHERE id = NEW.popup_id;
END$$

-- 즐겨찾기 삭제 시 카운트 감소
CREATE TRIGGER favorites_after_delete
AFTER DELETE ON favorites
FOR EACH ROW
BEGIN
    UPDATE popup_stores
    SET favorite_count = (SELECT COUNT(*) FROM favorites WHERE popup_id = OLD.popup_id)
    WHERE id = OLD.popup_id;
END$$

DELIMITER ;
```

---

###  4. 실행 (Usage)

Node.js로 애플리케이션을 실행합니다.

```bash
node src/index.js
```

실행 후 `logs` 디렉토리에서 날짜와 키워드로 생성된 로그 파일을 통해 진행 상황을 확인할 수 있습니다.

---

## ⚠️ 문제 해결 및 성능 노트 (Troubleshooting)

### 🐢 네트워크 지연으로 인한 데이터 누락
인터넷 속도가 느린 환경(공용 와이파이, 테더링 등)에서는 네이버 지도의 **DOM 콘텐츠 로딩 지연**으로 인해 데이터 수집에 실패할 수 있습니다.

**해결 방법:** `src/crawler.js`에서 타임아웃 설정을 늘려주세요.

```javascript
// src/crawler.js
// 네트워크 환경에 맞춰 타임아웃 증가
await link.click({ timeout: 10000 });
```

### 🖥️ 실행 환경 권장 사항 (Performance Note)
이 프로젝트는 **네이버 지도(Naver Map)**의 무거운 동적 콘텐츠를 크롤링하므로 실행 환경에 따라 성능 차이가 큽니다.

* **권장 환경:** **Windows, macOS 등 GUI 환경** (GPU 가속 지원)
* **비권장 환경:** Linux CLI, 저사양 Docker 컨테이너
  * *주의:* 인터넷 속도가 빠르더라도, CLI 환경에서는 렌더링 속도 저하로 인해 타임아웃이 빈번하게 발생할 수 있습니다. 가급적 로컬 데스크탑 환경에서 실행하는 것을 권장합니다.

---

## 🎥 사용 예시 (Demo)
프로젝트 실행 및 동작 영상은 아래 링크에서 확인할 수 있습니다.

👉 [YouTube Demo Video](https://youtu.be/NGgFef_znqM)