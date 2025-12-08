import puppeteer from 'puppeteer';
import UserAgent from 'user-agents';

const QUASAR_URL = 'https://quasarzone.com/bbs/qb_saleinfo';

export async function quasarzoneCrawler() {
    console.log('--- 퀘이사존 크롤링 시작 (선택자 수정됨) ---');
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent(new UserAgent().toString());
        
        // 페이지 이동 후 특정 요소가 로드될 때까지 대기 (타임아웃 60초)
        await page.goto(QUASAR_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // 🚨 리스트 요소가 렌더링될 때까지 명시적으로 대기
        try {
            await page.waitForSelector('.market-info-list', { timeout: 5000 });
        } catch (e) {
            console.warn('퀘이사존 리스트 요소를 찾지 못했습니다 (타임아웃).');
        }

        const deals = await page.evaluate(() => {
            const list = [];
            // 🚨 선택자 변경: .market-info-list (정확한 핫딜 리스트)
            const rows = document.querySelectorAll('.market-info-list');

            rows.forEach(el => {
                try {
                    // 종료된 딜 제외
                    if (el.querySelector('.label.done')) return;

                    const titleEl = el.querySelector('.subject-link');
                    if (!titleEl) return;

                    const rawTitle = titleEl.textContent.trim();
                    if (rawTitle.includes('블라인드')) return;

                    // 제목 안의 댓글 수 텍스트 제거 (예: 제목 [10] -> 제목)
                    // 퀘이사존 구조상 제목 태그 안에 댓글 수가 같이 있는 경우가 있음
                    const title = rawTitle.split('\n')[0].trim();

                    const link = titleEl.getAttribute('href');
                    const fullUrl = `https://quasarzone.com${link}`;
                    const originId = fullUrl.split('/').pop();

                    // 이미지 추출 (thumb-wrap 내부 이미지)
                    let imageUrl = el.querySelector('.thumb-wrap img')?.getAttribute('src');
                    if (imageUrl && !imageUrl.startsWith('http')) {
                        imageUrl = `https://quasarzone.com${imageUrl}`;
                    }

                    // 가격 추출
                    const price = el.querySelector('.market-info-sub .text-orange')?.textContent.trim() || '미확인';
                    
                    // 카테고리 추출
                    const category = el.querySelector('.category')?.textContent.trim() || '기타';
                    
                    // 댓글 수 추출
                    const commentCountText = el.querySelector('.count')?.textContent.trim() || '0';
                    const commentCount = parseInt(commentCountText.replace(/,/g, '')) || 0;

                    if (originId) {
                        list.push({
                            site: 'quasarzone',
                            originId, 
                            title, 
                            price, 
                            url: fullUrl,
                            imageUrl,
                            category, 
                            commentCount,
                            postedAt: new Date().toISOString()
                        });
                    }
                } catch (e) {}
            });
            return list;
        });
        
        console.log(`퀘이사존 수집 완료: ${deals.length}개`);
        return deals;
    } catch (error) {
        console.error('퀘이사존 크롤링 실패:', error.message);
        return [];
    } finally {
        await browser.close();
    }
}