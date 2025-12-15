import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌게시판(id=ppomppu) 크롤링 시작 (링크 기반 탐색) ---');
    try {
        const response = await axios.get(PPOMPPU_URL, {
            responseType: 'arraybuffer',
            headers: {
                // 뽐뿌는 User-Agent와 Cookie를 체크하는 경우가 많습니다.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://www.ppomppu.co.kr/',
                'Cookie': 'PHPSESSID=access; visit_time=' + Date.now() // 가짜 세션 쿠키 추가
            }
        });
        
        // EUC-KR 디코딩
        const html = iconv.decode(response.data, 'EUC-KR').toString();
        const $ = cheerio.load(html);
        const dealList = [];
        const checkedIds = new Set(); // 중복 게시글 방지용

        // [전략 변경]
        // 특정 tr 클래스(list0, list1)에 의존하지 않고, 
        // 게시판 영역의 유효한 링크(view.php?id=ppomppu&no=...)를 가진 요소를 모두 찾습니다.
        // 이는 구조 변경이나 클래스 변경에 훨씬 강합니다.
        
        // 1. 게시글 링크가 포함된 a 태그들을 모두 찾음 (정규식 활용)
        const anchorTags = $('a[href*="view.php"]');

        anchorTags.each((index, element) => {
            const link = $(element).attr('href');
            
            // 2. 엄격한 링크 검증 (광고/공지/다른게시판 제외)
            // - id=ppomppu 파라미터 필수
            // - no= 숫자 파라미터 필수
            if (!link || !link.includes('id=ppomppu') || !link.includes('no=')) {
                return;
            }

            // URL에서 게시글 번호(no) 추출
            const noMatch = link.match(/no=(\d+)/);
            if (!noMatch) return;
            const originId = noMatch[1];

            // 이미 처리한 게시글이면 스킵 (썸네일 링크와 제목 링크가 중복될 수 있음)
            if (checkedIds.has(originId)) return;
            checkedIds.add(originId);

            // 3. 해당 링크가 속한 행(tr) 찾기
            // 링크의 부모 중 tr 태그를 찾아서 그 안의 데이터를 파싱합니다.
            const row = $(element).closest('tr');
            
            // 만약 tr을 못 찾거나, 광고용 tr(클래스가 다르거나 구조가 다름)인 경우 필터링
            // 일반 게시글은 보통 td가 4개 이상입니다.
            if (row.length === 0 || row.find('td').length < 3) return;

            // --- 데이터 추출 시작 ---

            // 제목 추출
            // .list_title 클래스가 있으면 베스트, 없으면 현재 a태그의 텍스트, 그것도 없으면 row 안의 텍스트
            let title = row.find('.list_title').text().trim();
            if (!title) {
                // 링크가 이미지일 수 있으므로, row 안에서 텍스트 링크를 다시 찾음
                title = row.find('td[align="left"] a').text().trim(); 
                if (!title) title = $(element).text().trim();
            }
            if (!title) return; // 제목 없으면 스킵

            // 제목 정제 (탭, 연속된 공백 제거)
            title = title.replace(/\s+/g, ' ').trim();

            // 썸네일 추출
            let imageUrl = row.find('img').attr('src');
            if (imageUrl) {
                if (imageUrl.includes('noimage')) {
                    imageUrl = null;
                } else if (imageUrl.startsWith('//')) {
                    imageUrl = 'https:' + imageUrl;
                } else if (!imageUrl.startsWith('http')) {
                    imageUrl = 'https://www.ppomppu.co.kr' + imageUrl;
                }
            }

            // 댓글 수 추출
            const commentCount = parseInt(row.find('.list_comment2').text().trim()) || 0;

            // 작성 시간 추출 (보통 4번째 td)
            // 뽐뿌 구조: 번호 | 분류 | 제목 | 이름 | 날짜 | 추천 | 조회
            const tds = row.find('td');
            let timeText = '';
            // td 개수에 따라 날짜 위치가 다를 수 있어 뒤에서 3번째 쯤을 찾거나 title 속성 확인
            tds.each((i, td) => {
                const titleAttr = $(td).attr('title');
                if (titleAttr && (titleAttr.includes('-') || titleAttr.includes(':'))) {
                    timeText = titleAttr; // title 속성에 정확한 시간이 있는 경우가 많음
                }
            });
            if (!timeText) {
                // 못 찾았으면 텍스트로 시도 (XX:XX or XX/XX)
                const dateRegex = /\d{2}[:\/]\d{2}/;
                row.find('td').each((i, td) => {
                    const txt = $(td).text().trim();
                    if (dateRegex.test(txt)) timeText = txt;
                });
            }

            // 가격 정보 추출 (제목 파싱)
            let priceText = '미확인';
            // 괄호 안에 있는 가격 정보 추출 시도
            const priceMatch = title.match(/\(([^)]*(원|달러|불|무료|배송|KRW|USD)[^)]*)\)/);
            if (priceMatch) {
                priceText = priceMatch[1].trim();
            }

            // 카테고리 추출
            let category = '기타';
            const catSmall = row.find('small.baseList-small'); // 신버전 스킨
            if (catSmall.length) {
                category = catSmall.text().trim();
            } else {
                // 구버전 스킨: [분류] 텍스트가 제목 앞에 있거나 td 안에 있음
                const catMatch = row.text().match(/\[([^\]]+)\]/);
                if (catMatch) category = catMatch[1];
            }
            // 카테고리 대괄호 제거
            category = category.replace(/[\[\]]/g, '').trim();

            // URL 정규화
            let fullUrl = link.trim();
            if (!fullUrl.startsWith('http')) {
                fullUrl = 'https://www.ppomppu.co.kr/zboard/' + fullUrl;
            }

            dealList.push({
                site: 'ppomppu',
                originId,
                title,
                price: priceText,
                url: fullUrl,
                imageUrl,
                postedAt: timeText || new Date().toISOString(),
                commentCount,
                category
            });
        });
        
        console.log(`✅ 뽐뿌 수집 성공: ${dealList.length}개`);
        
        // [디버깅] 실제 수집된 데이터 샘플을 출력하여 확인
        if (dealList.length > 0) {
            console.log('🔎 수집된 데이터 샘플 (첫 번째 항목):');
            console.log(JSON.stringify(dealList[0], null, 2));
        } else {
            console.log('⚠️ 수집된 데이터가 0개입니다. HTML 구조 확인 필요:', $.html().substring(0, 500));
        }

        return dealList;

    } catch (error) {
        console.error('❌ 뽐뿌 크롤링 실패:', error.message);
        if (error.code === 'ECONNRESET') console.error('  -> 연결이 끊겼습니다. 봇 차단 가능성이 있습니다.');
        return [];
    }
}