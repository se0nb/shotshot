import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

export async function ppomppuCrawler() {
    console.log('--- 뽐뿌(ppomppu) 크롤링 시작 (Python 로직 이식 버전) ---');
    try {
        // 1. 데이터 요청 (바이너리 모드)
        const response = await axios.get('https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu', {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // 2. 인코딩 변환 (EUC-KR -> UTF-8)
        const decoded = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(decoded);
        const list = [];

        // 3. 파싱 로직 (Python 코드의 선택자 로직 적용)
        // Python: items = html.find_all("tr", ["common-list0", "common-list1"])
        // JS 대응: tr.common-list0, tr.common-list1 (혹시 몰라 예전 list0, list1도 포함)
        $('tr.common-list0, tr.common-list1, tr.list0, tr.list1').each((i, el) => {
            try {
                // 공지사항 제외 (혹시 모를 중복 방지)
                if ($(el).hasClass('list_notice')) return;

                // [핵심 1] 게시글 번호 (Python: item.find("td", "eng list_vspace").text)
                // 첫 번째 .eng.list_vspace 클래스를 가진 td가 번호임
                const itemNoTd = $(el).find('td.eng.list_vspace').first();
                const originId = itemNoTd.text().trim();
                
                // 번호가 없으면(공지 등) 스킵
                if (!originId || isNaN(originId)) return;

                // [핵심 2] 제목 (Python: item.find("font"))
                let titleElement = $(el).find('font').first();
                // font 태그가 없으면 a 태그 안의 텍스트로 대체 (블라인드 글 등 대비)
                if (!titleElement.length) {
                    titleElement = $(el).find('a[href*="view.php"]').first();
                }
                
                let rawTitle = titleElement.text().trim();
                if (!rawTitle) return;
                
                // 블라인드 글 제외
                if (rawTitle.includes('게시중단요청')) return;

                // [핵심 3] 링크 생성 (Python: f"...&no={item_no}")
                // 뽐뿌는 no 파라미터로 게시글 이동 가능
                const link = `https://www.ppomppu.co.kr/zboard/view.php?id=ppomppu&no=${originId}`;

                // [핵심 4] 댓글 수 (Python: item.find("span", "list_comment2"))
                const commentSpan = $(el).find('span.list_comment2');
                const commentCount = commentSpan.length ? parseInt(commentSpan.text().trim()) : 0;

                // [핵심 5] 등록일 (Python: item.find_all("td", "eng list_vspace")[1]["title"])
                // 두 번째 .eng.list_vspace 요소의 title 속성에 날짜가 있음
                const engListVspaceTds = $(el).find('td.eng.list_vspace');
                let postedAt = new Date();
                
                if (engListVspaceTds.length >= 2) {
                    const dateTitle = $(engListVspaceTds[1]).attr('title'); // "YY.MM.DD HH:MM:SS"
                    if (dateTitle) {
                        const parts = dateTitle.split(' ');
                        if (parts.length >= 2) {
                            const dateParts = parts[0].split('.'); // [YY, MM, DD]
                            const timeParts = parts[1].split(':'); // [HH, MM, SS]
                            if (dateParts.length === 3 && timeParts.length === 3) {
                                postedAt = new Date(
                                    2000 + parseInt(dateParts[0]), 
                                    parseInt(dateParts[1]) - 1, 
                                    parseInt(dateParts[2]), 
                                    parseInt(timeParts[0]), 
                                    parseInt(timeParts[1]), 
                                    parseInt(timeParts[2])
                                );
                            }
                        }
                    }
                }

                // [핵심 6] 카테고리 (Python: item.find("span", {"style": "color:#999;font-size:11px;"}))
                // Cheerio에서는 style 속성 매칭이 까다로우니 span 태그 중 텍스트가 있는 것을 찾거나,
                // 제목의 [카테고리] 패턴을 활용하는 것이 더 안전함
                let category = '기타';
                const catSpan = $(el).find('span[style*="color:#999"]'); // 부분 일치 시도
                if (catSpan.length) {
                    category = catSpan.text().trim();
                } else {
                    // Fallback: 제목 앞 [디지털] 등 추출
                    const catMatch = rawTitle.match(/^\[([^\]]+)\]/);
                    if (catMatch) category = catMatch[1];
                }

                // [추가] 이미지 (썸네일)
                let imageUrl = $(el).find('img.thumb_border').attr('src');
                if (imageUrl) {
                    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
                    else if (!imageUrl.startsWith('http')) imageUrl = 'https://www.ppomppu.co.kr' + imageUrl;
                }

                // [추가] 가격 (제목 괄호 안 숫자 추출)
                let price = '가격정보 없음';
                const priceMatch = rawTitle.match(/\(([\d,]+)(원|KRW|달러|USD)?\)/);
                if (priceMatch) {
                    price = priceMatch[1] + (priceMatch[2] || '원');
                }

                list.push({
                    site: 'ppomppu',
                    originId,
                    title: rawTitle,
                    price,
                    url: link,
                    imageUrl,
                    category,
                    commentCount,
                    postedAt: postedAt.toISOString()
                });

            } catch (e) {
                // 개별 행 파싱 실패 시 무시
            }
        });

        console.log(`✅ 뽐뿌 수집 성공: ${list.length}건`);
        return list.slice(0, 20); // 최신 20개만

    } catch (e) {
        console.error('❌ 뽐뿌 크롤링 실패:', e.message);
        return [];
    }
}