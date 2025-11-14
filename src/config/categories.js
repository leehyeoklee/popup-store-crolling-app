/**
 * 팝업스토어 카테고리 설정
 */
const CATEGORIES = [
  'fashion',        // 패션
  'beauty',         // 뷰티
  'food',           // 식품/디저트
  'character',      // 캐릭터/굿즈
  'exhibition',     // 전시/아트
  'entertainment',  // 엔터테인먼트
  'lifestyle',      // 라이프스타일/리빙
  'theme_park',     // 테마파크/체험
  'animation',      // 애니메이션/만화
  'tech',           // IT/테크
  'culture',        // 문화/출판
  'sports',         // 스포츠/피트니스
  'etc'             // 기타
];

// 한글 매핑 (프론트엔드 표시용)
const CATEGORY_LABELS = {
  'fashion': '패션',
  'beauty': '뷰티',
  'food': '식품/디저트',
  'character': '캐릭터/굿즈',
  'exhibition': '전시/아트',
  'entertainment': '엔터테인먼트',
  'lifestyle': '라이프스타일/리빙',
  'theme_park': '테마파크/체험',
  'animation': '애니메이션/만화',
  'tech': 'IT/테크',
  'culture': '문화/출판',
  'sports': '스포츠/피트니스',
  'etc': '기타'
};

/**
 * AI 카테고리 분류용 시스템 프롬프트
 */
const SYSTEM_PROMPT = `You are an expert in categorizing popup stores.
Select 1-3 most appropriate categories from the following list:

Categories:
- fashion
- beauty
- food
- character
- exhibition
- entertainment
- lifestyle
- theme_park
- animation
- tech
- culture
- sports
- etc

CRITICAL: Return ONLY a raw JSON array without markdown code blocks, explanations, or formatting.
Do NOT wrap the response in \`\`\`json or \`\`\` tags.

Required format (pure JSON array):
[
  {"name": "popup store name", "categories": ["fashion", "beauty"]},
  {"name": "another store", "categories": ["food"]}
]`;

module.exports = {
  CATEGORIES,
  CATEGORY_LABELS,
  SYSTEM_PROMPT
};
