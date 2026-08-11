// =========================================================
// 놓을 위치: src/components/order/RemakeRequest.tsx
//
// 리메이크 신청. (설계서 §2.1 C-3, Q-12, Q-15)
//   배송·완료 상태에서만 나타납니다 — 리페어와 같은 시점입니다.
//
// 다시 만들 보철물을 고르고, 왜 다시 만드는지 적고, 스캔 파일을 정합니다.
//
// ★ 스캔 파일은 재사용과 신규 업로드를 함께 받습니다 (Q-12).
//   본은 그대로인데 색만 틀린 경우가 흔해 원주문 파일을 다시 쓰고,
//   본을 다시 뜬 경우에는 새로 올립니다. 둘 다 비면 막습니다 —
//   디자인센터가 열어 볼 것이 없는 주문이 되기 때문입니다.
//
// ★ 신규 파일은 주문이 만들어진 뒤에 올립니다.
//   파일은 order_id 아래에 놓이므로 주문이 먼저 있어야 합니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitRemake } from '@/server/actions/remake';
import { uploadOrderFiles } from '@/lib/upload';
import ScanDropZone from '@/components/order/ScanDropZone';
import { buildAbbr } from '@/server/domain/prosthesis';
import { canRequestRemake, type OrderStatus } from '@/server/domain/order-status';
import type { OrderDetailItem, OrderDetailFile } from '@/server/repositories/order';

export interface RemakeRequestProps {
  orderId: string;
  status: OrderStatus;
  items: OrderDetailItem[];
  /** 원주문의 스캔 파일. 골라서 그대로 씁니다 */
  scanFiles: OrderDetailFile[];
}

export default function RemakeRequest({
  orderId,
  status,
  items,
  scanFiles,
}: RemakeRequestProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [reuse, setReuse] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!canRequestRemake(status, 'clinic')) return null;

  const busy = saving || pending;
  const hasFiles = reuse.length > 0 || newFiles.length > 0;
  const ready = selected.length > 0 && notes.trim().length > 0 && hasFiles;

  function toggle(list: string[], setList: (next: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function openDialog() {
    // 처음 열 때는 전부 다시 만드는 쪽이 흔해 기본으로 골라 둡니다
    setSelected(items.map((i) => i.id));
    setReuse([]);
    setNewFiles([]);
    setNotes('');
    setError('');
    setOpen(true);
  }

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const result = await submitRemake({
      orderId,
      itemIds: selected,
      notes,
      reuseFileIds: reuse,
      willUploadNew: newFiles.length > 0,
    });

    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }

    // 새 주문이 생겼으니 이제 새 파일을 올립니다
    if (newFiles.length > 0) {
      setProgress('파일 올리는 중…');

      const upload = await uploadOrderFiles(result.orderId, newFiles, (done, total) => {
        setProgress(`파일 올리는 중 ${done} / ${total}`);
      });

      setProgress('');

      if (!upload.ok) {
        setSaving(false);
        setError(
          `리메이크(${result.orderNo})는 만들어졌습니다. 다만 파일 ${upload.failed.length}개를 올리지 못했습니다. 새 주문에서 다시 올려 주세요.`,
        );
        return;
      }
    }

    setSaving(false);
    setOpen(false);

    startTransition(() => {
      router.push(`/clinic/orders/${result.orderId}`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE2EA] px-4 py-2.5 text-[13.5px] font-semibold text-[#4A5567] hover:border-[#1279E8] hover:text-[#1279E8]"
      >
        <RemakeIcon />
        리메이크 요청
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col rounded-xl bg-white shadow-xl">
            <div className="px-6 pb-2 pt-5">
              <h3 className="text-[16px] font-bold tracking-tight text-[#1A2130]">
                리메이크 요청
              </h3>
              <p className="mt-1.5 text-[12.5px] text-[#98A2B3]">
                고른 보철물로 새 주문이 만들어져 디자인부터 다시 진행됩니다. 이 건은 청구되지
                않습니다.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-3">
              {/* 다시 만들 보철물 */}
              <div>
                <p className="mb-2 text-[13px] font-bold text-[#1A2130]">
                  다시 만들 보철물
                  <span className="ml-1.5 font-normal text-[#98A2B3]">
                    일부만 골라도 됩니다
                  </span>
                </p>

                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[#E8EBF0] px-3 py-2 text-[13px] hover:border-[#1279E8]">
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={() => toggle(selected, setSelected, item.id)}
                          className="h-4 w-4"
                        />
                        <b className="font-semibold text-[#1A2130]">{item.tooth_number}</b>
                        <span className="text-[#4A5567]">
                          {buildAbbr(item.type_code, item.material_code)}
                        </span>
                        {item.is_pontic && (
                          <span className="text-[11.5px] text-[#98A2B3]">폰틱</span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 스캔 파일 */}
              <div>
                <p className="mb-2 text-[13px] font-bold text-[#1A2130]">
                  스캔 파일
                  <span className="ml-1.5 font-normal text-[#98A2B3]">
                    원주문 파일을 쓰거나 새로 올립니다
                  </span>
                </p>

                {scanFiles.length > 0 ? (
                  <ul className="mb-2 space-y-1.5">
                    {scanFiles.map((file) => (
                      <li key={file.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[#E8EBF0] px-3 py-2 text-[12.5px] hover:border-[#1279E8]">
                          <input
                            type="checkbox"
                            checked={reuse.includes(file.id)}
                            onChange={() => toggle(reuse, setReuse, file.id)}
                            className="h-4 w-4"
                          />
                          <span className="min-w-0 flex-1 truncate text-[#4A5567]">
                            {file.file_name}
                          </span>
                          <span className="shrink-0 text-[11.5px] text-[#C4CBD6]">재사용</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-2 text-[12.5px] text-[#98A2B3]">
                    원주문에 스캔 파일이 없습니다. 새로 올려 주세요.
                  </p>
                )}

                <ScanDropZone files={newFiles} onChange={setNewFiles} disabled={busy} />

                {!hasFiles && (
                  <p className="mt-2 text-[12px] text-[#E09A1B]">
                    파일을 하나 이상 정해야 합니다. 디자인센터가 열어 볼 것이 없습니다.
                  </p>
                )}
              </div>

              {/* 사유 */}
              <div>
                <p className="mb-2 text-[13px] font-bold text-[#1A2130]">왜 다시 만드나요</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="예) 컨택이 너무 강해 들어가지 않습니다. 근심측을 줄여 주세요."
                  className="w-full rounded-md border border-[#DDE2EA] px-3 py-2 text-[13px] outline-none focus:border-[#1279E8]"
                />
              </div>

              {progress && <p className="text-[12.5px] text-[#1279E8]">{progress}</p>}
              {error && <p className="text-[12.5px] text-[#D8453F]">{error}</p>}
            </div>

            <div className="flex gap-2 border-t border-[#E8EBF0] px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-11 rounded-md border border-[#DDE2EA] px-5 text-[13.5px] text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy || !ready}
                className="h-11 flex-1 rounded-md bg-[#1279E8] text-[14px] font-bold text-white hover:bg-[#0F68C9] disabled:cursor-not-allowed disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
              >
                {busy ? '처리 중…' : '리메이크 요청'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RemakeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6.4h8a3.4 3.4 0 0 1 0 6.8H5.4" />
      <path d="M5.6 3.8 3 6.4l2.6 2.6" />
    </svg>
  );
}
