const { chromium } = require('playwright');

/**
 * 네이버 지도 팝업 스토어 크롤러 (순수 크롤링만)
 * @param {string} searchKeyword - 검색 키워드
 * @param {Function} onPageComplete - 페이지별 데이터 처리 콜백 (pageData) => Promise<void>
 * @param {Logger} logger - 로그 기록용 인스턴스
 * @returns {Promise<Object>} { totalCount, pageCount }
 */
async function crawlNaverMapPopups(searchKeyword, onPageComplete, logger) {
  const browser = await chromium.launch({ 
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-software-rasterizer'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  // 브라우저 연결 상태 추적
  let browserClosed = false;
  page.on('close', () => { browserClosed = true; });
  context.on('close', () => { browserClosed = true; });
  
  // 리소스 차단으로 속도 최적화 (이미지는 URL 수집을 위해 허용)
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['font', 'stylesheet', 'media'].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });
  
  try {
    await page.goto(`https://map.naver.com/p/search/${encodeURIComponent(searchKeyword)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    const iframe = page.frameLocator('#searchIframe');
    await iframe.locator('li.guugO').first().waitFor({ timeout: 30000 });
    
    let totalCount = 0;
    let pageNum = 1;

    while (true) {
      const pageData = [];
      logger.log(`\n=== 페이지 ${pageNum} 크롤링 중 ===`);
      
      // 스크롤을 내려서 모든 아이템 로드
      const scrollList = iframe.locator('div.Ryr1F');
      let previousCount = 0;
      let currentCount = 0;
      let stableCount = 0;
      
      for (let scroll = 0; scroll < 10; scroll++) {
        await scrollList.evaluate(el => {
          el.scrollTop = el.scrollHeight;
        }).catch(() => {});
        await page.waitForTimeout(500);
        
        currentCount = await iframe.locator('li.guugO').count();
        
        if (currentCount === previousCount) {
          stableCount++;
          if (stableCount >= 2) {
            logger.log(`  ${currentCount}개 아이템 로드 완료`);
            break;
          }
        } else {
          stableCount = 0;
        }
        previousCount = currentCount;
      }
      
      const listItems = iframe.locator('li.guugO');
      const count = await listItems.count();

      let consecutiveFailures = 0; // 연속 실패 카운터
      const MAX_CONSECUTIVE_FAILURES = 5; // 최대 연속 실패 허용 횟수

      for (let i = 0; i < count; i++) {
        // 브라우저가 닫혔으면 즉시 중단
        if (browserClosed) {
          logger.error(`\n[ERROR] 브라우저가 닫혔습니다. 크롤링을 중단합니다.`);
          break;
        }

        // 5개 연속 실패 시 다음 페이지로
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          logger.warn(`\n[WARN] ${MAX_CONSECUTIVE_FAILURES}개 연속 실패 - 다음 페이지로 이동합니다.`);
          break;
        }

        const itemStartTime = Date.now();
        const currentItem = listItems.nth(i);
        const link = currentItem.locator('span.QeVJ4');

        const name = await link.innerText().catch(() => `item_${i}`);
        // 로그를 한 줄에 이름, 전체 시간, 각 단계별 시간 모두 출력
        const itemLogPrefix = `[페이지 ${pageNum}] [${i + 1}/${count}]`;
        let itemTotalTime = 0;
        
        // 전체 아이템 처리에 타임아웃 적용 (30초)
        const ITEM_TIMEOUT = 30000;
        const itemProcessingPromise = (async () => {
          let address = '';
          let startDate = '';
          let endDate = '';
          let description = '';
          let images = [];

          // 기간 정보 추출
          const t1 = Date.now();
          const periodEl = await currentItem.locator('span.tTTdX time').first().textContent({ timeout: 10000 }).catch(() => null);
          const time1 = Date.now() - t1;
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

          // 이미지 수집 (검색 결과 목록에서)
          const t2 = Date.now();
          try {
            // 이미지 컨테이너가 보이도록 스크롤
            await currentItem.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(300); // 이미지 로딩 대기
            
            const imageElements = currentItem.locator('div.YYh8o img.K0PDV');
            const imageCount = await imageElements.count();
            const maxImages = Math.min(imageCount, 1);
            
            for (let j = 0; j < maxImages; j++) {
              const imgSrc = await imageElements.nth(j).getAttribute('src', { timeout: 1000 }).catch(() => null);
              if (imgSrc && imgSrc.startsWith('http')) {
                images.push(imgSrc);
              }
            }
          } catch (error) {
            // 이미지 없어도 계속 진행
          }
          const time2 = Date.now() - t2;

          // 상세 페이지로 이동
          const t3 = Date.now();
          await link.click({ timeout: 10000 }).catch(async () => {
            await currentItem.locator('a').first().click({ timeout: 10000 }).catch(() => {});
          });
          const time3 = Date.now() - t3;

          // entryIframe이 나타날 때까지 대기
          const t4 = Date.now();
          const entryFrame = page.frameLocator('#entryIframe');
          const time4 = Date.now() - t4;
          
          // 주소와 설명 병렬 수집 (타임아웃 추가)
          const t5 = Date.now();
          let addressText = '';
          let descText = '';
          
          try {
            await page.waitForTimeout(300);
            addressText = await entryFrame.locator('span.LDgIH').first().textContent({ timeout: 10000 }).catch(() => '');
            await page.waitForTimeout(300);
            descText = await entryFrame.locator('div.RoqbX').first().textContent({ timeout: 10000 }).catch(() => '');
          } catch (error) {
            logger.warn(`    [WARN] 주소/설명 수집 실패: ${error.message}`);
          }
          const time5 = Date.now() - t5;
          
          address = addressText.trim();
          const desc = descText.trim();
          description = desc.length > 500 ? desc.substring(0, 500) + '...' : desc;

          // 상세창 닫기: 실제 닫기 버튼을 class와 텍스트로 명확하게 선택
          let closed = false;
          try {
            const closeBtn = entryFrame.locator('a.mKQJy:has(span.place_blind:text("페이지 닫기"))');
            if (await closeBtn.count() > 0) {
              await closeBtn.click({ timeout: 3000 });
              closed = true;
            }
          } catch (e) {}
          // 2. 뒤로가기 버튼 시도 (닫기 실패 시)
          if (!closed) {
            try {
              const backBtn = entryFrame.getByRole('button', { name: /뒤로가기|Back/ });
              if (await backBtn.count() > 0) {
                await backBtn.click({ timeout: 3000 });
                closed = true;
              }
            } catch (e) {}
          }
          // 3. 리스트 복구 대기
          if (closed) {
            await iframe.locator('li.guugO').first().waitFor({ timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(300);
          }

          return { address, startDate, endDate, description, images, time1, time2, time3, time4, time5 };
        })();

        // 타임아웃과 Promise 경쟁
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), ITEM_TIMEOUT);
        });

        let itemData = null;
        try {
          itemData = await Promise.race([itemProcessingPromise, timeoutPromise]);
          pageData.push({
            name,
            address: itemData.address,
            startDate: itemData.startDate,
            endDate: itemData.endDate,
            description: itemData.description,
            images: itemData.images
          });

          consecutiveFailures = 0; // 성공 시 카운터 리셋
          itemTotalTime = Date.now() - itemStartTime;
          logger.log(`${itemLogPrefix} ${name} | 총:${itemTotalTime}ms | 기간:${itemData.time1}ms | 이미지:${itemData.time2}ms | 클릭:${itemData.time3}ms | iframe:${itemData.time4}ms | 주소/설명:${itemData.time5}ms`);
        } catch (error) {
          consecutiveFailures++; // 실패 시 카운터 증가
          
          const totalTime = Date.now() - itemStartTime;
          if (error.message === 'TIMEOUT') {
            logger.warn(`    [SKIP] 타임아웃 (${ITEM_TIMEOUT / 1000}초 초과) - 다음 항목으로 이동 (연속실패: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}) (총=${totalTime}ms)`);
          } else {
            logger.warn(`    [SKIP] 오류 발생: ${error.message} (연속실패: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}) (총=${totalTime}ms)`);
            
            // 브라우저 닫힘 관련 에러면 즉시 중단
            if (error.message.includes('closed') || error.message.includes('Target page')) {
              browserClosed = true;
              logger.error(`\n[ERROR] 브라우저 연결이 끊어졌습니다. 크롤링을 중단합니다.`);
              break;
            }
          }
          // 타임아웃 또는 오류 발생 시 다음 항목으로 계속
          continue;
        }
      }

      // 페이지 데이터 처리 (콜백 호출)
      if (pageData.length > 0 && onPageComplete) {
        logger.log(`\n[SAVE] 페이지 ${pageNum} 데이터 저장 중... (${pageData.length}개)`);
        await onPageComplete(pageData);
        totalCount += pageData.length;
      }

      // 다음 페이지 확인
      const nextButton = iframe.getByRole('button', { name: '다음페이지' });
      
      if (await nextButton.count() === 0 || await nextButton.getAttribute('aria-disabled') === 'true') {
        logger.log('  마지막 페이지 도달');
        break;
      }
      
      logger.log('  다음 페이지로 이동...');
      await nextButton.click();
      await iframe.locator('li.guugO').first().waitFor({ timeout: 10000 }).catch(() => {});
      pageNum++;
    }

    logger.log(`\n[OK] 크롤링 완료: 총 ${totalCount}개 (페이지: ${pageNum}개)`);
    return { totalCount, pageCount: pageNum };
  } finally {
    await browser.close();
  }
}

module.exports = crawlNaverMapPopups;
