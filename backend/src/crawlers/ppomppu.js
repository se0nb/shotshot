import puppeteer from 'puppeteer';
import UserAgent from 'user-agents';

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌게시판(id=ppomppu) 크롤링 시작 (Puppeteer + 정밀 파싱) ---');
    
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ] 
    });

    try {
        const page = await browser.newPage();
        
        // 1. 랜덤 User-Agent 설정 (봇 차단 방지)
        const userAgent = new UserAgent({ deviceCategory: 'desktop' });
        await page.setUserAgent(userAgent.toString());
        await page.setViewport({ width: 1366, height: 768 });

        // 2. 페이지 접속 (DOM 로드될 때까지 대기)
        await page.goto(PPOMPPU_URL, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });

        // 3. 게시글 목록 요소가 로드될 때까지 명시적 대기
        try {
            await page.waitForSelector('.list1', { timeout: 10000 });
        } catch (e) {
            console.warn('⚠️ 리스트 요소를 찾는 데 시간이 걸리거나 실패했습니다.');
        }

        // 4. 브라우저 컨텍스트에서 데이터 추출
        const deals = await page.evaluate(() => {
            const list = [];
            
            // 뽐뿌는 tr 태그에 list0(짝수), list1(홀수) 클래스를 줍니다.
            // 이를 통해 공지사항(notice)이나 광고를 1차적으로 필터링할 수 있습니다.
            const rows = document.querySelectorAll('tr.list0, tr.list1');

            rows.forEach(row => {
                try {
                    // --- 방어 로직 ---
                    // 유효한 게시글 행은 보통 td가 4개 이상입니다.
                    const tds = row.querySelectorAll('td');
                    if (tds.length < 4) return;

                    // --- 1. 링크 및 ID 추출 ---
                    // 보통 3번째 td 안에 제목 링크가 있습니다.
                    const titleAnchor = row.querySelector('td:nth-child(3) a[href*="view.php"]');
                    if (!titleAnchor) return;

                    let link = titleAnchor.getAttribute('href');
                    const noMatch = link.match(/no=(\d+)/);
                    if (!noMatch) return; // 게시글 고유 번호(no)가 없으면 스킵
                    
                    const originId = noMatch[1];

                    // 링크 정규화
                    if (!link.startsWith('http')) {
                        link = `https://www.ppomppu.co.kr/zboard/${link}`;
                    }

                    // --- 2. 이미지 추출 ---
                    let imageUrl = null;
                    const imgEl = row.querySelector('img'); // 행 내부의 첫 번째 이미지
                    if (imgEl) {
                        const src = imgEl.getAttribute('src');
                        if (src && !src.includes('noimage')) {
                            if (src.startsWith('//')) imageUrl = 'https:' + src;
                            else if (src.startsWith('http')) imageUrl = src;
                            else imageUrl = 'https://www.ppomppu.co.kr' + src;
                        }
                    }

                    // --- 3. 제목 및 텍스트 추출 ---
                    // .list_title 클래스 안에 제목이 있는 경우가 많음
                    let rawTitle = '';
                    const listTitleEl = row.querySelector('.list_title');
                    
                    if (listTitleEl) {
                        rawTitle = listTitleEl.innerText.trim(); // textContent보다 innerText가 숨겨진 텍스트 제외에 유리
                    } else {
                        rawTitle = titleAnchor.innerText.trim();
                    }

                    // --- 4. 댓글 수 추출 ---
                    let commentCount = 0;
                    const commentEl = row.querySelector('.list_comment2');
                    if (commentEl) {
                        const text = commentEl.innerText.trim();
                        commentCount = parseInt(text) || 0;
                    }

                    // --- 5. 카테고리 추출 ---
                    let category = '기타';
                    // 1) td 안에 small 태그로 분류가 있는 경우
                    const smallTag = row.querySelector('td:nth-child(3) small');
                    if (smallTag) {
                        category = smallTag.innerText.trim();
                    } else {
                        // 2) 제목 앞의 [분류] 패턴
                        const catMatch = rawTitle.match(/^\[([^\]]+)\]/);
                        if (catMatch) category = catMatch[1];
                    }

                    // --- 6. 가격 추출 ---
                    // 제목 끝의 (가격) 패턴 추출. 예: "상품명 (10,000원)"
                    let price = '미확인';
                    const priceMatch = rawTitle.match(/\(([^)]+)\)$/);
                    if (priceMatch) {
                        // 마지막 괄호 안의 내용이 숫자를 포함하면 가격으로 간주
                        const content =pVMatch[1];
                        if (/\d/.test(content)) {
                            price = content;
                        }
                    }

                    // --- 7. 제목 정제 (선택 사항) ---
                    // 카테고리([..]) 제거하여 깔끔하게
                    const cleanTitle = rawTitle.replace(/^\[[^\]]+\]/, '').trim();

                    // --- 8. 작성 시간 추출 ---
                    // 뽐뿌는 td의 title 속성에 전체 날짜(YYYY-MM-DD HH:MM:SS)를 넣어두는 경우가 많습니다.
                    let postedAt = new Date().toISOString();
                    // 뒤쪽 td들 순회하며 title 속성 확인
                    for (let i = tds.length - 1; i >= 0; i--) {
                        const titleAttr = tds[i].getAttribute('title');
                        // 날짜 포맷 확인 (간단한 체크)
                        if (titleAttr && (titleAttr.includes('.') || titleAttr.includes('-')) && titleAttr.includes(':')) {
                            postedAt = titleAttr; // 날짜 문자열 그대로 저장 (나중에 DB 저장 시 Date 객체 변환됨)
                            break;
                        }
                    }

                    list.push({
                        site: 'ppomppu',
                        originId,
                        title: cleanTitle || rawTitle,
                        price,
                        url: link,
                        imageUrl,
                        category,
                        commentCount,
                        postedAt
                    });
                } catch (err) {
                    // 개별 행 파싱 에러는 무시하고 계속 진행
                }
            });

            return list;
        });

        console.log(`✅ 뽐뿌 수집 성공: ${deals.length}개`);
        return deals;

    } catch (error) {
        console.error('❌ 뽐뿌 크롤링 실패:', error.message);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}