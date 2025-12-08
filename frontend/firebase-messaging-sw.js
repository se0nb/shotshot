importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// 🚨 FIREBASE_CONFIG를 여기에 다시 입력해야 합니다.
const firebaseConfig = {
  apiKey: "AIzaSyCM2DLvehwPj8m5QEywhreHO2BEojzm7cU",
  authDomain: "shotshot-95085.firebaseapp.com",
  databaseURL: "https://shotshot-95085-default-rtdb.firebaseio.com",
  projectId: "shotshot-95085",
  storageBucket: "shotshot-95085.firebasestorage.app",
  messagingSenderId: "938741929966",
  appId: "1:938741929966:web:02f75fcacb7a10db0520ff"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드 알림 처리
messaging.onBackgroundMessage(function(payload) {
    console.log('[Service Worker] 알림 수신:', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icons/icon-192x192.png', // 아이콘이 없다면 생략 가능
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 시 해당 핫딜 사이트로 이동
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.link || '/')
    );
});