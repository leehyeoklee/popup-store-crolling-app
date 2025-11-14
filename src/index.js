require('dotenv').config();
const PopupStoreService = require('./services/popupStoreService');

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
    console.error('[ERROR] 환경 변수가 설정되지 않았습니다.');
    console.error('        .env 파일을 생성하고 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 설정하세요.');
    process.exit(1);
  }

  console.log('====================================');
  console.log('  팝업 스토어 데이터 수집 앱');
  console.log('====================================');
  
  if (OPENAI_API_KEY) {
    console.log('[INFO] OpenAI API 키 감지 - 자동 카테고리 분류 활성화');
  } else {
    console.log('[INFO] OpenAI API 키 없음 - 모든 데이터는 "기타" 카테고리로 저장됩니다');
  }
  console.log('');

  const popupStoreService = new PopupStoreService(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, OPENAI_API_KEY);

  try {
    const result = await popupStoreService.collectAndSave(SEARCH_KEYWORD);
    
    console.log('\n[RESULT] 최종 결과:');
    console.log(`  - 새로 저장: ${result.savedCount}개`);
    console.log(`  - 중복 제외: ${result.skippedCount}개`);
    console.log('\n프로세스 종료');
    process.exit(0);
  } catch (error) {
    console.error('\n[ERROR] 에러 발생:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 직접 실행할 경우
if (require.main === module) {
  main();
}

module.exports = main;
