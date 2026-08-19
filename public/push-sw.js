// =========================================================
// 놓을 위치: public/push-sw.js  (서비스워커 — 탭이 없어도 돕니다)
//
// 웹푸시를 받아 Windows/브라우저 알림으로 띄웁니다.
//
// ★ 여기 오는 내용에는 환자 이름이 없습니다 (domain/push 가 보장).
//   이 알림은 잠금화면에도 뜰 수 있는 글자입니다.
//
// ★ 이 파일은 빌드를 거치지 않습니다. import 없이 순수 JS 로만 씁니다.
// =========================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'DenFlow', {
      body: payload.body || '',
      // 같은 주문이면 갈아끼웁니다 — 다섯 건이 다섯 개로 쌓이지 않게
      tag: payload.tag || 'denflow',
      renotify: true,
      icon: '/logo.png',
      data: { link: payload.link || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';

  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // 이미 열린 탭이 있으면 거기로 — 새 탭을 자꾸 늘리지 않습니다
      for (const tab of tabs) {
        if ('focus' in tab) {
          await tab.focus();
          if ('navigate' in tab) await tab.navigate(link);
          return;
        }
      }

      await self.clients.openWindow(link);
    })(),
  );
});
