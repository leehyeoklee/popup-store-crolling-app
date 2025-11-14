const OpenAI = require('openai');
const { SYSTEM_PROMPT } = require('../config/categories');

class CategoryClassifier {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * 배치로 여러 팝업스토어 분류 (비용 절감)
   * @param {Array} popupStores - [{name, description}, ...]
   * @returns {Promise<Array>} [{name, categories: []}, ...]
   */
  async classifyBatch(popupStores) {
    try {
      const items = popupStores.map(p => ({
        name: p.name,
        address: p.address || '',
        description: p.description || ''
      }));


      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: JSON.stringify(items, null, 2)
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content.trim();
      
      // JSON 코드 블록 제거 (```json ... ``` 형태 처리)
      let jsonString = content;
      if (content.startsWith('```')) {
        // ```json 또는 ``` 제거
        jsonString = content.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
      }
      
      const result = JSON.parse(jsonString);
      return result;
      
    } catch (error) {
      console.warn('[WARN] 배치 카테고리 분류 실패:', error.message);
      // 실패 시 모두 'etc'로 분류
      return popupStores.map(p => ({ name: p.name, categories: ['etc'] }));
    }
  }
}

module.exports = CategoryClassifier;
