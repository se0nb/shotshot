import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shonsungje_db_user:LwGbf5vUaHe82R0y@cluster0.b6ow3ax.mongodb.net/?appName=Cluster0';

export async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB 연결 성공!');
    } catch (error) {
        console.error('❌ MongoDB 연결 실패:', error.message);
        process.exit(1);
    }
}