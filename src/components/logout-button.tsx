// =========================================================
// 놓을 위치: src/components/logout-button.tsx
// 세 섹터 화면이 같이 씁니다.
// =========================================================

'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="mt-6 rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
    >
      로그아웃
    </button>
  );
}
