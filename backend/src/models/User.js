import mongoose from 'mongoose';

// User 모델 정의 (간이 소셜 로그인 구조 가정)
const userSchema = new mongoose.Schema({
    // 이메일 또는 소셜 ID (유니크)
    email: {
        type: String,
        required: true,
        unique: true,
    },
    // 웹 푸시 알림을 위한 FCM 토큰 (브라우저별)
    fcmToken: {
        type: String,
        // 토큰은 나중에 로그인 후 추가될 수 있으므로 required: false
    },
    // 실제 이름 또는 닉네임
    nickname: String,
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const User = mongoose.model('User', userSchema);