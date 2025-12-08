import mongoose from 'mongoose';

const keywordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    keyword: { type: String, required: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});

keywordSchema.index({ userId: 1, keyword: 1 }, { unique: true });
export const Keyword = mongoose.model('Keyword', keywordSchema);