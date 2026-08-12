// =========================================================
// 놓을 위치: src/app/(dev)/layout.tsx
//
// 시연용 화면(playground)은 **개발 중에만** 열립니다.
//
// ★ 지우지 않고 막습니다.
//   치식도·쉐이드·임플란트 화면을 혼자 띄워 보는 곳이라 만들 때 요긴합니다.
//   다만 로그인이 필요 없어서, 그대로 배포하면 아무나 주소만 알면
//   들어옵니다. 기능이 새는 것은 아니지만 **밖에 보일 화면이 아닙니다.**
//
// ★ 403 이 아니라 404 입니다.
//   "권한이 없다" 고 알려 주면 그 화면이 있다는 사실이 새어 나갑니다
//   (설계서 §8.6 · policies/session 과 같은 판단).
// =========================================================

import { notFound } from 'next/navigation';

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();

  return <>{children}</>;
}
