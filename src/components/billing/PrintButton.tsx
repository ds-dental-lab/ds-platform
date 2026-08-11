// =========================================================
// 놓을 위치: src/components/billing/PrintButton.tsx
//
// 청구서 인쇄 버튼. window.print() 하나뿐이라 따로 뗐습니다.
// (서버 컴포넌트에서 onClick 을 쓸 수 없어 이 조각만 클라이언트입니다)
// =========================================================

'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-9 rounded-md border border-[#DDE2EA] bg-white px-3.5 text-[12.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
    >
      인쇄 / PDF
    </button>
  );
}
