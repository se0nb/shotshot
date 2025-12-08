import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite'; // 한글 깨짐 방지

// 게시판 기본 URL
const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌 크롤링 시작 (URL 수정 버전) ---');
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
            if (!$(element).hasClass('bbs_new1') && !$(element).hasClass('bbs_new2')) return;

            const titleAnchor = $(element).find('a.baseList-title'); 
            const link = titleAnchor.attr('href');

            if (link) {
                // 불필요한 카테고리 필터링
                const category = $(element).find('small.baseList-small').text().replace(/[\[\]]/g, '').trim() || '기타';
                if (category.includes('쇼핑뽐뿌') || category.includes('쇼핑포럼')) return;

                const title = titleAnchor.text().trim();
                const commentCount = parseInt($(element).find('span.baseList-c').text().trim()) || 0;
                const fullTimestamp = $(element).find('time.baseList-time').parent().attr('title') || new Date().toISOString();
                
                // 이미지 추출
                let imageUrl = $(element).find('.baseList-thumb img').attr('src');
                if (imageUrl) {
                    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                }

                // 가격 추출
                let priceText = '미확인';
                const priceMatch = title.match(/\(([^)]+원|무료배송|배송비|착불)(?:\/[^)]+)?\)/); 
                if (priceMatch) priceText = priceMatch[1].replace(/무료배송|배송비|착불/g, '').trim();

                // 🚨 https://www.youtube.com/watch?v=J46hw_woLkA
                // 뽐뿌 링크가 상대경로인지 절대경로인지 확인하여 정확한 URL 생성
                let fullUrl = link.trim();
                if (fullUrl.startsWith('http')) {
                    // 이미 완전한 URL인 경우 그대로 사용
                } else if (fullUrl.startsWith('/')) {
                    // 루트 상대 경로인 경우 (/zboard/view.php...)
                    fullUrl = 'https://www.ppomppu.co.kr' + fullUrl;
                } else {
                    // 현재 경로 기준 상대 경로인 경우 (view.php...)
                    fullUrl = 'https://www.ppomppu.co.kr/zboard/' + fullUrl;
                }

                const originId = new URLSearchParams(fullUrl.split('?')[1]).get('no');

                if (originId) {
                    dealList.push({
                        site: 'ppomppu',
                        originId, 
                        title, 
                        price: priceText, 
                        url: fullUrl,
                        imageUrl,
                        postedAt: fullTimestamp, 
                        commentCount, 
                        category
                    });
                }
            }
        });
        
        console.log(`뽐뿌 수집 완료: ${dealList.length}개`);
        return dealList;
    } catch (error) {
        console.error('뽐뿌 크롤링 실패:', error.message);
        return [];
    }
}