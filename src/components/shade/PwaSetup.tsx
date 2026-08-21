// =========================================================
// 놓을 위치: src/components/shade/PwaSetup.tsx
//
// 진료실 폰에서 '홈 화면에 추가' 가 뜨게 합니다.
// (명세서 SPEC_shade-photo Phase 3)
//
// ★★ 서비스워커가 **등록돼 있어야** 브라우저가 설치를 권합니다.
//   지금까지는 웹푸시를 켤 때만 등록했습니다 — 알림을 안 켠 사람은
//   설치 안내도 못 봤습니다.
//
// ★ 여기서는 등록만 합니다. 알림 권한은 안 묻습니다 — 화면을 열자마자
//   권한창이 뜨면 진료실은 그냥 닫아 버립니다.
//
// ★ 실패해도 조용합니다. 홈 화면에 못 얹는 것뿐이고, 화면은 그대로
//   돕니다. 그것 때문에 오류를 띄우면 안 됩니다.
// =========================================================

'use client';

import { useEffect } from 'react';

export default function PwaSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/push-sw.js').catch(() => {
      /* 사생활 보호 모드·비보안 연결에서는 막힙니다 — 없는 셈 칩니다 */
    });
  }, []);

  return null;
}
