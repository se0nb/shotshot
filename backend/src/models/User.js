import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    fcmToken: String,
    nickname: String,
    createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', userSchema);