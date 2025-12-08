import { Keyword } from '../models/Keyword.js';
import { User } from '../models/User.js';
import admin from 'firebase-admin';

async function sendNotification(fcmToken, deal) {
    if (!admin.apps.length) return;

    try {
        await admin.messaging().send({
            token: fcmToken,
            notification: {
                title: `🔥 샷샷 알림: [${deal.matchedKeyword}]`,
                body: deal.title,
            },
            webpush: {
                fcmOptions: { link: deal.url }
            }
        });
        console.log(`🔔 알림 발송 성공: ${deal.title}`);
    } catch (error) {
        console.error(`❌ 알림 발송 실패:`, error.message);
    }
}

export async function matchAndNotify(newDeals) {
    if (!newDeals.length) return;
    console.log(`🔍 ${newDeals.length}개 핫딜 키워드 매칭 시작...`);

    const activeKeywords = await Keyword.find({ isActive: true }).lean();
    if (!activeKeywords.length) return;

    for (const deal of newDeals) {
        const titleLower = deal.title.toLowerCase();
        const matchedUsers = new Map();

        for (const kw of activeKeywords) {
            if (titleLower.includes(kw.keyword)) {
                matchedUsers.set(kw.userId.toString(), kw.keyword);
            }
        }

        if (matchedUsers.size > 0) {
            const userIds = Array.from(matchedUsers.keys());
            const users = await User.find({ _id: { $in: userIds }, fcmToken: { $exists: true } });

            for (const user of users) {
                const keyword = matchedUsers.get(user._id.toString());
                await sendNotification(user.fcmToken, { ...deal, matchedKeyword: keyword });
            }
        }
    }
}