const { getPool } = require('./connection');

class PopupStoreRepository {
  // 크롤링 데이터 저장
  async savePopupStores(popupDataArray) {
    if (popupDataArray.length === 0) {
      console.log('[WARN] 저장할 데이터가 없습니다.');
      return { savedCount: 0, skippedCount: 0, savedIds: [] };
    }
    
    const connection = await getPool().getConnection();
    
    try {
      console.log(`\n[CHECK] 중복 체크 시작... (총 ${popupDataArray.length}개)`);
      
      // 1. DB에서 현재 저장된 모든 팝업의 (name, address) 한번에 조회
      const [existing] = await connection.query(
        'SELECT name, address FROM popup_stores'
      );
      
      console.log(`  - DB에 기존 데이터: ${existing.length}개`);
      
      // 2. Set으로 변환 (메모리에서 빠른 검색)
      const existingSet = new Set(
        existing.map(row => `${row.name}|${row.address}`)
      );
      
      // 3. 새로운 데이터만 필터링
      const newData = popupDataArray.filter(data => 
        !existingSet.has(`${data.name}|${data.address}`)
      );
      
      console.log(`  - 새로 추가할 데이터: ${newData.length}개`);
      console.log(`  - 중복 제외: ${popupDataArray.length - newData.length}개\n`);
      
      // 4. 새 데이터만 배치 저장
      let savedIds = [];
      if (newData.length > 0) {
        savedIds = await this.batchInsertPopupStores(newData);
      } else {
        console.log('[WARN] 모두 중복 데이터입니다. 저장할 항목이 없습니다.');
      }
      
      console.log(`\n[RESULT] 최종 저장 결과:`);
      console.log(`  - 새로 추가: ${newData.length}개`);
      console.log(`  - 이미 존재: ${popupDataArray.length - newData.length}개`);
      
      return { 
        savedCount: newData.length, 
        skippedCount: popupDataArray.length - newData.length,
        savedIds 
      };
    } finally {
      connection.release();
    }
  }

  async batchInsertPopupStores(popupDataArray) {
    if (popupDataArray.length === 0) return [];
    
    const connection = await getPool().getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. 팝업스토어 배치 INSERT
      const popupValues = popupDataArray.map(data => [
        data.name,
        data.address,
        data.mapx,
        data.mapy,
        data.startDate,
        data.endDate,
        data.description,
        data.webSiteLink,
        0, // weekly_view_count
        0  // favorite_count
      ]);
      
      const [result] = await connection.query(
        `INSERT INTO popup_stores 
        (name, address, mapx, mapy, start_date, end_date, description, site_link, weekly_view_count, favorite_count)
        VALUES ?`,
        [popupValues]
      );
      
      const firstInsertId = result.insertId;
      const savedIds = [];
      
      // 2. 이미지 배치 INSERT (모든 팝업의 이미지를 한번에)
      const allImageValues = [];
      
      for (let i = 0; i < popupDataArray.length; i++) {
        const popupId = firstInsertId + i;
        savedIds.push(popupId);
        
        const images = popupDataArray[i].images || [];
        for (const imageUrl of images) {
          allImageValues.push([popupId, imageUrl]);
        }
      }
      
      // 이미지가 있을 때만 INSERT
      if (allImageValues.length > 0) {
        await connection.query(
          'INSERT INTO popup_images (popup_id, image_url) VALUES ?',
          [allImageValues]
        );
      }
      
      await connection.commit();
      console.log(`[OK] 배치 저장 완료: ${popupDataArray.length}개 (이미지: ${allImageValues.length}개)`);
      return savedIds;
      
    } catch (error) {
      await connection.rollback();
      console.error('[ERROR] 배치 저장 실패:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new PopupStoreRepository();
