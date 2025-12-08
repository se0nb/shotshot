import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema({
    site: { type: String, required: true },
    originId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    price: String,
    url: { type: String, required: true },
    imageUrl: String, // 🚨 추가된 필드: 이미지 주소 저장
    category: String,
    commentCount: { type: Number, default: 0 },
    postedAt: { type: Date, required: true },
    crawledAt: { type: Date, default: Date.now },
});

export const Deal = mongoose.model('Deal', dealSchema);