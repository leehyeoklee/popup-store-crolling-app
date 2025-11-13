const axios = require('axios');

/**
 * 네이버 로컬 검색 API 클라이언트
 */
class NaverApiClient {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * 네이버 지역 검색 API 호출
   * @param {string} query - 검색어
   * @returns {Promise<Object>} API 응답 데이터
   */
  async searchLocal(query) {
    try {
      const response = await axios.get('https://openapi.naver.com/v1/search/local.json', {
        params: { query },
        headers: {
          'X-Naver-Client-Id': this.clientId,
          'X-Naver-Client-Secret': this.clientSecret
        }
      });

      return response.data;
    } catch (error) {
      console.error('[ERROR] 네이버 API 호출 실패:', error.message);
      if (error.response) {
        console.error('        상태 코드:', error.response.status);
        console.error('        에러 내용:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * 장소 정보 조회 (좌표 포함)
   * @param {string} placeName - 장소명
   * @returns {Promise<Object|null>} { link, mapx, mapy } 또는 null
   */
  async getPlaceInfo(placeName) {
    try {
      const result = await this.searchLocal(placeName);
      if (result.items && result.items.length > 0) {
        const firstItem = result.items[0];
        return {
          link: firstItem.link,
          mapx: firstItem.mapx,
          mapy: firstItem.mapy
        };
      }
      return null;
    } catch (error) {
      console.error(`   검색 실패 (${placeName}):`, error.message);
      return null;
    }
  }
}

module.exports = NaverApiClient;
