// =========================================================
// 놓을 위치: src/components/layout/ScreenSkeleton.tsx
//
// 화면이 아직 안 왔을 때 자리를 잡아 두는 뼈대.
//
// ★ 이것이 '즉각 반응' 의 정체입니다.
//   서버가 아무리 빨라도 왕복은 있습니다. 그 사이 화면이 **그대로
//   멈춰 있으면** 사람은 안 눌린 줄 알고 또 누릅니다.
//   누르자마자 틀이 서면, 같은 시간이 걸려도 빠르게 느껴집니다.
//
// ★ 사이드바·상단바는 그대로 있습니다.
//   레이아웃은 다시 안 그려집니다. 바뀌는 것은 본문뿐이고, 그래서
//   여기서는 본문 자리만 잡습니다.
//
// ★ 진짜 화면과 **비슷한 모양**이어야 합니다.
//   엉뚱한 모양을 띄우면 내용이 도착할 때 화면이 튑니다.
// =========================================================

export default function ScreenSkeleton() {
  return (
    <div className="animate-pulse p-1" aria-hidden="true">
      {/* 제목 자리 */}
      <div className="h-6 w-40 rounded bg-[#E8EBF0]" />
      <div className="mt-2 h-3.5 w-64 rounded bg-[#F0F2F5]" />

      {/* 카드 줄 */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[92px] rounded-[10px] border border-[#E8EBF0] bg-white" />
        ))}
      </div>

      {/* 표 자리 */}
      <div className="mt-5 overflow-hidden rounded-[10px] border border-[#E8EBF0] bg-white">
        <div className="h-11 border-b border-[#E8EBF0] bg-[#F8F9FB]" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[#F0F2F5] px-4 py-3.5 last:border-0">
            <div className="h-3.5 w-16 rounded bg-[#F0F2F5]" />
            <div className="h-3.5 w-12 rounded bg-[#F0F2F5]" />
            <div className="h-3.5 flex-1 rounded bg-[#F4F6F9]" />
            <div className="h-3.5 w-20 rounded bg-[#F0F2F5]" />
            <div className="h-3.5 w-14 rounded bg-[#F4F6F9]" />
          </div>
        ))}
      </div>
    </div>
  );
}
