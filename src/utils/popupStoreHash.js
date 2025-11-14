// popupStoreHash.js
// 팝업스토어 주요 필드로 해시값을 만드는 함수 (DB/크롤링 동일 방식)

const crypto = require('crypto');

/**
 * YY.MM.DD. 형태로 날짜 변환
 * @param {string|Date} date
 * @returns {string}
 */
function formatDateToYYMMDD(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d)) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}.`;
}

/**
 * 팝업스토어 주요 필드로 해시값 생성
 * @param {{ name: string, address: string, startDate: string|Date, endDate: string|Date }} data
 * @returns {string} hash값
 */
function getPopupHash(data) {
  const hashInput = [
    data.name,
    data.address,
    formatDateToYYMMDD(data.startDate),
    formatDateToYYMMDD(data.endDate)
  ].join('|');
  return crypto.createHash('md5').update(hashInput).digest('hex');
}

module.exports = { getPopupHash, formatDateToYYMMDD };
