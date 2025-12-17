import axios from 'axios';
import * as cheerio from 'cheerio';

export async function fmkoreaCrawler() {
    console.log('--- 펨코 크롤링 시작 (Axios + Cheerio) ---');
    try {
        const response = await axios.get('https://www.fmkorea.com/hotdeal', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.fmkorea.com/'
            }
        });

        const $ = cheerio.load(response.data);
        const list = [];

        // 펨코 핫딜 리스트 (일반 리스트 .fm_best_widget은 갯수가 적어서 메인 리스트 사용)
        $('.fm_best_widget._bd_pc > ul > li').each((i, el) => {
            try {
                const titleEl = $(el).find('.title a');
                if (!titleEl.length) return;

                const rawTitle = titleEl.text().trim();
                // 종료된 딜 필터링
                if (rawTitle.includes('종료')) return;

                // 제목에서 [댓글수] 제거 및 정제
                const title = rawTitle.replace(/\[\d+\]$/, '').trim();

                let link = titleEl.attr('href');
                if (link && !link.startsWith('http')) link = `https://www.fmkorea.com${link}`;
                
                const originId = link.match(/document_srl=(\d+)/)?.[1] || link.split('/').pop();

                // 가격
                const price = $(el).find('.hotdeal_info span:nth-child(2)').text().trim() || '가격 정보 없음';
                
                // 카테고리
                const category = $(el).find('.category a').text().trim() || $(el).find('.hotdeal_info .strong').text().trim() || '기타';

                // 이미지
                let imageUrl = $(el).find('img.thumb').attr('src');
                if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

                // 댓글 수
                const commentCountText = $(el).find('.comment_count').text().replace(/[\[\]]/g, '');
                const commentCount = parseInt(commentCountText) || 0;

                // 작성일 (펨코는 목록에 시간이 "00:00" 형태면 오늘, 날짜면 과거)
                const dateText = $(el).find('.regdate').text().trim(); 
                let postedAt = new Date();
                // 날짜 파싱 로직은 복잡할 수 있어, 현재 시간으로 대체하거나 상세 페이지를 들어가야 함.
                // 일단 수집 시점(현재)으로 저장
                
                list.push({
                    site: 'fmkorea',
                    originId,
                    title,
                    price,
                    url: link,
                    imageUrl,
                    category,
                    commentCount,
                    postedAt: postedAt.toISOString()
                });
            } catch (e) {}
        });

        console.log(`✅ 펨코 수집 완료: ${list.length}건`);
        return list;

    } catch (e) {
        console.error('❌ 펨코 크롤링 실패:', e.message);
        return [];
    }
}