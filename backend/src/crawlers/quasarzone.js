import axios from 'axios';
import * as cheerio from 'cheerio';

const QUASAR_URL = 'https://quasarzone.com/bbs/qb_saleinfo';
const BASE_DOMAIN = 'https://quasarzone.com';

export async function quasarzoneCrawler() {
    console.log('--- 퀘이사존(Quasarzone) 크롤링 시작 (선택자 수정) ---');

    try {
        const response = await axios.get(QUASAR_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        });

        const $ = cheerio.load(response.data);
        const dealList = [];

        // 🚨 선택자 수정: 일반적인 게시판 목록 행(.list-row)을 찾도록 변경합니다.
        const rows = $('.list-row'); 

        if (rows.length === 0) {
            console.warn('퀘이사존 경고: 목록 요소를 찾지 못했습니다. 선택자(.list-row)를 확인하세요.');
        }


        rows.each((index, element) => {
            try {
                // 1. 종료 여부 확인 (.label.done)
                const isEnded = $(element).find('.label.done').length > 0;
                if (isEnded) return;

                // 2. 제목 및 링크
                const titleAnchor = $(element).find('.subject a.subject-link');
                let title = titleAnchor.text().trim();
                const link = titleAnchor.attr('href');

                if (!link || title.includes('블라인드 처리')) return;

                // 3. 가격 (.text-orange 클래스를 가진 요소)
                const priceText = $(element).find('.market-info-sub .price .text-orange').text().trim() || '가격 정보 없음';
                
                // 4. 카테고리
                const category = $(element).find('.category').text().trim();

                // 5. 댓글 수
                const commentCountText = $(element).find('.subject-link .count').text().trim();
                const commentCount = parseInt(commentCountText) || 0;

                // 6. 작성 시간은 HTML 구조상 복잡하여 임시로 수집 시간 사용

                const fullUrl = link.startsWith('http') ? link : BASE_DOMAIN + link;
                
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
        console.error('❌ 퀘이사존 크롤링 에러:', error.message);
        return [];
    }
}