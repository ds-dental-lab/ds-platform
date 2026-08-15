// =========================================================
// 놓을 위치: src/components/order/WorkOrderButton.tsx
//
// 기공의뢰서 버튼. 누르면 **새 창에서 인쇄창이 바로** 뜹니다.
// (사용자 요청 2026-08-15 — "클릭시 인쇄창이 바로 열리는 기능")
//
// ★ **새 창으로 엽니다.** 같은 창에서 열면 인쇄를 마치고 뒤로가기를
//   눌러야 주문으로 돌아옵니다. 기공소는 이걸 하루에 수십 번 합니다 —
//   그때마다 보던 자리를 잃으면 안 됩니다. 인쇄창을 닫으면 원래 화면이
//   그대로 있습니다.
//
// ★ `?print=1` 이 붙어야 인쇄창이 뜹니다. 주소만으로 열면 안 뜹니다 —
//   미리 보고 싶을 때가 있고, 그때 인쇄창이 튀어나오면 성가십니다.
//
// ★ 링크(`<a target="_blank">`)입니다. 스크립트로 여는 창은 팝업 차단에
//   걸립니다. 사람이 직접 누른 링크는 안 막힙니다.
// =========================================================

export default function WorkOrderButton({ href }: { href: string }) {
  return (
    <a
      href={`${href}?print=1`}
      target="_blank"
      rel="noopener"
      title="기공의뢰서를 새 창에서 열고 인쇄창을 띄웁니다"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#BFD5F5] bg-[#F2F7FE] px-2.5 text-[13px] font-bold text-[#1279E8] hover:bg-[#E7EEFA]"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 8V3h8v5" />
        <path d="M6 15H4v-5h12v5h-2" />
        <path d="M6 13h8v5H6z" />
      </svg>
      기공의뢰서
    </a>
  );
}
