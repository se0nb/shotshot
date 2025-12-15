import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌게시판(id=ppomppu) 크롤링 시작 (Axios + Cheerio) ---');
    try {
        const response = await axios.get(PPOMPPU_URL, {
            responseType: 'arraybuffer', // 뽐뿌는 EUC-KR 인코딩이므로 버퍼로 받음
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                // 쿠키가 없으면 봇으로 간주되어 403 에러가 날 수 있음
                'Cookie': `visit_time=${Date.now()}; PHPSESSID=dummy_session_${Date.now()};` 
            }
        });

        // EUC-KR -> UTF-8 변환
        const html = iconv.decode(response.data, 'EUC-KR').toString();
        const $ = cheerio.load(html);
        const dealList = [];

        // Puppeteer 버전과 동일하게 정확한 게시글 행(list0, list1)만 타겟팅
        const rows = $('tr.list0, tr.list1');

        rows.each((i, el) => {
            try {
                const row = $(el);
                const tds = row.find('td');

                // 유효한 게시글 행인지 확인 (td 개수가 너무 적으면 광고나 공지일 수 있음)
                if (tds.length < 4) return;

                // --- 1. 링크 및 ID 추출 ---
                // 보통 3번째 td 안에 제목 링크가 있음
                const titleAnchor = row.find('td:nth-child(3) a[href*="view.php"]');
                if (!titleAnchor.length) return;

                let link = titleAnchor.attr('href');
                const noMatch = link.match(/no=(\d+)/);
                if (!noMatch) return; // 게시글 번호 없으면 스킵
                const originId = noMatch[1];

                if (!link.startsWith('http')) {
                    link = `https://www.ppomppu.co.kr/zboard/${link}`;
                }

                // --- 2. 이미지 추출 ---
                let imageUrl = null;
                const imgEl = row.find('img').first();
                if (imgEl.length) {
                    const src = imgEl.attr('src');
                    if (src && !src.includes('noimage')) {
                        if (src.startsWith('//')) imageUrl = 'https:' + src;
                        else if (src.startsWith('http')) imageUrl = src;
                        else imageUrl = 'https://www.ppomppu.co.kr' + src;
                    }
                }

                // --- 3. 제목 추출 ---
                let rawTitle = '';
                const listTitleEl = row.find('.list_title');
                if (listTitleEl.length) {
                    rawTitle = listTitleEl.text().trim();
                } else {
                    rawTitle = titleAnchor.text().trim();
                }

                // --- 4. 댓글 수 추출 ---
                let commentCount = 0;
                const commentEl = row.find('.list_comment2');
                if (commentEl.length) {
                    commentCount = parseInt(commentEl.text().trim()) || 0;
                }

                // --- 5. 카테고리 추출 ---
                let category = '기타';
                const smallTag = row.find('td:nth-child(3) small');
                if (smallTag.length) {
                    category = smallTag.text().trim();
                } else {
                    // 제목 앞 [분류] 패턴
                    const catMatch = rawTitle.match(/^\[([^\]]+)\]/);
                    if (catMatch) category = catMatch[1];
                }

                // --- 6. 가격 추출 ---
                let price = '미확인';
                // 제목 끝 (가격) 패턴
                const priceMatch = rawTitle.match(/\(([^)]+)\)$/);
                if (priceMatch) {
                    const content = priceMatch[1];
                    // 숫자가 포함되어 있으면 가격 정보로 간주
                    if (/\d/.test(content)) {
                        price = content;
                    }
                }

                // --- 7. 제목 정제 ---
                const cleanTitle = rawTitle.replace(/^\[[^\]]+\]/, '').trim();

                // --- 8. 작성 시간 추출 ---
                let postedAt = new Date().toISOString();
                // td의 title 속성에 전체 시간이 들어있는 경우가 많음
                tds.each((idx, td) => {
                    const titleAttr = $(td).attr('title');
                    if (titleAttr && (titleAttr.includes('.') || titleAttr.includes('-')) && titleAttr.includes(':')) {
                        postedAt = titleAttr;
                        return false; // loop break
                    }
                });

                dealList.push({
                    site: 'ppomppu',
                    originId,
                    title: cleanTitle || rawTitle,
                    price,
                    url: link,
                    imageUrl,
                    category,
                    commentCount,
                    postedAt
                });

            } catch (e) {
                // 개별 행 파싱 실패 시 무시
            }
        });

        console.log(`✅ 뽐뿌 수집 성공: ${dealList.length}개`);
        return dealList;

    } catch (error) {
        console.error('❌ 뽐뿌 크롤링 실패 (Axios):', error.message);
        if (error.response && error.response.status === 403) {
            console.error('⚠️ 봇 차단(403) 발생: 헤더나 쿠키 설정을 조정해야 할 수 있습니다.');
        }
        return [];
    }
}