import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

// 🚨 요청하신 '뽐뿌게시판' URL입니다.
const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
const BASE_DOMAIN = 'https://www.ppomppu.co.kr/zboard/';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌게시판 크롤링 시작 ---');
    try {
        const response = await axios.get(PPOMPPU_URL, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const html = iconv.decode(response.data, 'EUC-KR').toString();
        const $ = cheerio.load(html);
        const dealList = [];
        
        $('tr.baseList').each((index, element) => {
            // 공지사항 제외
            if (!$(element).hasClass('bbs_new1') && !$(element).hasClass('bbs_new2')) return;

            const titleAnchor = $(element).find('a.baseList-title'); 
            const link = titleAnchor.attr('href');

            if (link) {
                // 불필요한 카테고리 제외
                const category = $(element).find('small.baseList-small').text().replace(/[\[\]]/g, '').trim() || '기타';
                if (category.includes('쇼핑뽐뿌') || category.includes('쇼핑포럼')) return;

                const title = titleAnchor.text().trim();
                const commentCount = parseInt($(element).find('span.baseList-c').text().trim()) || 0;
                const fullTimestamp = $(element).find('time.baseList-time').parent().attr('title') || new Date().toISOString();
                
                let imageUrl = $(element).find('.baseList-thumb img').attr('src');
                if (imageUrl) {
                    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                }

                let priceText = '미확인';
                const priceMatch = title.match(/\(([^)]+원|무료배송|배송비|착불)(?:\/[^)]+)?\)/); 
                if (priceMatch) priceText = priceMatch[1].replace(/무료배송|배송비|착불/g, '').trim();

                // URL 생성 로직
                let fullUrl = link.trim();
                if (!fullUrl.startsWith('http')) {
                    fullUrl = fullUrl.startsWith('/') ? 
                        `https://www.ppomppu.co.kr${fullUrl}` : 
                        `${BASE_DOMAIN}${fullUrl}`;
                }

                const originId = new URLSearchParams(fullUrl.split('?')[1]).get('no');

                if (originId) {
                    dealList.push({
                        site: 'ppomppu',
                        originId, title, price: priceText, url: fullUrl,
                        imageUrl, postedAt: fullTimestamp, commentCount, category
                    });
                }
            }
        });
        return dealList;
    } catch (error) {
        console.error('뽐뿌 크롤링 실패:', error.message);
        return [];
    }
}