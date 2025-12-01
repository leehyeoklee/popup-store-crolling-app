const crawlNaverMapPopups = require('../crawlers/popupCrawler');
const NaverApiClient = require('../utils/naverApi');
const CategoryClassifier = require('../utils/categoryClassifier');
const popupStoreRepository = require('../database/repository');

/**
 * 팝업 스토어 서비스 - 데이터 수집 + API 조회 + DB 저장 통합
 */
class PopupStoreService {
  constructor(naverClientId, naverClientSecret, openaiApiKey) {
    this.naverApi = new NaverApiClient(naverClientId, naverClientSecret);
    this.categoryClassifier = openaiApiKey ? new CategoryClassifier(openaiApiKey) : null;
  }

  /**
   * 팝업 스토어 데이터 수집 및 DB 저장
   * @param {string} searchKeyword - 검색 키워드
   * @returns {Promise<Object>} 저장 결과
   */
  async collectAndSave(searchKeyword = '팝업스토어') {
    console.log(`\n[START] 데이터 수집 시작: "${searchKeyword}"`);
    
    let totalSaved = 0;
    let totalSkipped = 0;

    // 페이지별 데이터 처리 콜백
    const onPageComplete = async (pageData) => {
      console.log(`  [크롤링] 수집된 데이터: ${pageData.length}개`);
      
      // ⭐ 1. 중복 체크 (가장 먼저!)
      const newData = await popupStoreRepository.filterNewData(pageData);
      console.log(`  [중복체크] 새 데이터: ${newData.length}개, 중복 제외: ${pageData.length - newData.length}개`);
      
      if (newData.length === 0) {
        console.log('  [SKIP] 모두 중복 데이터입니다. 다음 페이지로 이동...\n');
        totalSkipped += pageData.length;
        return;
      }
      
      // ⭐ 2. 네이버 API로 좌표 정보 수집 (새 데이터만!)
      console.log(`  [API] 네이버 API로 좌표 정보 수집 중... (${newData.length}개)`);
      const enrichedData = [];
      for (const data of newData) {
        const placeInfo = await this.naverApi.getPlaceInfo(data.name);
        // 네이버 API의 mapx, mapy는 이미 WGS84 좌표계 (경도, 위도)
        // 1,000,000으로 나누면 실제 좌표값이 됨
        let lon = 0, lat = 0;
        if (placeInfo?.mapx && placeInfo?.mapy) {
          lon = Number(placeInfo.mapx) / 10000000;
          lat = Number(placeInfo.mapy) / 10000000;
          // Infinity/NaN 방지
          if (!Number.isFinite(lat)) lat = 0;
          if (!Number.isFinite(lon)) lon = 0;
        }
        console.log(`[COORD] ${data.name}: lat=${lat}, lon=${lon}`);
        enrichedData.push({
          name: data.name,
          address: data.address,
          lat,
          lon,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description,
          webSiteLink: placeInfo?.link || '',
          images: data.images
        });
        // Rate Limit 방지를 위한 딜레이 (100ms)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('  [OK] 좌표 정보 수집 완료');

      // ⭐ 3. AI 카테고리 분류 (새 데이터만!)
      if (this.categoryClassifier) {
        console.log(`  [AI] OpenAI로 카테고리 자동 분류 중... (${enrichedData.length}개)`);
        try {
          const classified = await this.categoryClassifier.classifyBatch(enrichedData);
          
          // 분류 결과를 enrichedData에 병합
          const classifiedMap = new Map(classified.map(c => [c.name, c.categories]));
          enrichedData.forEach(data => {
            data.categories = classifiedMap.get(data.name) || ['etc'];
          });
          
          console.log('  [OK] 카테고리 분류 완료');
        } catch (error) {
          console.warn('  [WARN] 카테고리 분류 실패, 기본값 사용:', error.message);
          enrichedData.forEach(data => {
            data.categories = ['etc'];
          });
        }
      } else {
        console.log('  [SKIP] OpenAI API 키가 없어 카테고리 분류를 건너뜁니다.');
        enrichedData.forEach(data => {
          data.categories = ['etc'];
        });
      }

      // ⭐ 4. DB에 저장 (중복 체크 없이 바로 저장)
      const result = await popupStoreRepository.savePopupStoresWithoutCheck(enrichedData);
      totalSaved += result.savedCount;
      totalSkipped += pageData.length - newData.length;
      
      console.log(`  [OK] 저장 완료: ${result.savedCount}개\n`);
    };
    
    // 크롤링 실행 (페이지별 콜백 전달)
    const { totalCount, pageCount } = await crawlNaverMapPopups(searchKeyword, onPageComplete);
    
    console.log('\n[DONE] 데이터 수집 및 저장 완료!');
    return { savedCount: totalSaved, skippedCount: totalSkipped };
  }
}

module.exports = PopupStoreService;
