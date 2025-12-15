import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌게시판(id=ppomppu) 크롤링 시작 (클래스 기반 정밀 탐색) ---');
    try {
        const response = await axios.get(PPOMPPU_URL, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                // 뽐뿌는 쿠키가 없으면 종종 봇으로 간주하고 차단하거나 다른 페이지를 보여줍니다.
                'Cookie': 'PHPSESSID=access; visit_time=' + Date.now() 
            }
        });
        
        // EUC-KR 디코딩 (뽐뿌는 구형 인코딩 사용)
        const html = iconv.decode(response.data, 'EUC-KR').toString();
        const $ = cheerio.load(html);
        const dealList = [];

        // [핵심 변경 사항]
        // 1. 전체 링크를 긁지 않고, 실제 게시글 목록인 tr.list0, tr.list1 만 타겟팅합니다.
        // 이렇게 하면 공지사항, 광고, 사이드바 인기글 등을 자동으로 제외할 수 있습니다.
        const listRows = $('.list0, .list1');

        listRows.each((index, element) => {
            try {
                const row = $(element);
                
                // 광고나 공지사항(필드 구조가 다름) 제외를 위한 방어 코드
                // 뽐뿌 게시글 행은 보통 td가 4~5개 이상입니다.
                if (row.find('td').length < 4) return;

                // --- 1. 링크 및 ID 추출 ---
                // 보통 3번째 td 안에 제목 링크가 있습니다.
                const titleAnchor = row.find('td:nth-child(3) a[href*="view.php"]');
                if (!titleAnchor.length) return;

                const link = titleAnchor.attr('href');
                if (!link) return;

                // URL에서 게시글 번호(no) 추출
                const noMatch = link.match(/no=(\d+)/);
                const originId = noMatch ? noMatch[1] : null;
                if (!originId) return;

                // --- 2. 썸네일 추출 ---
                // 3번째 td 안의 img 태그
                let imageUrl = row.find('td:nth-child(3) img').attr('src');
                if (imageUrl) {
                    if (imageUrl.includes('noimage')) {
                        imageUrl = null;
                    } else if (imageUrl.startsWith('//')) {
                        imageUrl = 'https:' + imageUrl;
                    } else if (!imageUrl.startsWith('http')) {
                        imageUrl = 'https://www.ppomppu.co.kr' + imageUrl;
                    }
                }

                // --- 3. 제목 및 댓글 수 추출 ---
                // 뽐뿌는 <font class="list_title">제목</font> 구조를 사용하거나 a 태그 안에 텍스트가 있습니다.
                let fullTitle = row.find('.list_title').text().trim();
                if (!fullTitle) fullTitle = titleAnchor.text().trim();

                // 댓글 수: 제목 뒤에 [숫자] 형태로 붙거나, 별도의 span/class로 존재할 수 있음
                // 뽐뿌는 보통 .list_comment2 클래스에 댓글 수가 있습니다.
                const commentCountText = row.find('.list_comment2').text().trim();
                const commentCount = parseInt(commentCountText) || 0;

                // --- 4. 카테고리 추출 ---
                // 보통 제목 앞의 [카테고리] 텍스트 또는 td 내의 small 태그
                let category = '기타';
                const smallTag = row.find('td:nth-child(3) small'); // 분류가 small 태그인 경우
                if (smallTag.length) {
                    category = smallTag.text().trim();
                } else {
                    // 제목 앞의 [분류] 추출 시도
                    const catMatch = fullTitle.match(/^\[([^\]]+)\]/);
                    if (catMatch) category = catMatch[1];
                }
                
                // --- 5. 가격 추출 ---
                // 뽐뿌 게시판은 제목 끝에 괄호로 가격을 적는 규칙이 있습니다. 예: "상품명 (10,000원/무료)"
                let price = '미확인';
                // 괄호 안의 내용을 찾되, 댓글 수([30])와 혼동하지 않도록 괄호()를 타겟팅
                const priceMatch = fullTitle.match(/\(([^)]+)\)$/); 
                if (priceMatch) {
                    price =QXMatch[1].trim();
                } else {
                    // 제목 중간에 있는 경우도 대비
                    const strictPriceMatch = fullTitle.match(/\(([\d,]+(원|달러|KRW|USD).*?)\)/);
                    if (strictPriceMatch) price = strictPriceMatch[1];
                }

                // --- 6. 제목 정제 ---
                // 카테고리([..])와 댓글수, 가격 등을 제목에서 제거하여 깔끔하게 만듦 (선택사항)
                let cleanTitle = fullTitle
                    .replace(/^\[[^\]]+\]/, '') // 앞쪽 카테고리 제거
                    .replace(/\s+/g, ' ')       // 공백 정리
                    .trim();

                // URL 정규화
                let fullUrl = link.trim();
                if (!fullUrl.startsWith('http')) {
                    fullUrl = 'https://www.ppomppu.co.kr/zboard/' + fullUrl;
                }

                dealList.push({
                    site: 'ppomppu',
                    originId,
                    title: cleanTitle,
                    price,
                    url: fullUrl,
                    imageUrl,
                    // 4번째 td가 글쓴이, 5번째 td가 날짜인 경우가 많음 (title 속성에 전체 날짜가 있음)
                    postedAt: row.find('td:nth-child(5)').attr('title') || new Date().toISOString(),
                    commentCount,
                    category
                });

            } catch (err) {
                console.warn('Parsing Error in row:', err.message);
            }
        });
        
        console.log(`✅ 뽐뿌 수집 성공: ${dealList.length}개`);
        returnQlList;

    } catch (error) {
        console.error('❌ 뽐뿌 크롤링 실패:', error.message);
        // axios는 봇 차단 시 403, 406 에러 등을 뱉을 수 있음
        return [];
    }
}