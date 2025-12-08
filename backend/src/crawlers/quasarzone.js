import axios from 'axios';
import * as cheerio from 'cheerio';

const QUASAR_URL = 'https://quasarzone.com/bbs/qb_saleinfo';
const BASE_DOMAIN = 'https://quasarzone.com';

export async function quasarzoneCrawler() {
    console.log('--- 퀘이사존(Quasarzone) 크롤링 시작 ---');

    try {
        const response = await axios.get(QUASAR_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        });

        const $ = cheerio.load(response.data);
        const dealList = [];

        // 퀘이사존 리스트 항목 선택자
        const rows = $('.market-info-list-cont .market-info-list');

        rows.each((index, element) => {
            try {
                // 1. 종료 여부 확인 (label.done 이 있으면 종료된 딜)
                const isEnded = $(element).find('.label.done').length > 0;
                if (isEnded) return; // 종료된 딜은 수집 제외

                // 2. 제목 및 링크
                const titleAnchor = $(element).find('.tit > a.subject-link');
                let title = titleAnchor.text().trim();
                const link = titleAnchor.attr('href');

                // 제목 내 불필요한 태그 텍스트 제거 (블라인드 처리된 글 등)
                if (title.includes('블라인드 처리')) return;

                // 3. 가격 (text-orange 클래스)
                const priceText = $(element).find('.market-info-sub .price .text-orange').text().trim() || '가격 정보 없음';
                
                // 4. 카테고리 (category 클래스)
                const category = $(element).find('.category').text().trim();

                // 5. 댓글 수
                const commentCountText = $(element).find('.count').text().trim();
                const commentCount = parseInt(commentCountText) || 0;

                // 6. 작성 시간
                const timeText = $(element).find('.date').text().trim();
                // 퀘이사존 시간 포맷 처리 (필요시)

                const fullUrl = link.startsWith('http') ? link : BASE_DOMAIN + link;
                
                // 7. 원본 ID 추출 (URL의 마지막 숫자 세그먼트)
                const urlParts = fullUrl.split('/');
                const originId = urlParts[urlParts.length - 1];

                if (originId) {
                    dealList.push({
                        site: 'quasarzone',
                        originId: originId,
                        title: title,
                        price: priceText,
                        url: fullUrl,
                        postedAt: new Date().toISOString(),
                        commentCount: commentCount,
                        category: category,
                        crawledAt: new Date()
                    });
                }

            } catch (err) {
                // 개별 파싱 에러 무시
            }
        });

        console.log(`퀘이사존 수집 완료: ${dealList.length}개`);
        return dealList;

    } catch (error) {
        console.error('퀘이사존 크롤링 에러:', error.message);
        return [];
    }
}