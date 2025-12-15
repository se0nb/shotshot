import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
const BASE_DOMAIN = 'https://www.ppomppu.co.kr/zboard/';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌게시판(id=ppomppu) 크롤링 시작 ---');
    try {
        const response = await axios.get(PPOMPPU_URL, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://www.ppomppu.co.kr/'
            }
        });
        
        // EUC-KR 디코딩
        const html = iconv.decode(response.data, 'EUC-KR').toString();
        const $ = cheerio.load(html);
        const dealList = [];
        
        // 뽐뿌 리스트의 행들을 선택
        const rows = $('tr.baseList'); 

        rows.each((index, element) => {
            // 1. 공지사항(bbs_new1/2 클래스가 없는 상단 공지 등) 제외
            // 보통 뽐뿌 일반글은 'bbs_new1' 또는 'bbs_new2' 클래스를 가짐 (짝/홀수행)
            // 'notice' 클래스가 포함된 경우 확실히 제외
            if ($(element).hasClass('list_notice') || $(element).attr('class')?.includes('notice')) {
                return;
            }

            const titleAnchor = $(element).find('a.baseList-title'); 
            const link = titleAnchor.attr('href');

            if (link) {
                const title = titleAnchor.text().trim();

                // 2. 카테고리 추출 및 필터링 (핵심)
                // 보통 <small class="baseList-small">[분류]</small> 형태
                let category = $(element).find('small.baseList-small').text().trim();
                
                // 대괄호 제거 ([기타] -> 기타)
                category = category.replace(/[\[\]]/g, '');

                // 분류가 없는 경우 빈 문자열 처리
                if (!category) category = '';

                // 제외할 키워드 목록
                const excludeKeywords = ['쇼핑뽐뿌', '쇼핑포럼', '오프라인', '정보'];
                
                // 카테고리가 제외 목록에 포함되면 수집하지 않음
                if (excludeKeywords.some(keyword => category.includes(keyword))) {
                    // console.log(`  🚫 제외됨 (${category}): ${title.substring(0, 20)}...`); // 디버깅용 로그
                    return; 
                }

                // 3. 데이터 추출
                const commentCount = parseInt($(element).find('span.baseList-c').text().trim()) || 0;
                const fullTimestamp = $(element).find('time.baseList-time').parent().attr('title') || new Date().toISOString();
                
                let imageUrl = $(element).find('.baseList-thumb img').attr('src');
                if (imageUrl) {
                    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                }

                // 제목에서 가격 추출 (ex: (10,000원/무배))
                let priceText = '미확인';
                const priceMatch = title.match(/\(([^)]+원|무료배송|배송비|착불)(?:\/[^)]+)?\)/); 
                if (priceMatch) {
                    priceText = priceMatch[1].replace(/무료배송|배송비|착불/g, '').trim();
                }

                // 4. URL 정규화
                let fullUrl = link.trim();
                if (!fullUrl.startsWith('http')) {
                    if (fullUrl.startsWith('/')) {
                        fullUrl = 'https://www.ppomppu.co.kr' + fullUrl;
                    } else {
                        fullUrl = BASE_DOMAIN + fullUrl;
                    }
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
                        category: category || '뽐뿌게시판'
                    });
                }
            }
        });
        
        console.log(`✅ 뽐뿌 수집 완료: ${dealList.length}개 (타 게시판 글 제외됨)`);
        return dealList;

    } catch (error) {
        console.error('❌ 뽐뿌 크롤링 실패:', error.message);
        return [];
    }
}