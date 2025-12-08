import axios from 'axios';
import * as cheerio from 'cheerio';

const FMKOREA_URL = 'https://www.fmkorea.com/hotdeal';
const BASE_DOMAIN = 'https://www.fmkorea.com';

export async function fmkoreaCrawler() {
    console.log('--- 펨코(FMKorea) 크롤링 시작 (헤더 강화) ---');
    
    try {
        // 🚨 430 에러 해결을 위해 헤더 강화 및 Referer 추가
        const response = await axios.get(FMKOREA_URL, {
            headers: {
                // 더 현실적인 User-Agent 사용
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                // 이전 페이지가 있다는 것을 암시
                'Referer': 'https://www.google.com/', 
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'max-age=0'
            },
            timeout: 8000 // 타임아웃 8초로 설정
        });

        const $ = cheerio.load(response.data);
        const dealList = [];

        // 🚨 펨코 게시글 목록 선택자: .fm_best_widget .li (기존 유지)
        const rows = $('.fm_best_widget .li');

        if (rows.length === 0) {
            console.warn('펨코 경고: 목록 요소를 찾지 못했습니다. 선택자 또는 봇 차단이 원인일 수 있습니다.');
        }

        rows.each((index, element) => {
            try {
                const titleAnchor = $(element).find('.title a').first();
                if (!titleAnchor.length) return;

                const link = titleAnchor.attr('href');
                if (!link) return;

                let title = titleAnchor.text().trim();
                title = title.replace(/\[\d+\]$/, '').trim();

                const infoSpan = $(element).find('.hotdeal_info');
                const shop = infoSpan.find('a.strong').text().trim() || '기타';
                const price = infoSpan.find('span:last-child').text().trim() || '가격 정보 없음';

                const commentCountText = $(element).find('.comment_count').text().trim();
                const commentCount = parseInt(commentCountText.replace(/[\[\]]/g, '')) || 0;

                const fullUrl = link.startsWith('http') ? link : BASE_DOMAIN + link;
                
                const originIdMatch = fullUrl.match(/fmkorea\.com\/(\d+)/);
                const originId = originIdMatch ? originIdMatch[1] : null;

                const isEnded = $(element).find('.title a').css('text-decoration') === 'line-through';

                if (originId && !isEnded) {
                    dealList.push({
                        site: 'fmkorea',
                        originId: originId,
                        title: title,
                        price: price,
                        url: fullUrl,
                        postedAt: new Date().toISOString(),
                        commentCount: commentCount,
                        category: shop,
                        crawledAt: new Date()
                    });
                }
            } catch (err) {
                // 개별 항목 파싱 에러는 무시
            }
        });

        console.log(`펨코 수집 완료: ${dealList.length}개`);
        return dealList;

    } catch (error) {
        console.error('❌ 펨코 크롤링 에러:', error.message);
        return [];
    }
}