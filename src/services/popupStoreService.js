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
   * @param {boolean} headless - 헤드리스 모드 여부
   * @returns {Promise<Object>} 저장 결과
   */
  async collectAndSave(searchKeyword = '팝업스토어', headless = true) {
    console.log(`\n[START] 데이터 수집 시작: "${searchKeyword}"`);
    
    // 1. 크롤링 실행
    const crawledData = await crawlNaverMapPopups(searchKeyword, headless);
    
    if (crawledData.length === 0) {
      console.log('[WARN] 크롤링된 데이터가 없습니다.');
      return { savedCount: 0, skippedCount: 0, savedIds: [] };
    }

    console.log(`\n[API] 네이버 API로 좌표 정보 수집 중... (${crawledData.length}개)`);
    
    // 2. 네이버 API로 좌표 및 링크 정보 보강
    const enrichedData = await Promise.all(
      crawledData.map(async (data) => {
        const placeInfo = await this.naverApi.getPlaceInfo(data.name);
        
        return {
          name: data.name,
          address: data.address,
          mapx: placeInfo?.mapx || 0,
          mapy: placeInfo?.mapy || 0,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description,
          webSiteLink: placeInfo?.link || '',
          images: data.images
        };
      })
    );

    console.log('[OK] 좌표 정보 수집 완료\n');

    // 3. DB에 저장
    const result = await popupStoreRepository.savePopupStores(enrichedData);
    
    console.log('\n[DONE] 데이터 수집 및 저장 완료!');
    return result;
  }
}

module.exports = PopupStoreService;
