import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
const BASE_DOMAIN = 'https://www.ppomppu.co.kr/zboard/';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌게시판(id=ppomppu) 유저 게시글 크롤링 시작 ---');
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
        
        // [수정됨] 광고/핫딜 영역을 제외하고 순수 유저 게시글만 가져오기 위해
        // 'list0', 'list1' 클래스를 가진 행(tr)만 선택합니다.
        // (기존 'tr.baseList' 대신 뽐뿌 PC버전 표준 클래스 사용)
        const rows = $('tr.list0, tr.list1'); 

        rows.each((index, element) => {
            // 1. 제목 및 링크 추출 요소 찾기
            // 보통 .list_title 클래스 안에 있거나, 없을 경우 첫 번째 a태그
            let titleElement = $(element).find('.list_title');
            let titleAnchor = titleElement.closest('a');
            
            // .list_title로 못 찾은 경우 대비
            if (titleAnchor.length === 0) {
                titleAnchor = $(element).find('a').first();
            }

            const link = titleAnchor.attr('href');
            // 텍스트 추출 (font 태그가 있으면 그 안의 텍스트, 없으면 a 태그 텍스트)
            const title = titleElement.length > 0 ? titleElement.text().trim() : titleAnchor.text().trim();

            if (!link) return;

            // 2. [필터링 핵심] 광고, 공지사항, 다른 게시판 글 제외
            // - view.php 가 포함되어야 함 (게시글 상세)
            // - id=ppomppu 가 포함되어야 함 (현재 게시판 글인지 확인)
            // - no= 숫자가 포함되어야 함 (실제 게시글 번호 존재 확인)
            if (!link.includes('view.php') || !link.includes('id=ppomppu') || !link.includes('no=')) {
                return;
            }

            // 3. 썸네일 추출 (이미지가 있는 경우)
            let imageUrl = $(element).find('img').attr('src');
            if (imageUrl) {
                if (imageUrl.includes('noimage')) {
                    imageUrl = null; // 이미지가 없는 경우
                } else if (imageUrl.startsWith('//')) {
                    imageUrl = 'https:' + imageUrl;
                } else if (!imageUrl.startsWith('http')) {
                    imageUrl = 'https://www.ppomppu.co.kr' + imageUrl;
                }
            }

            // 4. 댓글 수 추출
            const commentCount = parseInt($(element).find('.list_comment2').text().trim()) || 0;

            // 5. 업로드 시간 추출 
            // 뽐뿌 PC버전 리스트의 4번째 td가 보통 등록일/시간
            const timeText = $(element).find('td').eq(3).text().trim() || '';

            // 6. 가격 정보 추출 (제목 파싱 - 괄호 안의 가격/배송 정보)
            // 예: [카테고리] 상품명 (가격/배송)
            let priceText = '미확인';
            const priceMatch = title.match(/\(([^)]*(원|달러|불|무료|배송|KRW|USD)[^)]*)\)/);
            if (priceMatch) {
                priceText = priceMatch[1].trim();
            }

            // 7. URL 정규화
            let fullUrl = link.trim();
            if (!fullUrl.startsWith('http')) {
                fullUrl = 'https://www.ppomppu.co.kr/zboard/' + fullUrl;
            }

            // 고유 ID 추출 (no 파라미터)
            const originId = new URLSearchParams(fullUrl.split('?')[1]).get('no');

            if (originId) {
                dealList.push({
                    site: 'ppomppu',
                    originId, 
                    title, 
                    price: priceText, 
                    url: fullUrl,
                    imageUrl,
                    postedAt: timeText, 
                    commentCount, 
                    category: '뽐뿌게시판' // id=ppomppu 게시판은 단일 카테고리로 취급하거나 제목 앞 [] 파싱 가능
                });
            }
        });
        
        console.log(`✅ 뽐뿌 수집 완료: ${dealList.length}개 (광고/공지 제외)`);
        return dealList;

    } catch (error) {
        console.error('❌ 뽐뿌 크롤링 실패:', error.message);
        return [];
    }
}