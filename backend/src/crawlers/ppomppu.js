import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
const BASE_DOMAIN = 'https://www.ppomppu.co.kr/zboard/';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌 크롤링 시작 (v4 iconv-lite 적용) ---');
    
    try {
        const response = await axios.get(PPOMPPU_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q;q=0.7'
            },
            // 🚨 핵심: 응답을 'arraybuffer'로 받으면 인코딩 변환이 가능합니다.
            responseType: 'arraybuffer' 
        });

        // 🚨 핵심: EUC-KR로 디코딩 후 UTF-8로 변환하여 한글 깨짐을 방지합니다.
        const decodedHtml = iconv.decode(response.data, 'EUC-KR').toString();

        const $ = cheerio.load(decodedHtml);
        const dealList = [];
        
        // ... (이하 나머지 로직은 v3와 동일합니다. rows, titleAnchor 등)
        
        const rows = $('tr.baseList'); 

        if (rows.length === 0) {
            console.log('경고: 게시글 목록을 찾지 못했습니다. TR 선택자를 확인하세요.');
        }
        
        // ... (나머지 rows.each 로직은 V3와 동일하게 사용하시면 됩니다.)
        // v4는 인코딩 변환 부분만 다릅니다.

        // [이하 rows.each 구현부...]
        rows.each((index, element) => {
            if (!$(element).hasClass('bbs_new1') && !$(element).hasClass('bbs_new2')) {
                return;
            }

            const titleAnchor = $(element).find('a.baseList-title'); 
            const link = titleAnchor.attr('href');

            if (link) {
                const title = titleAnchor.text().trim().replace(/\s{2,}/g, ' '); 
                const commentCountText = $(element).find('span.baseList-c').text().trim();
                const commentCount = parseInt(commentCountText) || 0;
                const fullTimestamp = $(element).find('time.baseList-time').parent().attr('title') || new Date().toISOString();
                const category = $(element).find('small.baseList-small').text().replace(/[\[\]]/g, '').trim() || '기타';

                let priceText = '미확인';
                const priceMatch = title.match(/\(([^)]+원|무료배송|배송비|착불)(?:\/[^)]+)?\)/); 
                if (priceMatch && priceMatch[1]) {
                    priceText = priceMatch[1].replace(/무료배송|배송비|착불/g, '').trim();
                }

                const fullUrl = link.startsWith('http') ? link : BASE_DOMAIN + link;
                const urlParams = new URLSearchParams(fullUrl.split('?')[1]);
                const originId = urlParams.get('no') || null;

                dealList.push({
                    site: 'ppomppu',
                    originId: originId,
                    title: title,
                    price: priceText,
                    url: fullUrl,
                    postedAt: fullTimestamp, 
                    commentCount: commentCount,
                    category: category,
                });
            }
        });

        console.log(`성공적으로 ${dealList.length}개의 핫딜 정보를 수집했습니다.`);
        return dealList.filter(deal => deal.title && deal.originId);

    } catch (error) {
        console.error('뽐뿌 크롤링 중 오류 발생:', error.message);
        return [];
    } finally {
        console.log('--- 뽐뿌 크롤링 종료 ---');
    }
}