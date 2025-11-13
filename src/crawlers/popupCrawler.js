const { chromium } = require('playwright');

/**
 * 네이버 지도 팝업 스토어 크롤러 (순수 크롤링만)
 * @param {string} searchKeyword - 검색 키워드
 * @param {boolean} headless - 헤드리스 모드 여부
 * @returns {Promise<Array>} 크롤링된 팝업 데이터 배열
 */
async function crawlNaverMapPopups(searchKeyword, headless = true) {
  const browser = await chromium.launch({ 
    headless: headless,
    args: headless ? [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-software-rasterizer'
    ] : []
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  // 리소스 차단으로 속도 최적화
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });
  
  try {
    await page.goto(`https://map.naver.com/p/search/${encodeURIComponent(searchKeyword)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(1000);
    const iframe = page.frameLocator('#searchIframe');
    await iframe.locator('li.guugO').first().waitFor({ timeout: 30000 });
    
    const popupData = [];
    let pageNum = 1;

    while (true) {
      console.log(`\n=== 페이지 ${pageNum} 크롤링 중 ===`);
      
      // 스크롤을 내려서 모든 아이템 로드
      const scrollList = iframe.locator('div.Ryr1F');
      let previousCount = 0;
      let currentCount = 0;
      let stableCount = 0;
      
      for (let scroll = 0; scroll < 10; scroll++) {
        await scrollList.evaluate(el => {
          el.scrollTop = el.scrollHeight;
        }).catch(() => {});
        await page.waitForTimeout(300);
        
        currentCount = await iframe.locator('li.guugO').count();
        
        if (currentCount === previousCount) {
          stableCount++;
          if (stableCount >= 2) {
            console.log(`  ${currentCount}개 아이템 로드 완료`);
            break;
          }
        } else {
          stableCount = 0;
        }
        previousCount = currentCount;
      }
      
      const listItems = iframe.locator('li.guugO');
      const count = await listItems.count();

      for (let i = 0; i < count; i++) {
        const currentItem = listItems.nth(i);
        const link = currentItem.locator('span.QeVJ4');

        const name = await link.innerText().catch(() => `item_${i}`);
        console.log(`  [${i + 1}/${count}] ${name}`);
        
        let address = '';
        let startDate = '';
        let endDate = '';
        let description = '';
        let images = [];

        // 기간 정보 추출
        const periodEl = await currentItem.locator('span.tTTdX time').first().textContent({ timeout: 3000 }).catch(() => null);
        if (periodEl) {
          const period = periodEl.trim();
          let match = period.match(/(\d{2}\.\d{2}\.\d{2}\.)\s*~\s*(\d{2}\.\d{2}\.\d{2}\.)/);
          
          if (!match) {
            match = period.match(/(\d{2}\.\d{2}\.\d{2}\.)\s*~\s*(\d{2}\.\d{2}\.)/);
            if (match) {
              startDate = match[1].trim();
              endDate = match[1].substring(0, 3) + match[2].trim();
            } else {
              match = period.match(/(\d{2}\.\d{2}\.\d{2}\.)/);
              if (match) {
                startDate = match[1].trim();
                endDate = null; // 종료일 미정
              }
            }
          } else {
            startDate = match[1].trim();
            endDate = match[2].trim();
          }
        }

        // 상세 페이지로 이동
        await link.click({ timeout: 3000 }).catch(async () => {
          await currentItem.locator('a').first().click({ timeout: 3000 }).catch(() => {});
        });

        await page.waitForTimeout(600);

        const entryFrame = page.frameLocator('#entryIframe');
        
        // 주소와 설명 병렬 수집
        const [addressText, descText] = await Promise.all([
          entryFrame.locator('span.LDgIH').first().textContent({ timeout: 2000 }).catch(() => ''),
          entryFrame.locator('div.RoqbX').first().textContent({ timeout: 2000 }).catch(() => '')
        ]);
        
        address = addressText.trim();
        const desc = descText.trim();
        description = desc.length > 500 ? desc.substring(0, 500) + '...' : desc;

        // 이미지 수집
        try {
          const imageElements = entryFrame.locator('img');
          const imageCount = await imageElements.count();
          for (let j = 0; j < imageCount; j++) {
            const imgSrc = await imageElements.nth(j).getAttribute('src').catch(() => null);
            if (imgSrc && imgSrc.startsWith('http')) {
              images.push(imgSrc);
            }
          }
        } catch (error) {
          console.error('    이미지 수집 실패:', error.message);
        }

        popupData.push({
          name,
          address,
          startDate,
          endDate,
          description,
          images
        });
      }

      // 다음 페이지 확인
      const nextButton = iframe.getByRole('button', { name: '다음페이지' });
      
      if (await nextButton.count() === 0 || await nextButton.getAttribute('aria-disabled') === 'true') {
        console.log('  마지막 페이지 도달');
        break;
      }
      
      console.log('  다음 페이지로 이동...');
      await nextButton.click();
      await page.waitForTimeout(800);
      pageNum++;
    }

    console.log(`\n[OK] 크롤링 완료: 총 ${popupData.length}개`);
    return popupData;
  } finally {
    await browser.close();
  }
}

module.exports = crawlNaverMapPopups;
