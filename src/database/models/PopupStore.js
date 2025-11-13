class PopupStore {
  constructor({
    id = null,
    name = '',
    address = '',
    mapx = 0.0,
    mapy = 0.0,
    start_date = null,
    end_date = null,
    description = '',
    site_link = '',
    weekly_view_count = 0,
    favorite_count = 0,
    images = []
  } = {}) {
    this.id = id;                           // int - PK (DB에서 자동 생성)
    this.name = name;                       // string - 이름
    this.address = address;                 // string - 주소
    this.mapx = parseFloat(mapx) || 0.0;   // float - 위도 (X)
    this.mapy = parseFloat(mapy) || 0.0;   // float - 경도 (Y)
    this.start_date = start_date;           // date - 시작일
    this.end_date = end_date;               // date - 종료일
    this.description = description;         // string - 설명
    this.site_link = site_link;             // string - 사이트 링크
    this.weekly_view_count = weekly_view_count;  // int - 주간 뷰 수
    this.favorite_count = favorite_count;   // int - 즐겨찾기 수
    this.images = images;                   // array - 이미지 URL 배열
  }

  // DB INSERT용 객체 변환
  toDBObject() {
    return {
      name: this.name,
      address: this.address,
      mapx: this.mapx,
      mapy: this.mapy,
      start_date: this.start_date,
      end_date: this.end_date,
      description: this.description,
      site_link: this.site_link,
      weekly_view_count: this.weekly_view_count,
      favorite_count: this.favorite_count
    };
  }

  // JSON 직렬화
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      address: this.address,
      mapx: this.mapx,
      mapy: this.mapy,
      start_date: this.start_date,
      end_date: this.end_date,
      description: this.description,
      site_link: this.site_link,
      weekly_view_count: this.weekly_view_count,
      favorite_count: this.favorite_count,
      images: this.images
    };
  }
}

module.exports = PopupStore;
