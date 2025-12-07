import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema({
    // 출처 사이트 (예: 'ppomppu', 'quasarzone')
    site: {
        type: String,
        required: true,
    },
    // 원본 게시글의 고유 ID (크롤링 시 중복 체크의 핵심)
    originId: {
        type: String,
        required: true,
        unique: true, // 🚨 중요: 이 필드가 중복되면 저장을 허용하지 않음 (중복 체크)
    },
    title: {
        type: String,
        required: true,
    },
    price: String, // 가격 정보는 문자열로 저장
    url: {
        type: String,
        required: true,
    },
    category: String,
    commentCount: {
        type: Number,
        default: 0
    },
    // 원본 글 작성 시간 (크롤링된 시간과 다를 수 있음)
    postedAt: {
        type: Date,
        required: true,
    },
    // DB에 저장된 시간
    crawledAt: {
        type: Date,
        default: Date.now,
    },
});

// 모델 익스포트
export const Deal = mongoose.model('Deal', dealSchema);