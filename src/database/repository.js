const { getPool } = require('./connection');

class PopupStoreRepository {
  // 카테고리 이름으로 ID 조회 (캐싱)
  async getCategoryId(categoryName) {
    if (!this.categoryCache) {
      this.categoryCache = {};
      const connection = await getPool().getConnection();
      try {
        const [rows] = await connection.query('SELECT id, name FROM categories');
        rows.forEach(row => {
          this.categoryCache[row.name] = row.id;
        });
      } finally {
        connection.release();
      }
    }
    return this.categoryCache[categoryName];
  }


  // 크롤링 직후 중복 체크 (새 데이터만 필터링)
  async filterNewData(popupDataArray) {
    if (popupDataArray.length === 0) {
      return [];
    }
    
    const connection = await getPool().getConnection();
    
    try {
      // DB에서 현재 저장된 모든 팝업의 (name, address) 조회
      const [existing] = await connection.query(
        'SELECT name, address FROM popup_stores'
      );
      
      // Set으로 변환 (빠른 검색)
      const existingSet = new Set(
        existing.map(row => `${row.name}|${row.address}`)
      );
      
      // 새로운 데이터만 필터링
      const newData = popupDataArray.filter(data => 
        !existingSet.has(`${data.name}|${data.address}`)
      );
      
      return newData;
    } finally {
      connection.release();
    }
  }

  // 중복 체크 없이 바로 저장 (이미 필터링된 데이터용)
  async savePopupStoresWithoutCheck(popupDataArray) {
    if (popupDataArray.length === 0) {
      return { savedCount: 0, savedIds: [] };
    }
    
    const savedIds = await this.batchInsertPopupStores(popupDataArray);
    return { savedCount: popupDataArray.length, savedIds };
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
      
      await connection.query(
        `INSERT INTO popup_stores 
        (name, address, mapx, mapy, start_date, end_date, description, site_link, weekly_view_count, favorite_count)
        VALUES ?`,
        [popupValues]
      );

      // INSERT 후 name/address로 id SELECT
      const whereClause = popupValues.map(() => '(name = ? AND address = ?)').join(' OR ');
      const whereParams = popupValues.flatMap(v => [v[0], v[1]]);
      const [rows] = await connection.query(
        `SELECT id FROM popup_stores WHERE ${whereClause} ORDER BY id DESC LIMIT ${popupValues.length}`,
        whereParams
      );
      // rows: [{id: ...}, ...]
      const savedIds = rows.map(row => row.id);

      // 2. 이미지 배치 INSERT (모든 팝업의 이미지를 한번에)
      const allImageValues = [];
      // 3. 카테고리 배치 INSERT
      const allCategoryValues = [];

      // 먼저 카테고리 캐시를 초기화
      await this.getCategoryId('fashion'); // 캐시 로딩
      for (let i = 0; i < popupDataArray.length; i++) {
        const popupId = savedIds[i];
        // ...existing code...
        const images = popupDataArray[i].images || [];
        for (const imageUrl of images) {
          allImageValues.push([popupId, imageUrl]);
        }

        // 카테고리 데이터 수집
        const categories = popupDataArray[i].categories || [];
        for (const categoryName of categories) {
          const categoryId = this.categoryCache[categoryName]; // 캐시에서 직접 읽기
          if (categoryId) {
            allCategoryValues.push([popupId, categoryId]);
          }
        }
      }
      
      // 이미지가 있을 때만 INSERT
      if (allImageValues.length > 0) {
        await connection.query(
          'INSERT INTO popup_images (popup_id, image_url) VALUES ?',
          [allImageValues]
        );
      }
      
      // 카테고리가 있을 때만 INSERT
      if (allCategoryValues.length > 0) {
        await connection.query(
          'INSERT IGNORE INTO popup_categories (popup_id, category_id) VALUES ?',
          [allCategoryValues]
        );
      }
      
      await connection.commit();
      console.log(`[OK] 배치 저장 완료: ${popupDataArray.length}개 (이미지: ${allImageValues.length}개, 카테고리: ${allCategoryValues.length}개)`);
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
