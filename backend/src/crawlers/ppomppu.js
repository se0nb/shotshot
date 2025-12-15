import puppeteer from 'puppeteer';
import UserAgent from 'user-agents';

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌게시판(id=ppomppu) 크롤링 시작 (Puppeteer 방식) ---');
    
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    try {
        const page = await browser.newPage();
        
        // 봇 탐지 우회: 랜덤 User-Agent 설정
        const userAgent = new UserAgent({ deviceCategory: 'desktop' });
        await page.setUserAgent(userAgent.toString());
        
        // 뷰포트 설정 (일반 모니터 해상도)
        await page.setViewport({ width: 1920, height: 1080 });

        // 페이지 이동 (네트워크 유휴 상태까지 대기)
        await page.goto(PPOMPPU_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // 게시글 목록(.list0, .list1)이 로드될 때까지 대기
        try {
            await page.waitForSelector('.list1', { timeout: 10000 });
        } catch (e) {
            console.warn('뽐뿌 리스트 요소를 찾는 데 시간이 걸리거나 실패했습니다.');
        }

        const deals = await page.evaluate(() => {
            const list = [];
            // 뽐뿌 게시판은 tr 태그에 class="list0" 또는 "list1"을 번갈아 사용합니다.
            const rows = document.querySelectorAll('tr.list0, tr.list1');

            rows.forEach(row => {
                try {
                    // 1. 유효한 게시글 행인지 확인 (td 개수가 적으면 광고/공지일 확률 높음)
                    const tds = row.querySelectorAll('td');
                    if (tds.length < 4) return;

                    // 2. 제목 및 링크 추출
                    // 제목 셀은 보통 3번째(인덱스 2) 또는 4번째에 위치하나 가변적일 수 있음.
                    // 확실한 방법은 'view.php' 링크를 가진 a 태그를 찾는 것.
                    const titleAnchor = row.querySelector('a[href*="view.php"]');
                    if (!titleAnchor) return;

                    let link = titleAnchor.getAttribute('href');
                    const noMatch = link.match(/no=(\d+)/);
                    if (!noMatch) return; // 게시글 번호 없으면 스킵
                    const originId = noMatch[1];

                    // 링크 정규화
                    if (!link.startsWith('http')) {
                        link = `https://www.ppomppu.co.kr/zboard/${link}`;
                    }

                    // 제목 텍스트 추출 (폰트 태그 제거 등 정리)
                    let title = titleAnchor.textContent.trim();
                    // 만약 .list_title 클래스가 있다면 그 안의 텍스트가 더 정확함
                    const listTitleEl = row.querySelector('.list_title');
                    if (listTitleEl) {
                        title = listTitleEl.textContent.trim();
                    }

                    // 3. 이미지 추출 (썸네일)
                    let imageUrl = null;
                    const imgEl = row.querySelector('img');
                    if (imgEl) {
                        const src = imgEl.getAttribute('src');
                        if (src && !src.includes('noimage')) {
                            if (src.startsWith('//')) imageUrl = 'https:' + src;
                            else if (src.startsWith('http')) imageUrl = src;
                            else imageUrl = 'https://www.ppomppu.co.kr' + src;
                        }
                    }

                    // 4. 댓글 수 추출
                    let commentCount = 0;
                    const commentEl = row.querySelector('.list_comment2');
                    if (commentEl) {
                        commentCount = parseInt(commentEl.textContent.trim()) || 0;
                    }

                    // 5. 카테고리 추출
                    let category = '기타';
                    // 제목 앞의 [분류] 패턴 확인
                    const catMatch = title.match(/^\[([^\]]+)\]/);
                    if (catMatch) {
                        category = catMatch[1];
                        title = title.replace(/^\[[^\]]+\]/, '').trim(); // 제목에서 카테고리 제거
                    }

                    // 6. 가격 추출 (제목 내 괄호 패턴)
                    let price = '미확인';
                    // 예: "상품명 (10,000원/무료)" -> 괄호 안의 내용 추출
                    // 댓글 수([30])와 혼동 방지를 위해 소괄호() 사용 패턴 우선
                    const priceMatch = title.match(/\(([^)]+)\)$/);
                    if (priceMatch) {
                        price =QXMatch[1];
                    }

                    // 7. 작성 시간 추출
                    // 뽐뿌는 td의 title 속성에 전체 날짜(YYYY-MM-DD HH:MM:SS)를 넣어두는 경우가 많음
                    let postedAt = new Date().toISOString();
                    // 보통 뒤에서 두번째나 세번째 td에 날짜가 있음
                    for (const td of tds) {
                        const titleAttr = td.getAttribute('title');
                        // 날짜 형식(YY.MM.DD 또는 YYYY-MM-DD)이 포함되어 있는지 간단 체크
                        if (titleAttr && (titleAttr.includes('.') || titleAttr.includes('-')) && titleAttr.includes(':')) {
                            postedAt = titleAttr;
                            break;
                        }
                    }

                    list.push({
                        site: 'ppomppu',
                        originId,
                        title,
                        price,
                        url: link,
                        imageUrl,
                        category,
                        commentCount,
                        postedAt
                    });
                } catch (e) {
                    // 개별 행 파싱 실패 시 무시
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
        await browser.close();
    }
}