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

// Firebase 설정 (배포/로컬 분기)
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
} else {
    // 로컬용 (필요시 추가)
}

app.use(cors());
app.use(express.json());

async function runCrawlers() {
    console.log(`\n🚀 크롤링 시작 (${new Date().toLocaleTimeString()})`);
    const results = await Promise.allSettled([
        ppomppuCrawler(),
        fmkoreaCrawler(),
        quasarzoneCrawler()
    ]);
    
    const allDeals = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

    if (allDeals.length > 0) {
        const operations = allDeals.map(deal => ({ insertOne: { document: deal } }));
        try {
            const result = await Deal.bulkWrite(operations, { ordered: false });
            if (result.insertedCount > 0) {
                const newIds = Object.values(result.insertedIds);
                const insertedDeals = await Deal.find({ _id: { $in: newIds } });
                await matchAndNotify(insertedDeals);
            }
            console.log(`💾 저장 완료: 신규 ${result.insertedCount}건`);
        } catch (e) { 
            if(e.code !== 11000) console.error('DB 저장 오류:', e.message);
        }
    }
}

// --- API 라우트 ---

app.get('/api/deals', async (req, res) => {
    try {
        const deals = await Deal.find().sort({ postedAt: -1 }).limit(100);
        res.json({ success: true, deals });
    } catch (e) { res.status(500).json({ success: false }); }
});

// 🚨 [추가된 API] 핫딜 검색 기능
app.get('/api/search', async (req, res) => {
    const { q } = req.query; // 검색어
    if (!q) return res.json({ success: false, deals: [] });

    try {
        // 제목에 검색어가 포함된 최신순 50개 조회 (대소문자 무시)
        const deals = await Deal.find({ 
            title: { $regex: q, $options: 'i' } 
        })
        .sort({ postedAt: -1 })
        .limit(50);
        
        res.json({ success: true, deals });
    } catch (e) {
        console.error('검색 오류:', e);
        res.status(500).json({ success: false, message: '검색 실패' });
    }
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
    cron.schedule('*/5 * * * *', runCrawlers);
    runCrawlers(); // 시작 시 1회 실행
    app.listen(PORT, () => console.log(`🌍 서버 가동 중: Port ${PORT}`));
}

startServer();