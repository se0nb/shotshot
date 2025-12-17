import axios from 'axios';
import * as cheerio from 'cheerio';

export async function quasarzoneCrawler() {
    console.log('--- 퀘이사존 크롤링 시작 (이미지 추출 개선) ---');
    try {
        const response = await axios.get('https://quasarzone.com/bbs/qb_saleinfo', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const list = [];

        $('.market-info-list-cont').each((i, el) => {
            try {
                // 종료된 딜 필터링 (.label-done 클래스가 있으면 종료된 것)
                if ($(el).find('.label-done').length > 0) return;

                const titleEl = $(el).find('.tit a');
                const rawTitle = titleEl.find('.ellipsis-with-reply-cnt').text().trim();
                
                // 블라인드 글 또는 제목 없는 경우 제외
                if (!rawTitle || rawTitle.includes('블라인드')) return;

                let link = titleEl.attr('href');
                if (link && !link.startsWith('http')) link = `https://quasarzone.com${link}`;
                
                const originId = link.split('/').pop();
                const title = rawTitle;

                const price = $(el).find('.market-info-sub .text-orange').text().trim() || '가격 정보 없음';
                const category = $(el).find('.category').text().trim() || 'PC/하드웨어';
                
                // [이미지 추출 로직 개선]
                // .thumb-wrap 내부의 img 태그 찾기
                const thumbImg = $(el).find('.thumb-wrap img');
                let imageUrl = null;

                if (thumbImg.length) {
                    // 1. src 속성 가져오기
                    imageUrl = thumbImg.attr('src');
                    
                    // 2. 만약 src가 없고 data-src가 있다면(Lazy Loading) 그것을 사용
                    if (!imageUrl) {
                        imageUrl = thumbImg.attr('data-src');
                    }
                }

                // 이미지 URL 정규화 (상대 경로 -> 절대 경로)
                if (imageUrl) {
                    if (imageUrl.startsWith('//')) {
                        imageUrl = 'https:' + imageUrl;
                    } else if (!imageUrl.startsWith('http')) {
                        // 예: /data/editor/... -> https://quasarzone.com/data/editor/...
                        imageUrl = `https://quasarzone.com${imageUrl}`;
                    }
                }

                // 댓글 수
                const commentCountText = $(el).find('.count').text().replace(/,/g, '');
                const commentCount = parseInt(commentCountText) || 0;

                // 작성일 파싱
                // 퀘이사존: 14:22 (오늘), 2023.12.17 (과거)
                const dateText = $(el).find('.date').text().trim();
                let postedAt = new Date();

                if (dateText.includes(':')) {
                    // 오늘 작성된 글 (시간만 표시됨) -> 오늘 날짜에 시간 설정
                    const [hour, min] = dateText.split(':');
                    postedAt.setHours(parseInt(hour), parseInt(min), 0, 0);
                } else if (dateText.includes('.')) {
                    // 과거 작성된 글 (YYYY.MM.DD)
                    const parts = dateText.split('.'); // [YYYY, MM, DD]
                    if (parts.length === 3) {
                        postedAt = new Date(
                            parseInt(parts[0]), 
                            parseInt(parts[1]) - 1, 
                            parseInt(parts[2])
                        );
                    }
                }

                list.push({
                    site: 'quasarzone',
                    originId,
                    title,
                    price,
                    url: link,
                    imageUrl, // 추출한 이미지 URL (없으면 null)
                    category,
                    commentCount,
                    postedAt: postedAt.toISOString()
                });

            } catch (e) {
                // 개별 아이템 파싱 에러 무시
            }
        });

        console.log(`✅ 퀘이사존 수집 완료: ${list.length}건`);
        return list;

    } catch (e) {
        console.error('❌ 퀘이사존 크롤링 실패:', e.message);
        return [];
    }
}