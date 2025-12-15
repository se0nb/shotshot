import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, ShoppingCart, MessageSquare, Clock } from 'lucide-react';

const PpomppuViewer = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchPpomppuPosts = async () => {
    setLoading(true);
    setError(null);
    setPosts([]);

    try {
      // 1. 타겟 URL (뽐뿌게시판)
      const targetUrl = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
      
      // 2. CORS 우회 프록시 (캐시 방지를 위해 timestamp 추가)
      // 주의: allorigins.win은 데모용 무료 프록시입니다. 실제 서비스엔 백엔드 서버가 필요합니다.
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}&_t=${Date.now()}`;

      // 3. 데이터 가져오기 (ArrayBuffer로 받아야 EUC-KR 디코딩 가능)
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      
      const buffer = await response.arrayBuffer();

      // 4. EUC-KR 디코딩 (뽐뿌 사이트 인코딩 대응)
      const decoder = new TextDecoder('euc-kr');
      const htmlString = decoder.decode(buffer);

      // 5. HTML 파싱
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');

      // 6. 게시글 추출 로직 수정 (광고 필터링 강화)
      // list0, list1 클래스는 실제 유저 게시글 행(Row)에만 부여됩니다.
      const rows = doc.querySelectorAll('tr.list0, tr.list1');
      const extractedPosts = [];

      rows.forEach((row) => {
        // 제목 요소 찾기 (.list_title 클래스 혹은 <a> 태그)
        let titleElement = row.querySelector('.list_title');
        let linkElement = null;
        let titleText = '';

        if (titleElement) {
          titleText = titleElement.textContent.trim();
          linkElement = titleElement.closest('a');
        } else {
          linkElement = row.querySelector('a');
          if (linkElement) {
             titleText = linkElement.textContent.trim();
          }
        }

        if (!linkElement) return;

        const href = linkElement.getAttribute('href');

        // [핵심 수정 사항] 엄격한 필터링 로직 적용
        // 1. view.php: 게시글 상세 페이지여야 함
        // 2. id=ppomppu: 정확히 '뽐뿌게시판'의 글이어야 함 (다른 게시판/광고 제외)
        // 3. no=: 게시글 고유 번호가 있어야 함 (카테고리 링크 등 제외)
        if (!href || !href.includes('view.php') || !href.includes('id=ppomppu') || !href.includes('no=')) {
          return;
        }

        // 썸네일 추출 (있으면 가져오기)
        const imgTag = row.querySelector('img');
        let thumbUrl = null;
        if (imgTag) {
            const src = imgTag.getAttribute('src');
            // 'noimage'가 아니고 실제 이미지 경로가 있는 경우만
            if (src && !src.includes('noimage') && (src.endsWith('.jpg') || src.endsWith('.png') || src.endsWith('.gif'))) {
                 thumbUrl = src.startsWith('http') ? src : `https:${src}`;
            }
        }

        // 댓글 수 추출
        const commentSpan = row.querySelector('.list_comment2');
        const commentCount = commentSpan ? commentSpan.textContent.trim() : '0';

        // 추천수 등 기타 정보 (필요시 추가)
        // const vote = row.querySelector('td:nth-child(5)')?.textContent || '0';

        // 링크 절대 경로 변환
        const fullLink = href.startsWith('http') 
          ? href 
          : `https://www.ppomppu.co.kr/zboard/${href}`;

        // 게시글 ID 추출 (key로 사용)
        const postId = href.match(/no=(\d+)/)?.[1] || Math.random().toString();

        extractedPosts.push({
          id: postId,
          title: titleText,
          link: fullLink,
          thumb: thumbUrl,
          comments: commentCount
        });
      });

      if (extractedPosts.length === 0) {
        setError('게시글을 찾을 수 없습니다. (파싱 구조가 변경되었거나 차단됨)');
      } else {
        setPosts(extractedPosts);
        setLastUpdated(new Date());
      }

    } catch (err) {
      console.error(err);
      setError('크롤링 중 오류가 발생했습니다. (CORS 또는 네트워크 문제)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPpomppuPosts();
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 bg-gray-50 min-h-screen font-sans">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center sticky top-0 z-10 bg-opacity-90 backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-red-500" />
              뽐뿌게시판 뷰어
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">실시간</span>
              <p className="text-sm text-gray-500">유저 핫딜 정보 (광고 제외)</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button 
              onClick={fetchPpomppuPosts} 
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors active:bg-gray-200"
              title="새로고침"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {lastUpdated && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="divide-y divide-gray-100">
          {error && (
            <div className="p-8 text-center text-red-500 flex flex-col items-center gap-2 bg-red-50">
              <AlertCircle className="w-8 h-8" />
              <p className="font-medium">{error}</p>
              <p className="text-xs text-gray-500 max-w-md">
                브라우저 전용 데모입니다. CORS 정책으로 인해 무료 프록시(allorigins)를 사용 중이며, 간혹 접속이 불안정할 수 있습니다.
              </p>
            </div>
          )}

          {loading && !error && posts.length === 0 && (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              <p>최신 정보를 가져오고 있습니다...</p>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
             <div className="p-12 text-center text-gray-400">
               조건에 맞는 게시글이 없습니다.
             </div>
          )}

          {posts.map((post) => (
            <div key={post.id} className="group p-4 hover:bg-blue-50 transition-colors flex gap-4 items-start duration-200">
              {/* 썸네일 */}
              <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center relative">
                {post.thumb ? (
                  <img src={post.thumb} alt="상품 이미지" className="w-full h-full object-cover" />
                ) : (
                  <ShoppingCart className="w-8 h-8 text-gray-300" />
                )}
                {/* 뽐뿌 로고 컬러 바 */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0 py-1">
                <a 
                  href={post.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[15px] font-medium text-gray-800 group-hover:text-blue-600 leading-snug block mb-2 line-clamp-2"
                >
                  {post.title}
                </a>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium group-hover:bg-white group-hover:shadow-sm transition-all">
                      <MessageSquare className="w-3 h-3" />
                      {post.comments}
                    </span>
                    <span className="text-gray-400">NO. {post.id}</span>
                  </div>
                  
                  <a 
                    href={post.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    보러가기 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer info */}
         <div className="bg-gray-50 p-4 text-xs text-gray-400 text-center border-t border-gray-100">
            데이터 출처: ppomppu.co.kr | Client-side Scraping Demo
         </div>
      </div>
    </div>
  );
};

export default PpomppuViewer;