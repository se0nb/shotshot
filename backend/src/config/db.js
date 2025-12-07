import mongoose from 'mongoose';

// 🚨 수정: 하드코딩된 문자열 대신 환경 변수에서 읽어옵니다.
const MONGODB_URI = process.env.MONGODB_URI; 

/**
 * MongoDB에 연결하는 함수
 */
export async function connectDB() {
    if (!MONGODB_URI) {
        console.error('❌ MongoDB URI가 환경 변수에 설정되지 않았습니다.');
        process.exit(1); 
    }
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB 연결 성공!');
    } catch (error) {
        console.error('❌ MongoDB 연결 실패:', error.message);
        process.exit(1); 
    }
}