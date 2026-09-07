// =========================================================
// 놓을 위치: src/components/chat/MobileChatList.tsx
//
// 폰의 대화방 목록 — 카톡의 채팅방 목록 자리. (사용자 요청 2026-09-06)
//
// ★ 방 이름은 **환자 이름**입니다. 주문번호로는 누구 이야기인지 눈이
//   안 갑니다 (HOME 띠에서 이미 배운 것). 부제에 치과(센터)·주문번호.
// ★ 안 읽은 수는 카톡처럼 오른쪽 아래 빨간 동그라미. 방 순서는 마지막
//   글 시각 그대로 — 안 읽은 방을 위로 끌어올리지 않습니다.
// ★ 시계는 화면이 안 읽습니다 — 서버가 지금 시각을 넘겨주고, 오늘/어제는
//   **폰의 시간대**로 셉니다 (그래서 client). 서버는 UTC 라 자정 근처가 틀립니다.
// =========================================================

'use client';

import Link from 'next/link';
import { roomStamp, type ChatRoom } from '@/server/domain/chat-room';
import AutoRefresh from '@/components/layout/AutoRefresh';

export default function MobileChatList({
  rooms,
  now,
  backHref,
  backLabel,
}: {
  rooms: ChatRoom[];
  /** 서버의 지금 — 오늘/어제 판단용 */
  now: string;
  backHref: string;
  backLabel: string;
}) {
  const clock = new Date(now);

  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-5 pb-10 pt-5">
      {/* 새 글이 오면 목록도 따라옵니다 — 방 순서·미리보기·안 읽은 수 */}
      <AutoRefresh everySec={15} />

      <Link href={backHref} className="inline-flex items-center gap-1.5 text-[14px] text-[var(--muted)]">
        <span aria-hidden="true">&#8249;</span> {backLabel}
      </Link>

      <h1 className="mt-4 text-[23px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">대화</h1>

      {rooms.length === 0 ? (
        <p className="mt-14 text-center text-[14px] text-[var(--muted)]">
          아직 대화가 없습니다.
          <br />
          <span className="text-[12.5px]">주문 화면의 대화창에서 시작됩니다.</span>
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line)] overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(22,50,79,0.06)]">
          {rooms.map((room) => (
            <li key={room.orderId}>
              <Link
                href={`/m/chats/${room.orderId}`}
                className="flex items-center gap-3 px-4 py-3.5 active:bg-[#F7FAFC]"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--mist)] text-[16px] font-extrabold text-[#0E9384]"
                  aria-hidden="true"
                >
                  {room.patientLabel.slice(0, 1)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <b
                      className={
                        'truncate text-[15.5px] ' +
                        (room.unread > 0 ? 'font-extrabold text-[var(--ink)]' : 'font-bold text-[var(--ink)]')
                      }
                    >
                      {room.patientLabel}
                    </b>
                    <span className="truncate text-[12px] text-[#9FB0C0]">{room.counterpart}</span>
                  </span>
                  <span
                    className={
                      'mt-0.5 block truncate text-[13px] ' +
                      (room.unread > 0 ? 'font-semibold text-[var(--ink)]' : 'text-[var(--muted)]')
                    }
                  >
                    {room.preview || ' '}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11.5px] tabular-nums text-[#9FB0C0]">
                    {roomStamp(room.lastAt, clock)}
                  </span>
                  {room.unread > 0 && (
                    <span className="min-w-[20px] rounded-full bg-[#D8453F] px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">
                      {room.unread > 99 ? '99+' : room.unread}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
