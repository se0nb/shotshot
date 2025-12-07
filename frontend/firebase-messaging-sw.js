importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

// 🚨 FIREBASE_CONFIG를 여기에 다시 입력해야 합니다.
const firebaseConfig = {
    apiKey: "AIzaSyCM2DLvehwPj8m5QEywhreHO2BEojzm7cU",
    authDomain: "shotshot-95085.firebaseapp.com",
    projectId: "shotshot-95085",
    storageBucket: "shotshot-95085.firebasestorage.app",
    messagingSenderId: "938741929966",
    appId: "1:938741929966:web:02f75fcacb7a10db0520ff",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드에서 메시지 수신 시 처리
messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Background Message received. ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/favicon.ico',
        data: payload.data // 클릭 시 사용할 데이터
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 시 처리
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    // 알림에 포함된 URL로 이동
    const clickAction = event.notification.data.url; 

    event.waitUntil(
        clients.matchAll({
            type: 'window'
        }).then(function(clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                // 기존 창이 있으면 그 창으로 포커스
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.navigate(clickAction || '/').then(client => client.focus());
            }
            // 기존 창이 없으면 새 창 열기
            return clients.openWindow(clickAction || '/');
        })
    );
});