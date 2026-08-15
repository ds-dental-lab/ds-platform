// =========================================================
// 놓을 위치: src/components/layout/EnvBadge.tsx
//
// "지금 보고 있는 것이 시험인가 운영인가" 를 화면에 못박습니다.
//
// ★ 이걸 만든 이유 (2026-08-13).
//   localhost 도 배포된 사이트도 **같은 운영 DB** 를 보고 있었는데,
//   'localhost = 시험' 이라고 여기고 청구서를 발행했습니다.
//   번호는 진짜로 소모됐습니다(INV-26000011). 주소만 보고는 구별할
//   길이 없었습니다 — 화면이 말해 줘야 합니다.
//
// ★ **운영에서는 아무것도 안 보입니다.**
//   `NEXT_PUBLIC_ENV_LABEL` 이 비어 있으면 null 을 돌려줍니다.
//   운영에 띠를 두르면 거래처가 보게 되고, 며칠이면 눈에 안 들어옵니다.
//   시험 환경에만 붙는 편이 오래갑니다.
//
// ★ 값을 화면에 그대로 씁니다.
//   'staging' 이든 '이대신 로컬' 이든 적은 대로 나옵니다. 환경이 셋
//   이상으로 늘어나도 코드를 안 고칩니다.
// =========================================================

export default function EnvBadge() {
  const label = process.env.NEXT_PUBLIC_ENV_LABEL?.trim();

  if (!label) return null;

  return (
    <div
      /*
        ★ 상단바(z-30) 위에 뜨되 **누르는 것을 안 막습니다**(pointer-events-none).
          띠 아래에 단추가 있으면 "왜 안 눌리지" 가 됩니다.
        ★ 화면을 밀지 않습니다 — fixed 라 자리를 안 차지합니다.
          자리를 차지하면 모든 화면의 높이 계산이 1px 씩 어긋납니다.
      */
      data-screen-only
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[3px] bg-[#E09A1B]"
      aria-hidden="true"
    >
      <span className="absolute right-3 top-0 rounded-b bg-[#E09A1B] px-2 py-[2px] text-[11px] font-bold leading-none text-white">
        {label}
      </span>
    </div>
  );
}
