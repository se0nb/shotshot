import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌 크롤링 시작 (Axios + Cheerio) ---');
    try {
        const response = await axios.get('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu', {
            responseType: 'arraybuffer', // EUC-KR 디코딩을 위해 바이너리로 받음
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // EUC-KR -> UTF-8 변환
        const decoded = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(decoded);
        const list = [];

        // 뽐뿌 리스트 셀렉터
        $('tr.list0, tr.list1').each((i, el) => {
            try {
                // 공지사항 제외
                if ($(el).hasClass('list_notice')) return;

                const titleAnchor = $(el).find('font.list_title').parent('a');
                if (!titleAnchor.length) return;

                let link = titleAnchor.attr('href');
                if (!link) return;
                
                // 링크 정규화
                link = `https://www.ppomppu.co.kr/zboard/${link}`;
                const originId = link.match(/no=(\d+)/)?.[1];
                if (!originId) return;

                const rawTitle = titleAnchor.text().trim();
                const title = rawTitle.replace(/^(?:\[.*?\]\s*)?/, '').trim(); // 앞쪽 대괄호 카테고리 제거 시도

                // 이미지 (썸네일이 있다면)
                let imageUrl = $(el).find('img.thumb_border').attr('src');
                if (imageUrl) {
                     if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                     else if (!imageUrl.startsWith('http')) imageUrl = 'https://www.ppomppu.co.kr' + imageUrl;
                }

                // 분류
                let category = $(el).find('td:nth-child(3) small').text().trim() || '기타';

                // 가격 (뽐뿌는 제목에 괄호로 가격 적는 경우가 많음, 정규식으로 추출 시도)
                let price = '가격정보 없음';
                // 예: "상품명 (10,000원/무료)" -> 10,000원 추출
                const priceMatch = rawTitle.match(/\(([^)]+원.*?)\)/) || rawTitle.match(/\(([\d,]+)\)/);
                if (priceMatch) price = priceMatch[1];

                // 댓글 수
                const commentCountText = $(el).find('.list_comment2').text().trim();
                const commentCount = parseInt(commentCountText) || 0;

                // 작성 시간
                const postedAtStr = $(el).find('td[title]').attr('title') || new Date().toISOString();
                // 뽐뿌 날짜 형식(YY.MM.DD HH:MM:SS)을 표준 Date로 변환 시도
                let postedAt = new Date();
                if (postedAtStr.includes('.')) {
                    // "23.12.17 11:00:00" -> "2023-12-17T11:00:00"
                    const parts = postedAtStr.split(' ');
                    const dateParts = parts[0].split('.');
                    const timeParts = parts[1] ? parts[1].split(':') : [0,0,0];
                    postedAt = new Date(2000 + parseInt(dateParts[0]), parseInt(dateParts[1])-1, parseInt(dateParts[2]), parseInt(timeParts[0]), parseInt(timeParts[1]));
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
                // 개별 파싱 에러는 무시
            }
        });

        console.log(`✅ 뽐뿌 수집 완료: ${list.length}건`);
        return list.slice(0, 20); // 최신 20개만 리턴

    } catch (e) {
        console.error('❌ 뽐뿌 크롤링 실패:', e.message);
        return [];
    }
}