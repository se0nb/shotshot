import React, { useState, useEffect, useCallback } from 'react';

// 백엔드 API 서버 주소 (서버의 PORT 3001과 일치해야 함)
// 🚨 실제 개발 시 'http://localhost:3001' 대신 배포된 서버 주소로 변경해야 합니다.
const API_BASE_URL = 'http://localhost:3001';

// 💡 임시 사용자 ID 설정: 백엔드 server.js에서 출력된 ID로 변경해야 합니다.
// 백엔드 로그 확인 후 이 값을 업데이트하세요. (예: '66a1a4f02a0a2c0c163013d7')
const TEST_USER_ID = '692e612f463ac6f3e8a1ef8c'; 


// 핫딜 목록 아이템 컴포넌트
const DealCard = ({ deal }) => {
    // 가격 파싱 로직
    const priceMatch = deal.price.match(/[\d,]+/);
    const displayedPrice = priceMatch ? priceMatch[0] : deal.price;
    
    // 🚨 사이트별 뱃지 색상 설정 추가
    let siteColor = 'bg-gray-500';
    let siteName = deal.site;

    if (deal.site === 'ppomppu') {
        siteColor = 'bg-purple-600'; // 뽐뿌: 보라색 계열 (또는 파랑)
        siteName = '뽐뿌';
    } else if (deal.site === 'fmkorea') {
        siteColor = 'bg-blue-500';   // 펨코: 파란색
        siteName = '펨코';
    } else if (deal.site === 'quasarzone') {
        siteColor = 'bg-orange-500'; // 퀘이사존: 주황색
        siteName = '퀘이사존';
    }

    const formatTime = (isoString) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) {
            return '-';
        }
    };

    return (
        <a href={deal.url} target="_blank" rel="noopener noreferrer" 
           className="block bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-100 group cursor-pointer">
            <div className="h-40 bg-gray-50 relative overflow-hidden flex items-center justify-center p-4">
                <div className="absolute top-3 left-3">
                    {/* 뱃지 색상 적용 */}
                    <span className={`${siteColor} text-white text-xs font-bold px-2 py-1 rounded shadow-sm capitalize`}>
                        {siteName}
                    </span>
                </div>
                {/* 이미지 대신 사이트별 아이콘/로고 개념 적용 가능 */}
                <i className="fas fa-box text-5xl text-gray-300"></i>
            </div>
            
            <div className="p-4">
                <div className="text-xs text-gray-500 mb-1 flex justify-between items-center">
                    <span className="truncate max-w-[60%]">{deal.category}</span>
                    <span>{formatTime(deal.postedAt)}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 leading-tight group-hover:text-red-500 transition-colors">
                    {deal.title}
                </h3>
                
                <div className="flex items-end justify-between mt-3">
                    <div className="text-lg font-extrabold text-red-600">
                        {displayedPrice}원
                    </div>
                    
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                        <span><i className="far fa-comment"></i> {deal.commentCount}</span>
                    </div>
                </div>
            </div>
        </a>
    );
};

// 키워드 등록 폼 컴포넌트
const KeywordForm = ({ userId }) => {
    const [keyword, setKeyword] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!keyword.trim()) return;

        setIsLoading(true);
        setMessage('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/keywords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    keyword: keyword.trim()
                })
            });

            const data = await response.json();
            
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setKeyword('');
            } else {
                setMessage({ type: 'error', text: data.message || '키워드 등록 실패' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '서버와의 통신에 실패했습니다.' });
            console.error('Keyword API Error:', error);
        } finally {
            setIsLoading(false);
            setTimeout(() => setMessage(''), 5000); // 5초 후 메시지 제거
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
                <i className="fas fa-bell mr-2 text-red-500"></i> 알림 키워드 등록
            </h2>
            <p className="text-sm text-gray-600 mb-4">
                '나이키', 'RTX 4070' 등 원하는 키워드를 등록하면, 새로운 핫딜이 올라올 때 알림을 받을 수 있습니다.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="등록할 키워드 입력 (예: 4070)"
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50"
                    disabled={isLoading || !userId || userId === 'TEST_USER_ID_PLACEHOLDER'}
                >
                    {isLoading ? '등록 중...' : '키워드 등록'}
                </button>
            </form>
            {message && (
                <p className={`mt-3 text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {message.text}
                </p>
            )}
            {userId === 'TEST_USER_ID_PLACEHOLDER' && (
                 <p className="mt-3 text-sm font-bold text-yellow-600">
                    ⚠️ TEST_USER_ID를 백엔드 로그에서 확인하여 코드를 수정해야 합니다.
                 </p>
            )}
        </div>
    );
};


// 메인 애플리케이션 컴포넌트
export default function App() {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [userId, setUserId] = useState(TEST_USER_ID); 

    // 핫딜 목록을 백엔드에서 불러오는 함수
    const fetchDeals = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/deals`);
            const data = await response.json();

            if (data.success) {
                setDeals(data.deals);
            } else {
                setError(data.message || '핫딜 목록 조회에 실패했습니다.');
            }
        } catch (err) {
            console.error('API Error:', err);
            setError('백엔드 서버와 연결할 수 없습니다. 서버(포트 3001)가 실행 중인지 확인하세요.');
        } finally {
            setLoading(false);
        }
    }, []);
    
    // 이펙트 1: 핫딜 목록 로드 및 주기적 업데이트
    useEffect(() => {
        if (userId === 'TEST_USER_ID_PLACEHOLDER') {
            setLoading(false);
            setError('사용자 ID가 설정되지 않았습니다. 코드를 수정해주세요.');
            return;
        }

        fetchDeals();
        // 1분마다 새로고침 (실시간성을 위한 간단한 방법)
        const intervalId = setInterval(fetchDeals, 60000); 
        return () => clearInterval(intervalId);
    }, [fetchDeals, userId]);


    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {/* Header */}
            <header className="bg-red-600 text-white p-4 shadow-xl sticky top-0 z-10">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-3xl font-black flex items-center gap-2">
                        <i className="fas fa-fire"></i> 핫딜-모아
                    </h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-white opacity-80">
                            사용자 ID: {userId.substring(0, 8)}...
                        </span>
                        <button className="bg-red-700 hover:bg-red-800 py-2 px-4 rounded-lg font-semibold text-sm transition duration-300">
                            로그인 (더미)
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-4 md:p-8">
                
                {/* 키워드 등록 섹션 */}
                <section className="mb-8">
                    <KeywordForm userId={userId} />
                </section>

                {/* 핫딜 목록 */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b-2 pb-2 border-red-500">
                        🔥 최신 핫딜 목록
                    </h2>

                    {loading && (
                        <div className="text-center py-12 text-lg text-gray-600">
                            <i className="fas fa-spinner fa-spin mr-2"></i> 핫딜 정보를 불러오는 중...
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
                            <p className="font-bold">오류 발생</p>
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {!loading && !error && deals.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {deals.map(deal => (
                                <DealCard key={deal._id} deal={deal} />
                            ))}
                        </div>
                    )}
                    
                    {!loading && !error && deals.length === 0 && (
                        <div className="text-center py-12 text-lg text-gray-600">
                            현재 수집된 핫딜 정보가 없습니다. 잠시 후 다시 시도해 주세요.
                        </div>
                    )}
                </section>

            </main>

            {/* Footer */}
            <footer className="text-center p-4 bg-gray-200 text-gray-600 mt-12">
                <p>Hotdeal-Moa | Back-end Port: 3001 | Test User ID: {userId.substring(0, 8)}...</p>
            </footer>
        </div>
    );
}