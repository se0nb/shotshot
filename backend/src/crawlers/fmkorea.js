import axios from 'axios';
import * as cheerio from 'cheerio';

// 펨코 핫딜 게시판 URL
const FMKOREA_URL = 'https://www.fmkorea.com/hotdeal';
const BASE_DOMAIN = 'https://www.fmkorea.com';

export async function fmkoreaCrawler() {
    console.log('--- 펨코(FMKorea) 크롤링 시작 ---');
    
    try {
        const response = await axios.get(FMKOREA_URL, {
            headers: {
                // 펨코는 봇 차단이 심하므로 일반 브라우저처럼 위장하는 헤더가 필수입니다.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
            timeout: 5000 // 5초 타임아웃
        });

        const $ = cheerio.load(response.data);
        const dealList = [];

        // 펨코 핫딜 리스트의 일반적인 선택자 (fm_best_widget 또는 게시판 리스트)
        // 모바일/PC 뷰에 따라 다를 수 있으나, 보통 .li 클래스로 항목이 나뉩니다.
        const rows = $('.fm_best_widget .li');

        rows.each((index, element) => {
            try {
                const titleAnchor = $(element).find('.title a').first();
                // 상단 고정 공지 등은 건너뛰기 위해 링크 검사
                if (!titleAnchor.length) return;

                const link = titleAnchor.attr('href');
                // 링크가 없거나, 광고/공지인 경우 건너뜁니다.
                if (!link || !link.includes('fmkorea.com')) {
                     // 상대 경로인 경우 도메인 붙이기 (/hotdeal/...)
                     if (link && link.startsWith('/')) {
                        // pass (아래에서 처리)
                     } else if (!link) {
                         return;
                     }
                }

                // 1. 제목 (댓글 수 제거 및 공백 정리)
                let title = titleAnchor.text().trim();
                // 제목 뒤에 붙는 [댓글수] 제거 로직 (예: "특가상품 [10]")
                title = title.replace(/\[\d+\]$/, '').trim();

                // 2. 가격 및 쇼핑몰 정보 추출
                // .hotdeal_info 클래스 안에 [쇼핑몰] [가격] 순으로 들어있는 경우가 많습니다.
                const infoSpan = $(element).find('.hotdeal_info');
                const shop = infoSpan.find('a.strong').text().trim() || '기타';
                const price = infoSpan.find('span:last-child').text().trim() || '가격 정보 없음';

                // 3. 댓글 수
                const commentCountText = $(element).find('.comment_count').text().trim();
                const commentCount = parseInt(commentCountText.replace(/[\[\]]/g, '')) || 0;

                // 4. 작성 시간 (regdate 클래스)
                const timeText = $(element).find('.regdate').text().trim();
                // 펨코 시간은 '12:30' 또는 '2024.05.20' 등으로 나옵니다.
                // 정확한 파싱보다는 문자열 그대로 저장하거나 현재 시간으로 대체합니다.
                
                const fullUrl = link.startsWith('http') ? link : BASE_DOMAIN + link;
                
                // 5. 원본 ID 추출
                // URL 패턴: https://www.fmkorea.com/12345678
                // 끝자리 숫자만 추출
                const originIdMatch = fullUrl.match(/fmkorea\.com\/(\d+)/);
                const originId = originIdMatch ? originIdMatch[1] : null;

                // 종료된 핫딜 필터링 (선택 사항: 제목에 취소선이 있거나 '종료' 텍스트가 있는 경우)
                const isEnded = $(element).find('.title a').css('text-decoration') === 'line-through';

                if (originId && !isEnded) {
                    dealList.push({
                        site: 'fmkorea',
                        originId: originId,
                        title: title,
                        price: price,
                        url: fullUrl,
                        postedAt: new Date().toISOString(), // 시간 파싱이 복잡하므로 수집 시간으로 대체
                        commentCount: commentCount,
                        category: shop, // 펨코는 카테고리 대신 쇼핑몰 이름을 주로 사용
                        crawledAt: new Date()
                    });
                }
            } catch (err) {
                // 개별 항목 파싱 에러는 무시하고 계속 진행
            }
        });

        console.log(`펨코 수집 완료: ${dealList.length}개`);
        return dealList;

    } catch (error) {
        console.error('펨코 크롤링 에러:', error.message);
        return [];
    }
}