// =========================================================
// 놓을 위치: src/components/layout/NotificationBell.tsx
//
// 상단바의 알림. 누르면 목록이 펼쳐집니다.
// 알림을 누르면 읽음 처리하고 해당 주문으로 갑니다.
// =========================================================

'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/server/actions/notification';
import { formatDateTime } from '@/lib/format/date';
import UnreadPing, {
  isPingSoundOn,
  pingSoundDefault,
  setPingSound,
  subscribePingSound,
} from '@/components/layout/UnreadPing';
import type { NotificationRow } from '@/server/repositories/notification';

export interface NotificationBellProps {
  notifications: NotificationRow[];
  unreadCount: number;
}

export default function NotificationBell({
  notifications,
  unreadCount,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  // 서버에서는 localStorage 를 못 읽습니다 — 두 값을 갈라 받습니다
  const sound = useSyncExternalStore(
    subscribePingSound,
    isPingSoundOn,
    pingSoundDefault,
  );

  function handleClick(notification: NotificationRow) {
    setOpen(false);

    startTransition(async () => {
      if (!notification.read_at) await markNotificationRead(notification.id);
      if (notification.link) router.push(notification.link);
      else router.refresh();
    });
  }

  return (
    <div className="relative">
      {/* 탭 제목과 소리. 그리는 것이 없습니다 */}
      <UnreadPing unreadCount={unreadCount} />

      <button
        onClick={() => setOpen(!open)}
        aria-label={unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}건` : '알림'}
        className="relative grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md text-[#98A2B3] hover:bg-[#F4F6F9] hover:text-[#4A5567]"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M10 3a4.5 4.5 0 0 0-4.5 4.5v3L4 13h12l-1.5-2.5v-3A4.5 4.5 0 0 0 10 3Z" />
          <path d="M8.2 15.5a1.9 1.9 0 0 0 3.6 0" />
        </svg>

        {/*
          ★ 점이 아니라 숫자입니다 (2026-08-13).
            대화가 알림을 만들기 시작하면서 종이 실제로 자주 울립니다.
            점만 있으면 "뭔가 있다" 까지만 알고, 두 건인지 열 건인지를
            열어 봐야 압니다. 열어 보게 만드는 것이 점의 목적이지만,
            매번 열게 하면 결국 안 열어 봅니다.
        */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full border border-white bg-[#E5484D] px-[3px] text-[9.5px] font-extrabold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫힙니다 */}
          <button
            aria-label="알림 닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-[#E8EBF0] bg-white shadow-lg">
            <div className="flex items-center gap-3 border-b border-[#E8EBF0] px-4 py-2.5">
              <span className="text-[13px] font-bold text-[#1A2130]">알림</span>

              {/*
                ★ 못 끄는 소리는 결국 스피커를 끄게 만듭니다.
                  그러면 정작 필요한 때 못 듣습니다. 여기서 끕니다.
              */}
              <button
                onClick={() => setPingSound(!sound)}
                title={sound ? '새 알림에 소리가 납니다' : '소리가 꺼져 있습니다'}
                className="ml-auto text-[12px] text-[#98A2B3] hover:text-[#4A5567]"
              >
                소리 {sound ? '켬' : '끔'}
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={() =>
                    startTransition(async () => {
                      await markAllNotificationsRead();
                      setOpen(false);
                    })
                  }
                  className="shrink-0 text-[12px] text-[#98A2B3] hover:text-[#4A5567]"
                >
                  전부 읽음
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-gray-400">
                아직 알림이 없습니다.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      onClick={() => handleClick(notification)}
                      className={
                        'block w-full px-4 py-3 text-left hover:bg-[#F4F6F9] ' +
                        (notification.read_at ? 'opacity-60' : '')
                      }
                    >
                      <div className="flex items-start gap-2">
                        {!notification.read_at && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[#1A2130]">
                            {notification.title}
                          </p>
                          {notification.body && (
                            <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-[#4A5567]">
                              {notification.body}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-[#98A2B3]">
                            {formatDateTime(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
