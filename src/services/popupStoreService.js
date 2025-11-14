const crawlNaverMapPopups = require('../crawlers/popupCrawler');
const NaverApiClient = require('../utils/naverApi');
const popupStoreRepository = require('../database/repository');

/**
 * 팝업 스토어 서비스 - 데이터 수집 + API 조회 + DB 저장 통합
 */
class PopupStoreService {
  constructor(naverClientId, naverClientSecret) {
    this.naverApi = new NaverApiClient(naverClientId, naverClientSecret);
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
      console.log(`  [API] 네이버 API로 좌표 정보 수집 중... (${pageData.length}개)`);
      
      // 네이버 API로 좌표 및 링크 정보 보강
      const enrichedData = [];
      for (const data of pageData) {
        const placeInfo = await this.naverApi.getPlaceInfo(data.name);
        
        enrichedData.push({
          name: data.name,
          address: data.address,
          mapx: placeInfo?.mapx || 0,
          mapy: placeInfo?.mapy || 0,
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

      // DB에 저장
      const result = await popupStoreRepository.savePopupStores(enrichedData);
      totalSaved += result.savedCount;
      totalSkipped += result.skippedCount;
      
      console.log(`  [OK] 저장 완료: 새로 저장 ${result.savedCount}개, 중복 제외 ${result.skippedCount}개\n`);
    };
    
    // 크롤링 실행 (페이지별 콜백 전달)
    const { totalCount, pageCount } = await crawlNaverMapPopups(searchKeyword, onPageComplete);
    
    console.log('\n[DONE] 데이터 수집 및 저장 완료!');
    return { savedCount: totalSaved, skippedCount: totalSkipped };
  }
}

module.exports = PopupStoreService;
