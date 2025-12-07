import { Keyword } from '../models/Keyword.js';
import { User } from '../models/User.js';
import admin from 'firebase-admin'; // 🚨 추가: Firebase Admin SDK

/**
 * FCM을 통해 사용자에게 웹 푸시 알림을 발송합니다.
 * @param {string} fcmToken 알림을 받을 사용자의 디바이스 토큰
 * @param {Object} deal 매칭된 핫딜 정보
 */
async function sendNotification(fcmToken, deal) {
    if (!admin.apps.length) {
        console.error("❌ Firebase Admin이 초기화되지 않았습니다. 알림 발송 실패.");
        return;
    }

    const payload = {
        notification: {
            title: `🔥 핫딜 알림: [${deal.matchedKeyword.toUpperCase()}] 매칭!`,
            body: deal.title,
            icon: '/favicon.ico', // 웹사이트 아이콘 경로
            click_action: deal.url, // 클릭 시 이동할 URL
        },
        data: {
            url: deal.url,
            dealId: deal._id.toString()
        },
    };

    try {
        const response = await admin.messaging().sendToDevice(fcmToken, payload);
        console.log(`\n🔔 [알림 발송 성공] 키워드: ${deal.matchedKeyword}, ID: ${fcmToken.substring(0, 10)}...`);
        console.log(`  └ 응답: ${response.successCount} 성공, ${response.failureCount} 실패`);
    } catch (error) {
        console.error(`❌ 알림 발송 실패 (토큰: ${fcmToken.substring(0, 10)}...):`, error.message);
        // 토큰이 유효하지 않은 경우, DB에서 해당 토큰을 제거하는 로직 추가 필요
    }
}

/**
 * 새로운 핫딜 정보를 기반으로 등록된 키워드를 매칭하고 알림을 보냅니다.
 * @param {Array<Object>} newDeals 새로 DB에 저장된 핫딜 목록
 */
export async function matchAndNotify(newDeals) {
    if (newDeals.length === 0) {
        return;
    }

    console.log(`\n=== 알림 매칭 서비스 시작: ${newDeals.length}개 핫딜 검사 ===`);
    
    // 활성화된 모든 키워드를 DB에서 조회
    const activeKeywords = await Keyword.find({ isActive: true }).lean();
    
    if (activeKeywords.length === 0) {
        console.log('  └ 등록된 키워드가 없어 알림 검사를 건너뜁니다.');
        return;
    }

    for (const deal of newDeals) {
        const titleLower = deal.title.toLowerCase().trim(); 
        
        const matchedUsers = new Map(); // Map<userId, matchedKeyword>

        for (const kw of activeKeywords) {
            const keywordLower = kw.keyword; 
            
            if (titleLower.includes(keywordLower)) {
                if (!matchedUsers.has(kw.userId.toString())) {
                    matchedUsers.set(kw.userId.toString(), kw.keyword);
                }
            }
        }
        
        if (matchedUsers.size > 0) {
            const userIds = Array.from(matchedUsers.keys());
            
            const usersToNotify = await User.find({ 
                _id: { $in: userIds },
                fcmToken: { $exists: true, $ne: null } 
            }).select('fcmToken email');
            
            for (const user of usersToNotify) {
                const matchedKeyword = matchedUsers.get(user._id.toString());
                
                // 실제 알림 발송 함수 호출
                await sendNotification(user.fcmToken, { 
                    ...deal, 
                    matchedKeyword: matchedKeyword 
                });
            }
            
            if (usersToNotify.length === 0) {
                 console.log('  └ 매칭된 사용자가 있으나, 알림 토큰이 없어 발송되지 않았습니다.');
            }
        }
    }
    console.log('=== 알림 매칭 서비스 종료 ===');
}