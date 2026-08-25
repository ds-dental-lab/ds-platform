// =========================================================
// 놓을 위치: src/components/account/MyAccountCard.tsx
//
// 내 계정. 지금 로그인한 사람 자신의 것. (사용자 요청 2026-08-25)
//
// ★★ **관리자만이 아니라 모두에게 보입니다.** 위의 계정정보는 조직의
//   사업자 정보라 관리자만 고치지만, 자기 비밀번호는 누구나 바꿀 수
//   있어야 합니다 — 바꿀 수 있는 사람이 정해져 있으면, 나머지는
//   비밀번호를 영영 안 바꿉니다.
// =========================================================

import PasswordChange from '@/components/account/PasswordChange';

export default function MyAccountCard({ email, name }: { email: string; name: string }) {
  return (
    <section className="mt-3.5 rounded-[12px] border border-[#E8EBF0] bg-white px-5 py-4">
      <h2 className="text-[15px] font-bold tracking-tight text-[#1A2130]">내 계정</h2>

      <p className="mt-1 text-[13px] text-[#98A2B3]">
        {name ? `${name} · ` : ''}
        {email}
      </p>

      <div className="mt-3.5">
        <PasswordChange email={email} />
      </div>
    </section>
  );
}
