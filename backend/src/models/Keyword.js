import mongoose from 'mongoose';
import { User } from './User.js'; // User 모델을 참조하기 위해 import

const keywordSchema = new mongoose.Schema({
    // 키워드를 등록한 사용자 ID 참조
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // User 모델을 참조
        required: true,
    },
    // 사용자가 등록한 키워드 (예: '4070', '나이키')
    keyword: {
        type: String,
        required: true,
        lowercase: true, // 검색의 정확성을 위해 소문자로 저장
    },
    // 알림 활성화 여부
    isActive: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// 한 사용자가 같은 키워드를 중복 등록하는 것을 방지
keywordSchema.index({ userId: 1, keyword: 1 }, { unique: true });

export const Keyword = mongoose.model('Keyword', keywordSchema);