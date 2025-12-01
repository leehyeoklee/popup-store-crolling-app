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
    

    const { getPopupHash } = require('../utils/popupStoreHash');
    const connection = await getPool().getConnection();
    
    try {
      // DB에서 현재 저장된 모든 팝업의 (name, hash) 조회
      const [existing] = await connection.query(
        'SELECT name, hash FROM popup_stores'
      );
      // Set으로 변환 (빠른 검색)
      const existingSet = new Set(
        existing.map(row => `${row.name}|${row.hash}`)
      );

      // 새로운 데이터만 필터링 (name+hash 기준)
      const newData = popupDataArray.filter(data => {
        const hash = getPopupHash(data);
        const exists = existingSet.has(`${data.name}|${hash}`);
        // 해시값 앞 4자리 비교 로그
        if (!exists) {
          console.log(`[HASH COMPARE] name: ${data.name}, hash: ${hash.slice(0,4)} (신규)`);
        } else {
          // 기존 해시값 찾기
          const matched = Array.from(existingSet).find(v => v.startsWith(`${data.name}|`));
          const oldHash = matched ? matched.split('|')[1] : '';
          console.log(`[HASH COMPARE] name: ${data.name}, old: ${oldHash.slice(0,4)}, new: ${hash.slice(0,4)} (중복)`);
        }
        return !exists;
      });

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
      
      // 1. 팝업스토어 배치 INSERT (hash 포함)
      const { getPopupHash } = require('../utils/popupStoreHash');
      const popupValues = popupDataArray.map(data => [
        data.name,
        data.address,
        data.lat,
        data.lon,
        data.startDate,
        data.endDate,
        data.description,
        data.webSiteLink,
        0, // weekly_view_count
        0, // favorite_count
        getPopupHash(data) // hash
      ]);

      await connection.query(
        `INSERT INTO popup_stores 
        (name, address, lat, lon, start_date, end_date, description, site_link, weekly_view_count, favorite_count, hash)
        VALUES ?
        ON DUPLICATE KEY UPDATE 
          address=VALUES(address),
          lat=VALUES(lat),
          lon=VALUES(lon),
          start_date=VALUES(start_date),
          end_date=VALUES(end_date),
          description=VALUES(description),
          site_link=VALUES(site_link),
          weekly_view_count=VALUES(weekly_view_count),
          favorite_count=VALUES(favorite_count),
          hash=VALUES(hash),
          updated_at=NOW()
        `,
        [popupValues]
      );

      // INSERT 후 name만으로 id SELECT
      const savedIds = [];
      for (const v of popupValues) {
        const [rows] = await connection.query(
          'SELECT id FROM popup_stores WHERE name = ? ORDER BY id DESC LIMIT 1',
          [v[0]]
        );
        savedIds.push(rows[0] ? rows[0].id : null);
      }
      // savedIds는 위 for문에서 이미 선언 및 할당됨

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
