import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌(ppomppu) 크롤링 시작 (Axios + Cheerio) ---');
    try {
        // 1. Axios로 HTML 데이터 가져오기 (binary 형태)
        const response = await axios.get('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu', {
            responseType: 'arraybuffer', // EUC-KR 디코딩을 위해 필수
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // 2. EUC-KR -> UTF-8 변환
        const decoded = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(decoded);
        const list = [];

        // 3. 게시글 목록 순회
        // 뽐뿌 게시판 구조: tr 태그에 class가 list0 또는 list1
        $('tr.list0, tr.list1').each((i, el) => {
            try {
                // 공지사항(list_notice) 제외
                if ($(el).hasClass('list_notice')) return;

                // 제목 및 링크 추출
                const titleAnchor = $(el).find('font.list_title').parent('a');
                if (!titleAnchor.length) return;

                let link = titleAnchor.attr('href');
                if (!link) return;
                
                // 링크 정규화 (/zboard/view.php... -> https://www.ppomppu.co.kr/zboard/view.php...)
                link = `https://www.ppomppu.co.kr/zboard/${link}`;
                
                // 고유 ID 추출 (no= 숫자)
                const originId = link.match(/no=(\d+)/)?.[1];
                if (!originId) return;

                // 제목 정제
                let rawTitle = titleAnchor.text().trim();
                // 뽐뿌는 제목에 [카테고리]가 붙어있는 경우가 많음 (예: [디지털] ...)
                const title = rawTitle; 

                // 이미지 추출
                let imageUrl = $(el).find('img.thumb_border').attr('src');
                if (imageUrl) {
                     if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                     else if (!imageUrl.startsWith('http')) imageUrl = 'https://www.ppomppu.co.kr' + imageUrl;
                }

                // 카테고리 (보통 작은 태그로 3번째 td에 있음)
                let category = $(el).find('td:nth-child(3) small').text().trim();
                if (!category) category = '기타';

                // 가격 추출 (제목 뒤에 괄호로 가격이 있는 패턴 시도)
                // 예: "RTX 4070 특가 (600,000원/무료)" -> 600,000원
                let price = '가격정보 없음';
                const priceMatch = rawTitle.match(/\(([\d,]+)(원|달러|KRW|USD)?/);
                if (priceMatch) {
                    price = priceMatch[1] + (priceMatch[2] || '');
                }

                // 댓글 수
                const commentCountText = $(el).find('.list_comment2').text().trim();
                const commentCount = parseInt(commentCountText) || 0;

                // 작성 시간 추출 (title 속성에 전체 날짜가 있음)
                // 예: title="23.12.17 14:22:01"
                const dateTitle = $(el).find('td[title]').attr('title');
                let postedAt = new Date();
                
                if (dateTitle) {
                    // 날짜 형식이 YY.MM.DD HH:MM:SS 인 경우 처리
                    // 단순하게 파싱하거나, 현재 시간 기준으로 처리
                    // 뽐뿌는 "14:22:01" 처럼 시간만 나오면 오늘, "23.12.17"이면 과거
                    if (dateTitle.includes(':') && dateTitle.includes('.')) {
                        // "23.12.17 14:22:01" -> "2023-12-17T14:22:01"
                        const [datePart, timePart] = dateTitle.split(' ');
                        const [yy, mm, dd] = datePart.split('.');
                        const [hour, min, sec] = timePart.split(':');
                        postedAt = new Date(2000 + parseInt(yy), parseInt(mm) - 1, parseInt(dd), parseInt(hour), parseInt(min), parseInt(sec));
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
                    postedAt: postedAt.toISOString()
                });

            } catch (e) {
                // 개별 행 파싱 에러는 전체 로직에 영향 주지 않음
            }
        });

        console.log(`✅ 뽐뿌 수집 성공: ${list.length}건`);
        // 최신 15개만 반환 (너무 많이 가져오면 DB 부하)
        return list.slice(0, 15);

    } catch (e) {
        console.error('❌ 뽐뿌 크롤링 실패:', e.message);
        return [];
    }
}