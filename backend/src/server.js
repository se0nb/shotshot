import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import admin from 'firebase-admin';
import { connectDB } from './config/db.js';
import { Deal } from './models/Deal.js';
import { User } from './models/User.js';
import { Keyword } from './models/Keyword.js';
import { matchAndNotify } from './services/NotificationService.js';
import { ppomppuCrawler } from './crawlers/ppomppu.js';
import { fmkoreaCrawler } from './crawlers/fmkorea.js';
import { quasarzoneCrawler } from './crawlers/quasarzone.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Firebase 설정
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
const databaseUrl = process.env.FIREBASE_DB_URL;

if (serviceAccountJson) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
            databaseURL: databaseUrl
        });
        console.log('✅ Firebase Admin 초기화 완료');
    } catch (e) { console.error('Firebase 오류:', e.message); }
}

app.use(cors());
app.use(express.json());

// 🧹 [추가 기능] 48시간 지난 데이터 삭제 함수
async function deleteOldDeals() {
    try {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        
        // postedAt이 48시간 이전인 데이터 삭제
        const result = await Deal.deleteMany({ 
            postedAt: { $lt: fortyEightHoursAgo } 
        });
        
        if (result.deletedCount > 0) {
            console.log(`🗑️ 48시간 지난 핫딜 삭제 완료: ${result.deletedCount}건`);
        }
    } catch (e) {
        console.error('❌ 오래된 데이터 삭제 실패:', e.message);
    }
}

async function runCrawlers() {
    console.log(`\n🚀 크롤링 시작 (${new Date().toLocaleTimeString()})`);
    
    // 1. 오래된 데이터 먼저 정리
    await deleteOldDeals();

    // 2. 각 사이트 병렬 크롤링
    const results = await Promise.allSettled([
        ppomppuCrawler(),
        fmkoreaCrawler(),
        quasarzoneCrawler()
    ]);
    
    const allDeals = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

    // 3. DB 저장 및 알림 발송
    if (allDeals.length > 0) {
        const operations = allDeals.map(deal => ({ insertOne: { document: deal } }));
        try {
            // ordered: false로 설정하여 중복 에러가 발생해도 나머지는 저장되도록 함
            const result = await Deal.bulkWrite(operations, { ordered: false });
            
            if (result.insertedCount > 0) {
                console.log(`💾 신규 저장: ${result.insertedCount}건`);
                
                // 새로 저장된 딜들을 다시 조회하여 알림 서비스로 전달
                const newIds = Object.values(result.insertedIds);
                const insertedDeals = await Deal.find({ _id: { $in: newIds } });
                await matchAndNotify(insertedDeals);
            }
        } catch (e) { 
            // 11000은 중복 키 에러이므로 로그에서 제외하거나 무시
            if(e.code !== 11000) console.error('DB 저장 오류:', e.message);
        }
    } else {
        console.log('✨ 가져온 핫딜이 없습니다.');
    }
}

// --- API 라우트 ---

// 핫딜 목록 조회 (최신순)
app.get('/api/deals', async (req, res) => {
    try {
        // 이미 48시간 지난건 삭제되지만, 혹시 모르니 가져올 때도 최근 100개만
        const deals = await Deal.find().sort({ postedAt: -1 }).limit(100);
        res.json({ success: true, deals });
    } catch (e) { res.status(500).json({ success: false }); }
});

// 검색 API
app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json({ success: false, deals: [] });
    try {
        const deals = await Deal.find({ 
            title: { $regex: q, $options: 'i' } 
        }).sort({ postedAt: -1 }).limit(50);
        res.json({ success: true, deals });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/keywords', async (req, res) => {
    try {
        await Keyword.create(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/user/fcm', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.body.userId, { fcmToken: req.body.fcmToken }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// 서버 구동
async function startServer() {
    await connectDB();
    
    // 5분마다 크롤링 실행
    cron.schedule('*/5 * * * *', runCrawlers);
    
    // 서버 시작 시 1회 즉시 실행
    runCrawlers(); 
    
    app.listen(PORT, () => console.log(`🌍 서버 가동 중: Port ${PORT}`));
}

startServer();