import axios from 'axios';
import * as cheerio from 'cheerio';

export async function quasarzoneCrawler() {
    console.log('--- 퀘이사존 크롤링 시작 (Axios + Cheerio) ---');
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
                // 종료된 딜 필터링
                if ($(el).find('.label-done').length > 0) return;

                const titleEl = $(el).find('.tit a');
                const rawTitle = titleEl.find('.ellipsis-with-reply-cnt').text().trim();
                
                // 블라인드 처리된 글 제외
                if (rawTitle.includes('블라인드')) return;
                
                const title = rawTitle; // 퀘존은 제목 태그 분리가 잘 되어 있음

                let link = titleEl.attr('href');
                if (link && !link.startsWith('http')) link = `https://quasarzone.com${link}`;
                const originId = link.split('/').pop();

                const price = $(el).find('.market-info-sub .text-orange').text().trim() || '미확인';
                const category = $(el).find('.category').text().trim() || 'PC/하드웨어';
                
                // 이미지
                let imageUrl = $(el).find('.thumb-wrap img').attr('src');
                if (imageUrl && !imageUrl.startsWith('http')) imageUrl = `https://quasarzone.com${imageUrl}`;

                // 댓글 수
                const commentCount = parseInt($(el).find('.count').text().replace(/,/g, '')) || 0;

                // 작성일
                const dateText = $(el).find('.date').text().trim();
                // 퀘존 날짜 형식 처리 필요 (예: 14:00, 2023.12.17)
                let postedAt = new Date(); // 일단 현재 시간

                list.push({
                    site: 'quasarzone',
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

        console.log(`✅ 퀘이사존 수집 완료: ${list.length}건`);
        return list;

    } catch (e) {
        console.error('❌ 퀘이사존 크롤링 실패:', e.message);
        return [];
    }
}