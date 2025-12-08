import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import admin from 'firebase-admin';
import fs from 'fs';
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

// 1. Firebase 초기화 (배포 환경 변수 우선)
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
const databaseUrl = process.env.FIREBASE_DB_URL;

if (serviceAccountJson) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
            databaseURL: databaseUrl
        });
        console.log('✅ Firebase Admin 초기화 완료');
    } catch (e) { console.error('Firebase 초기화 실패:', e.message); }
} else {
    try {
        if (fs.existsSync('./serviceAccountKey.json')) {
            const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin 초기화 완료 (로컬 파일)');
        } else {
            console.warn('⚠️ serviceAccountKey.json 파일이 없습니다. 알림이 발송되지 않습니다.');
        }
    } catch(e) {
        console.error('Firebase 로컬 초기화 에러:', e.message);
    }
}

app.use(cors());
app.use(express.json());

// 2. 통합 크롤링 함수
async function runCrawlers() {
    console.log(`\n🚀 크롤링 시작 (${new Date().toLocaleTimeString()})`);
    const results = await Promise.allSettled([
        ppomppuCrawler(),
        fmkoreaCrawler(),
        quasarzoneCrawler()
    ]);
    
    // 성공한 결과만 평탄화
    const allDeals = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

    if (allDeals.length > 0) {
        // DB 저장 (중복 제외)
        const operations = allDeals.map(deal => ({
            insertOne: { document: deal }
        }));
        
        try {
            const result = await Deal.bulkWrite(operations, { ordered: false });
            console.log(`💾 ${result.insertedCount}개 신규 핫딜 저장 완료`);
            
            // 신규 딜에 대해서만 알림 매칭
            if (result.insertedCount > 0) {
                const newIds = Object.values(result.insertedIds);
                const insertedDeals = await Deal.find({ _id: { $in: newIds } });
                await matchAndNotify(insertedDeals);
            }
        } catch (e) {
            // 중복 에러(11000)는 무시하고 실제 저장된 개수만 체크
            if (e.code === 11000 && e.result) {
                const inserted = e.result.nInserted;
                console.log(`💾 ${inserted}개 신규 핫딜 저장 (중복 제외)`);
                if (inserted > 0) {
                    // 최근 저장된 것들만 가져와서 매칭 시도 (약식 구현)
                    const recentDeals = await Deal.find().sort({_id:-1}).limit(inserted);
                    await matchAndNotify(recentDeals);
                }
            }
        }
    }
}

// 3. API 라우트
app.get('/api/deals', async (req, res) => {
    try {
        const deals = await Deal.find().sort({ postedAt: -1 }).limit(100);
        res.json({ success: true, deals });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/keywords', async (req, res) => {
    try {
        const { userId, keyword } = req.body;
        await Keyword.create({ userId, keyword });
        res.json({ success: true, message: '키워드가 등록되었습니다.' });
    } catch (e) { res.status(500).json({ success: false, message: '등록 실패 (중복 등)' }); }
});

app.post('/api/user/fcm', async (req, res) => {
    try {
        const { userId, fcmToken } = req.body;
        await User.findByIdAndUpdate(userId, { fcmToken }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// 4. 서버 시작
async function startServer() {
    await connectDB();
    
    // 테스트 유저 생성 (로컬 개발용)
    const testEmail = 'testuser@shotshot.com';
    const user = await User.findOneAndUpdate(
        { email: testEmail }, 
        { email: testEmail, nickname: 'Tester' }, 
        { upsert: true, new: true }
    );
    console.log(`💡 테스트 유저 ID: ${user._id}`);

    // 스케줄러 (5분마다)
    cron.schedule('*/5 * * * *', runCrawlers);
    
    // 최초 1회 실행
    runCrawlers();

    app.listen(PORT, () => console.log(`🌍 서버 가동 중: Port ${PORT}`));
}

startServer();