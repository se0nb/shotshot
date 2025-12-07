import mongoose from 'mongoose';

// ⚠️ 중요: 여기에 실제 MongoDB 연결 문자열을 입력하세요.
// 예: 'mongodb+srv://user:password@cluster0.abcde.mongodb.net/hotdeal-db?retryWrites=true&w=majority'
const MONGODB_URI = 'mongodb+srv://shonsungje_db_user:LwGbf5vUaHe82R0y@cluster0.b6ow3ax.mongodb.net/?appName=Cluster0'; 

/**
 * MongoDB에 연결하는 함수
 */
export async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB 연결 성공!');
    } catch (error) {
        console.error('❌ MongoDB 연결 실패:', error.message);
        // 연결 실패 시 프로세스 종료 (데이터 저장이 불가능하므로)
        process.exit(1); 
    }
}