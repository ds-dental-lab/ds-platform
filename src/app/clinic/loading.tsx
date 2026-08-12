// =========================================================
// 놓을 위치: src/app/clinic/loading.tsx
//
// ★ 이 파일 하나가 아래 모든 화면에 듭니다.
//   링크를 누르는 즉시 본문 자리가 서고, 데이터가 오면 채워집니다.
//   사이드바·상단바는 레이아웃이라 다시 안 그려집니다.
// =========================================================

import ScreenSkeleton from '@/components/layout/ScreenSkeleton';

export default function Loading() {
  return <ScreenSkeleton />;
}
