import { ppomppuCrawler } from './crawlers/ppomppu.js';
import { fmkoreaCrawler } from './crawlers/fmkorea.js';
import { quasarzoneCrawler } from './crawlers/quasarzone.js';
import { connectDB } from './config/db.js';
import { Deal } from './models/Deal.js';
import { matchAndNotify } from './services/NotificationService.js'; 
import { User } from './models/User.js';
import { Keyword } from './models/Keyword.js';

import cron from 'node-cron';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import admin from 'firebase-admin';

const app = express();
const PORT = 3001; 


const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT;
const DATABASE_URL = process.env.FIREBASE_DB_URL; 

if (SERVICE_ACCOUNT_JSON && DATABASE_URL) {
    try {
        // 환경 변수에서 JSON 문자열 파싱.
        const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: DATABASE_URL,
        });
        console.log('✅ Firebase Admin SDK 초기화 성공!');
    } catch (e) {
        console.warn(`❌ Firebase Admin SDK 초기화 오류: 환경 변수를 확인해주세요. (${e.message})`);
    }
} else {
    console.warn('❌ Firebase 환경 변수(FIREBASE_SERVICE_ACCOUNT 또는 FIREBASE_DB_URL)가 누락되었습니다.');
}


async function saveDeals(deals) {
    if (deals.length === 0) {
        console.log('  └ 저장할 새로운 핫딜이 없습니다.');
        return [];
    }

    const operations = deals.map(deal => ({
        insertOne: { document: deal }
    }));
    
    try {
        const result = await Deal.bulkWrite(operations, { ordered: false });
        
        console.log(`  └ 총 ${deals.length}개 중 ✅ ${result.insertedCount}개의 핫딜 삽입 시도 완료.`);
        
        const latestDeals = await Deal.find({})
            .sort({ crawledAt: -1 })
            .limit(result.insertedCount)
            .lean();
            
        return latestDeals;
        
    } catch (error) {
        if (error.code === 11000) {
             const insertedCount = deals.length - (error.writeErrors?.length || 0);
             console.log(`  └ ${deals.length}개 중 ${error.writeErrors?.length || 0}개는 이미 존재하는 핫딜입니다.`);
             console.log(`  └ ✅ 약 ${insertedCount}개의 새로운 핫딜이 저장되었거나 기존에 저장된 것입니다.`);
             
             const latestDeals = await Deal.find({})
                .sort({ crawledAt: -1 })
                .limit(insertedCount) 
                .lean();
            
             return latestDeals;
             
        } else {
            console.error('❌ 핫딜 DB 저장 중 치명적인 오류 발생:', error.message);
            return [];
        }
    }
}


async function setupTestUsersAndKeywords() {
    console.log('\n--- 테스트 사용자 및 키워드 설정 ---');
    
    const TEST_USER_EMAIL = 'testuser@shotshot.com'; 

    const testUser = {
        email: TEST_USER_EMAIL,
        // fcmToken: 'DUMMY_FCM_TOKEN_1234567890', // 이제 DB에 토큰이 없어야 프론트에서 등록됨
        nickname: '알림테스터',
    };
    
    const userDoc = await User.findOneAndUpdate(
        { email: testUser.email }, 
        testUser, 
        { new: true, upsert: true }
    );
    
    const userId = userDoc._id;
    console.log(`  └ 사용자 '${userDoc.email}' 준비 완료. ID: ${userId}`);
    
    const keywords = [];
    for (const kw of keywords) {
        await Keyword.findOneAndUpdate(
            { userId: userId, keyword: kw.toLowerCase() },
            { $set: { isActive: true } },
            { new: true, upsert: true }
        );
    }
    console.log(`  └ 키워드 [${keywords.join(', ')}] 등록 완료.`);
    return userDoc;
}

// ==========================================================
// 🚨 통합 크롤링 실행 함수
// ==========================================================
async function runAllCrawlers() {
    console.log(`\n--- 통합 크롤링 시작 (${new Date().toLocaleTimeString('ko-KR')}) ---`);
    
    // 3개의 사이트를 동시에(병렬) 크롤링하여 속도를 높입니다.
    // 만약 서버 사양이 낮다면 await로 순차 실행할 수도 있습니다.
    const [ppomppuDeals, fmkoreaDeals, quasarDeals] = await Promise.all([
        ppomppuCrawler(),
        fmkoreaCrawler(),
        quasarzoneCrawler()
    ]);

    // 모든 결과를 하나의 배열로 합칩니다.
    const allDeals = [
        ...ppomppuDeals, 
        ...fmkoreaDeals, 
        ...quasarDeals
    ];

    console.log(`  └ 총 수집된 데이터: ${allDeals.length}개`);
    
    // DB 저장 및 알림 매칭 실행
    const insertedDeals = await saveDeals(allDeals);
    await matchAndNotify(insertedDeals);
    
    console.log('--- 크롤링 종료 ---');
}

// ==========================================================
// Express 서버 설정 및 API 라우트 
// ==========================================================

app.use(cors()); 
app.use(bodyParser.json());

// API 1: 핫딜 목록 조회
app.get('/api/deals', async (req, res) => {
    try {
        const deals = await Deal.find({})
            .sort({ postedAt: -1 })
            .limit(50) 
            .lean();
        
        res.json({ success: true, deals: deals });
    } catch (error) {
        console.error('핫딜 조회 API 오류:', error.message);
        res.status(500).json({ success: false, message: '핫딜 목록을 불러오는 데 실패했습니다.' });
    }
});

// API 2: 새 키워드 등록
app.post('/api/keywords', async (req, res) => {
    const { userId, keyword } = req.body;

    if (!userId || !keyword) {
        return res.status(400).json({ success: false, message: '사용자 ID와 키워드는 필수입니다.' });
    }

    try {
        await Keyword.findOneAndUpdate(
            { userId: userId, keyword: keyword.toLowerCase() },
            { $set: { isActive: true } },
            { new: true, upsert: true }
        );
        
        res.json({ success: true, message: `키워드 '${keyword}'가 성공적으로 등록되었습니다.` });
    } catch (error) {
        console.error('키워드 등록 API 오류:', error.message);
        res.status(500).json({ success: false, message: '키워드 등록에 실패했습니다.' });
    }
});

// API 3: FCM 토큰 저장/업데이트 (프론트엔드에서 호출)
app.post('/api/user/fcm', async (req, res) => {
    const { userId, fcmToken } = req.body;

    if (!userId || !fcmToken) {
        return res.status(400).json({ success: false, message: '사용자 ID와 FCM 토큰은 필수입니다.' });
    }

    try {
        await User.findByIdAndUpdate(userId, { fcmToken: fcmToken });
        res.json({ success: true, message: 'FCM 토큰이 성공적으로 저장되었습니다.' });
    } catch (error) {
        console.error('FCM 토큰 저장 API 오류:', error.message);
        res.status(500).json({ success: false, message: '토큰 저장에 실패했습니다.' });
    }
});


async function main() {
    await connectDB();
    const testUser = await setupTestUsersAndKeywords(); 
    
    console.log('\n 샷샷 백엔드 실행 (뽐뿌 + 펨코 + 퀘이사존)');
    
    // 서버 시작 시 1회 실행
    await runAllCrawlers();
    
    // 5분간격 스케줄링
    console.log('\n⏰ 크롤링 스케줄링 시작: 5분마다 3개 사이트 확인');
    cron.schedule('*/5 * * * *', async () => { 
        await runAllCrawlers();
    });

    app.listen(PORT, () => {
        console.log(`\n🚀 웹 서버가 http://localhost:${PORT} 에서 구동되었습니다.`);
        console.log(`💡 테스트 사용자 ID: ${testUser._id}`);
    });
}

main();