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

/*
  ★★ 홈 화면에 얹으려면 이 처리가 **있기만 해도** 됩니다.
    브라우저가 "이 앱은 서비스워커가 요청을 다룬다" 를 설치 조건으로
    봅니다. 없으면 '홈 화면에 추가' 가 아예 안 뜹니다.

  ★ 여기서 **아무것도 안 합니다.** respondWith 를 안 부르면 브라우저가
    평소대로 가져갑니다.

  ★★ **캐시를 안 합니다.** 진료실이 어제 화면을 보고 있으면 안 됩니다 —
    의뢰 목록이 어제 것이면 엉뚱한 환자에게 사진이 붙습니다.
    오프라인 대비는 그것대로 위험을 안고 하는 일이라, 필요해지면
    그때 따로 설계합니다.
*/
self.addEventListener('fetch', () => {});
