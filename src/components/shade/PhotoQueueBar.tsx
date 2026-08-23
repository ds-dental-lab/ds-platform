// =========================================================
// 놓을 위치: src/components/shade/PhotoQueueBar.tsx
//
// 못 보낸 사진을 다시 보냅니다. (명세서 §5 · 엣지케이스)
//
// ★★ 진료실 화면 위에 늘 떠 있습니다. 사진이 폰에 남아 있는 동안은
//   **보이는 곳에** 있어야 합니다 — 안 보이면 아무도 다시 안 보냅니다.
//
// ★ 연결이 돌아오면 저절로 보냅니다. 사람이 챙겨야 하는 안전망은
//   안전망이 아닙니다.
//
// ★ 다섯 번 실패하면 멈추고 사람에게 보여 줍니다. 연결 문제가 아니라
//   다른 사정입니다 — 조용히 계속 두드리면 배터리만 먹습니다.
// =========================================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadOrderFiles } from '@/lib/upload';
import { uploadUnsortedPhotos } from '@/lib/upload-unsorted';
import { submitShadePhotoAdded } from '@/server/actions/shade-photo';
import { listQueue, dropFromQueue, markTried, fileOf, type QueuedPhoto } from '@/lib/photo-queue';
import { shouldRetry, queueLabel } from '@/server/domain/shade-photo';

export default function PhotoQueueBar() {
  const router = useRouter();
  const [items, setItems] = useState<QueuedPhoto[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await listQueue());
  }, []);

  const send = useCallback(async () => {
    if (busy) return;
    setBusy(true);

    const queue = await listQueue();
    let sent = 0;

    for (const item of queue) {
      if (!shouldRetry(item.tries)) continue;

      const file = fileOf(item);

      /*
        ★ 한 장씩 보냅니다. 묶어 보내면 한 장이 실패할 때 나머지도
          같이 되돌아옵니다 — 큐에서는 되도록 하나라도 더 보내는 편이
          낫습니다.

        ★★ 쉐이드라 **안 줄입니다** (compress: false).
      */
      const result = item.orderId
        ? await uploadOrderFiles(item.orderId, [file], undefined, 'scan', { compress: false })
        : item.clinicOrgId
          ? await uploadUnsortedPhotos(item.clinicOrgId, [file])
          : null;

      if (result && result.ok) {
        await dropFromQueue(item.id);
        if (item.orderId) await submitShadePhotoAdded(item.orderId, 1);
        sent += 1;
      } else {
        const reason =
          (result && 'failures' in result && result.failures[0]?.reason) ||
          (result && 'reason' in result && result.reason) ||
          '보내지 못했습니다';

        await markTried(item, String(reason));
      }
    }

    setBusy(false);
    await refresh();

    if (sent > 0) router.refresh();
  }, [busy, refresh, router]);

  useEffect(() => {
    let alive = true;

    /*
      ★ 화면을 열 때와 **연결이 돌아올 때** 스스로 보냅니다.
        진료실에서 와이파이가 돌아온 것을 사람이 알아채고 버튼을
        누를 거라 기대하면 안 됩니다.

      ★ 효과 안에서 **곧바로** 상태를 건드리지 않습니다. 먼저 큐를
        읽고(그 사이에 한 박자 쉽니다) 그다음에 보냅니다 —
        eslint 가 잡아 줬습니다.
    */
    void (async () => {
      await refresh();
      if (alive) await send();
    })();

    const onOnline = () => void send();
    window.addEventListener('online', onOnline);

    return () => {
      alive = false;
      window.removeEventListener('online', onOnline);
    };
    // ★ 처음 한 번만. send 가 바뀔 때마다 다시 보내면 안 됩니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) return null;

  const waiting = items.filter((i) => shouldRetry(i.tries)).length;
  const stuck = items.length - waiting;

  return (
    <div className="sticky top-0 z-30 -mx-5 mb-3 border-b border-[#F5DCA9] bg-[#FFF8EC] px-5 py-2.5">
      <div className="mx-auto flex max-w-[480px] items-center gap-2.5">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
          <path
            d="M12 19.5V6M6.5 11.5 12 6l5.5 5.5"
            stroke="#B45309"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="min-w-0 flex-1 text-[13px] font-bold text-[#B45309]">
          {busy ? '사진을 보내는 중…' : queueLabel(waiting, stuck)}
          {!busy && stuck > 0 && (
            <span className="ml-1.5 block text-[11.5px] font-normal text-[#96703A]">
              {items.find((i) => !shouldRetry(i.tries))?.lastReason}
            </span>
          )}
        </span>

        {!busy && (
          <button
            type="button"
            onClick={() => void send()}
            className="shrink-0 rounded-lg bg-[#B45309] px-3 py-1.5 text-[12.5px] font-bold text-white"
          >
            다시 보내기
          </button>
        )}
      </div>
    </div>
  );
}
