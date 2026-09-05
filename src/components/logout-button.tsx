// =========================================================
// 놓을 위치: src/components/logout-button.tsx
// 세 섹터 화면이 같이 씁니다.
// =========================================================

'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { clearedKeepCookies } from '@/server/domain/login';

/**
 * @param className 모양을 바꿔야 하는 자리(진료실 폰 홈)에서 넘깁니다.
 *   안 넘기면 전처럼 테두리 단추입니다. 하는 일은 같습니다.
 */
export default function LogoutButton({ className }: { className?: string } = {}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();

    // ★ '로그인 상태 유지' 표시도 같이 걷습니다 (SectorShell 과 같은 이유)
    clearedKeepCookies(window.location.protocol === 'https:').forEach((c) => {
      document.cookie = c;
    });

    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className ?? 'mt-6 rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50'}
    >
      로그아웃
    </button>
  );
}
