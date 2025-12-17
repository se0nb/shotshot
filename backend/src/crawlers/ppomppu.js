import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌(ppomppu) 크롤링 시작 (개선된 버전) ---');
    try {
        // 1. Axios로 HTML 데이터 가져오기 (binary 형태)
        const response = await axios.get('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu', {
            responseType: 'arraybuffer', // EUC-KR 디코딩을 위해 필수
            headers: {
                // 봇 차단 방지를 위한 일반 브라우저 User-Agent 설정
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // 2. EUC-KR -> UTF-8 변환
        const decoded = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(decoded);
        const list = [];

        // 3. 게시글 목록 순회
        // class가 list0 또는 list1인 행(tr)을 찾습니다.
        $('tr').each((i, el) => {
            try {
                const className = $(el).attr('class');
                // 유효한 게시글 행인지 확인 (공지사항 제외)
                if (!className || (!className.includes('list0') && !className.includes('list1'))) return;
                if (className.includes('notice')) return;

                // [핵심 수정] 제목 및 링크 추출 방식을 변경
                // 기존의 font 태그 의존성을 제거하고, href에 'view.php'가 포함된 a 태그를 직접 찾습니다.
                const titleAnchor = $(el).find('a[href*="view.php"]').first();
                if (!titleAnchor.length) return;

                let link = titleAnchor.attr('href');
                // 게시글 고유 번호(no=)가 없으면 광고나 잘못된 링크로 간주
                if (!link || !link.includes('no=')) return;
                
                // 링크 정규화
                link = `https://www.ppomppu.co.kr/zboard/${link}`;
                const originId = link.match(/no=(\d+)/)?.[1];
                if (!originId) return;

                // 제목 텍스트 추출
                let rawTitle = titleAnchor.text().trim();
                if (!rawTitle) return;

                // 이미지 추출 (썸네일이 있는 경우)
                let imageUrl = $(el).find('img.thumb_border').attr('src');
                if (imageUrl) {
                     if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                     else if (!imageUrl.startsWith('http')) imageUrl = 'https://www.ppomppu.co.kr' + imageUrl;
                }

                // 카테고리 추출 (보통 small 태그에 위치)
                let category = '기타';
                const smallTag = $(el).find('small');
                if (smallTag.length) {
                    category = smallTag.text().trim();
                }

                // 가격 추출 (제목 내 괄호 안의 숫자 패턴)
                // 예: "RTX 4070 (600,000원)" -> 600,000원
                let price = '가격정보 없음';
                const priceMatch = rawTitle.match(/\(([\d,]+)(원|KRW)?\)/);
                if (priceMatch) {
                    price = priceMatch[1] + (priceMatch[2] || '원');
                }

                // 댓글 수 추출
                const commentCountText = $(el).find('.list_comment2').text().trim();
                const commentCount = parseInt(commentCountText) || 0;

                // 작성 시간 추출 (뽐뿌는 td의 title 속성에 날짜 정보를 넣어둡니다)
                // 예: title="23.12.17 14:22:01"
                const dateTitle = $(el).find('td[title]').attr('title');
                let postedAt = new Date(); // 기본값: 현재 시간
                
                if (dateTitle) {
                    const parts = dateTitle.split(' ');
                    if (parts.length >= 2) {
                        const dateParts = parts[0].split('.'); // [YY, MM, DD]
                        const timeParts = parts[1].split(':'); // [HH, MM, SS]
                        
                        if (dateParts.length === 3 && timeParts.length === 3) {
                            const year = 2000 + parseInt(dateParts[0], 10);
                            const month = parseInt(dateParts[1], 10) - 1; 
                            const day = parseInt(dateParts[2], 10);
                            const hour = parseInt(timeParts[0], 10);
                            const minute = parseInt(timeParts[1], 10);
                            const second = parseInt(timeParts[2], 10);
                            
                            postedAt = new Date(year, month, day, hour, minute, second);
                        }
                    }
                }

                list.push({
                    site: 'ppomppu',
                    originId,
                    title: rawTitle,
                    price,
                    url: link,
                    imageUrl,
                    category,
                    commentCount,
                    postedAt: postedAt.toISOString()
                });

            } catch (e) {
                // 개별 행 파싱 에러는 전체 로직에 영향을 주지 않도록 무시
            }
        });

        console.log(`✅ 뽐뿌 수집 성공: ${list.length}건`);
        // 최신 20개만 반환하여 DB 부하 방지
        return list.slice(0, 20);

    } catch (e) {
        console.error('❌ 뽐뿌 크롤링 실패:', e.message);
        return [];
    }
}