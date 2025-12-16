
require('dotenv').config();
const { testConnection } = require('./database/connection');
const PopupStoreService = require('./services/popupStoreService');
const Logger = require('./utils/Logger');
const logger = new Logger(process.env.SEARCH_KEYWORD);
const PopupStoreRepository = require('./database/repository');
const popupStoreRepository = new PopupStoreRepository(logger);

/**
 * 메인 실행 파일
 */
async function main() {
  // 환경 변수에서 로드
  const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const SEARCH_KEYWORD = process.env.SEARCH_KEYWORD;

  // 필수 환경 변수 체크

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    logger.error('[ERROR] 환경 변수가 설정되지 않았습니다.');
    logger.error('        .env 파일을 생성하고 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 설정하세요.');
    process.exit(1);
  }

  logger.log('====================================');
  logger.log('  팝업 스토어 데이터 수집 앱');
  logger.log('====================================');

  if (OPENAI_API_KEY) {
    logger.info('[INFO] OpenAI API 키 감지 - 자동 카테고리 분류 활성화');
  } else {
    logger.info('[INFO] OpenAI API 키 없음 - 모든 데이터는 "기타" 카테고리로 저장됩니다');
  }
  logger.log('');

  const popupStoreService = new PopupStoreService(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, OPENAI_API_KEY, logger, popupStoreRepository); // Updated to pass repository
  // repository 인스턴스 교체 (서비스 내부에서 사용하려면 필요)
  require('./database/repository');
  // popupStoreRepository는 필요시 서비스에 주입 가능

  try {
    const result = await popupStoreService.collectAndSave(SEARCH_KEYWORD);

    logger.log('\n[RESULT] 최종 결과:');
    logger.log(`  - 새로 저장: ${result.savedCount}개`);
    logger.log(`  - 중복 제외: ${result.skippedCount}개`);
    logger.log('\n프로세스 종료');
    process.exit(0);
  } catch (error) {
    logger.error('\n[ERROR] 에러 발생:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

(async () => {
  const ok = await testConnection();
  if (!ok) {
    await require('./database/init'); // DB/테이블 생성 완료까지 대기
  }
  await main(); // DB 준비 후 서비스 실행
})();
