import puppeteer from 'puppeteer';
import UserAgent from 'user-agents';

const FMKOREA_URL = 'https://www.fmkorea.com/hotdeal';

export async function fmkoreaCrawler() {
    console.log('--- 펨코 크롤링 시작 (이미지 포함) ---');
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent(new UserAgent().toString());
        await page.goto(FMKOREA_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        const deals = await page.evaluate(() => {
            const list = [];
            document.querySelectorAll('.fm_best_widget .li').forEach(el => {
                try {
                    const titleEl = el.querySelector('.title a');
                    if (!titleEl) return;
                    
                    const rawTitle = titleEl.textContent.trim();
                    if (rawTitle.includes('종료')) return;

                    const title = rawTitle.replace(/\[\d+\]$/, '').trim();
                    const link = titleEl.getAttribute('href');
                    const fullUrl = link.startsWith('http') ? link : `https://www.fmkorea.com${link}`;
                    const originId = fullUrl.match(/fmkorea\.com\/(\d+)/)?.[1];

                    // 🚨 이미지 추출 로직 추가
                    let imageUrl = el.querySelector('img.thumb')?.getAttribute('src');
                    if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

                    const price = el.querySelector('.hotdeal_info span:last-child')?.textContent.trim() || '미확인';
                    const category = el.querySelector('.hotdeal_info a.strong')?.textContent.trim() || '기타';
                    const commentCount = parseInt(el.querySelector('.comment_count')?.textContent.replace(/[\[\]]/g, '')) || 0;
                    
                    if (originId) {
                        list.push({
                            site: 'fmkorea',
                            originId, title, price, url: fullUrl,
                            imageUrl, // 저장
                            category, commentCount,
                            postedAt: new Date().toISOString()
                        });
                    }
                } catch (e) {}
            });
            return list;
        });
        return deals;
    } catch (error) { return []; } finally { await browser.close(); }
}