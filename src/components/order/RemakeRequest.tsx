// =========================================================
// 놓을 위치: src/components/order/RemakeRequest.tsx
//
// 리메이크 요청. (설계서 §2.1 C-3, Q-12, Q-15 · 사용자가 준 화면)
//
// 세 칸으로 묻습니다.
//   ① 다시 만들 치식   원주문 치아만 켜지는 치식도
//   ② 요청시한        일반 주문과 같은 규칙, 신청일 기준으로 다시 잡습니다
//   ③ 스캔 데이터      이전 것 그대로 / 새로 촬영 (Q-12)
//
// ★ 치식도로 고릅니다. 목록 체크박스가 아니라.
//   원장은 입 안 위치로 기억합니다 — '45번' 이라는 글자보다
//   아래턱 왼쪽 어디쯤이라는 그림이 먼저 떠오릅니다.
//
// ★ 고른 치아는 보철과 쉐이드를 바꿀 수 있습니다.
//   같은 걸 다시 만드는 게 대부분이지만, 색이 안 맞아 다시 만드는 경우
//   쉐이드를 바꿔야 하고, 재료를 올려 다시 만드는 경우도 있습니다.
//   안 건드리면 '그대로' 로 두어 원주문 값이 그대로 넘어갑니다.
//
// ★ 보철을 바꾸면 차액이 생깁니다.
//   리메이크 자체는 청구되지 않지만(is_billable=false), 사양을 올리면
//   그 차이는 받아야 합니다. 지금은 단가표가 없어 금액을 셈하지 못하고,
//   바뀐 사실만 주문서에 남겨 둡니다 — 원주문 항목과 견주면 뽑힙니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitRemake } from '@/server/actions/remake';
import { uploadOrderFiles } from '@/lib/upload';
import UploadToast, { type UploadState } from '@/components/order/UploadToast';
import ScanDropZone from '@/components/order/ScanDropZone';
import ShadeDialog from '@/components/order/ShadeDialog';
import DueDatePicker from '@/components/order/DueDatePicker';
import type { HolidayMap } from '@/server/domain/holiday';
import ToothPickRow from '@/components/dental/ToothChart/ToothPickRow';
import { getMaterials, type ProsthesisCatalog, changeOptions, specLabel } from '@/server/domain/prosthesis';
import { formatShade, type ToothShade, type ShadeSystemCode } from '@/server/domain/shade';
import {
  canRequestRemakeAsAny,
  type OrderStatus,
  type Sector,
} from '@/server/domain/order-status';
import type { OrderDetailItem, OrderDetailFile } from '@/server/repositories/order';
import type { IsoDate } from '@/server/domain/week';

/** 치아 하나의 '바꿀 것'. 비어 있으면 그대로 갑니다 */
interface Draft {
  typeCode?: string;
  materialCode?: string;
  shadeSystem?: ShadeSystemCode;
  shade?: ToothShade;
}

export interface RemakeRequestProps {
  orderId: string;
  status: OrderStatus;
  items: OrderDetailItem[];
  scanFiles: OrderDetailFile[];
  today: IsoDate;
  defaultDue: IsoDate;
  /** 쉬는 날. 요청시한 달력이 이걸로 막습니다 */
  holidays?: HolidayMap;
  prosthesisCatalog: ProsthesisCatalog;
  /** 이 주문에서 내가 맡은 자리들. 치과와 디자인센터가 넣습니다 */
  roles: Sector[];
  /** 만든 뒤 어디로 갈지 */
  basePath?: string;
}

export default function RemakeRequest({
  orderId,
  status,
  items,
  scanFiles,
  today,
  defaultDue,
  holidays = {},
  prosthesisCatalog,
  roles,
  basePath = '/clinic/orders',
}: RemakeRequestProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [dueDate, setDueDate] = useState<IsoDate>(defaultDue);
  const [scanMode, setScanMode] = useState<'reuse' | 'new'>('new');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [shadeFor, setShadeFor] = useState<OrderDetailItem | null>(null);
  /** 오른쪽 위 업로드 알림 */
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [error, setError] = useState('');

  if (!canRequestRemakeAsAny(status, roles)) return null;

  const busy = saving || pending;

  // 폰틱은 따로 만드는 물건이 아니라 지대치에 붙어 갑니다 — 고르는 대상에서 뺍니다
  const pickable = items.filter((i) => !i.is_pontic);
  const availableTeeth = pickable.map((i) => i.tooth_number);
  const chosen = pickable.filter((i) => picked.includes(i.tooth_number));

  const hasFiles = scanMode === 'reuse' ? scanFiles.length > 0 : newFiles.length > 0;
  const ready = chosen.length > 0 && notes.trim().length > 0 && hasFiles;

  /** 보철을 바꾼 치아가 있는가 — 차액 안내를 띄울지 정합니다 */
  const specChanged = chosen.some((item) => {
    const d = drafts[item.id];
    return d?.typeCode || d?.materialCode;
  });

  function openDialog() {
    setPicked(availableTeeth);      // 전부 다시 만드는 쪽이 흔합니다
    setDrafts({});
    setDueDate(defaultDue);
    setScanMode(scanFiles.length > 0 ? 'reuse' : 'new');
    setNewFiles([]);
    setNotes('');
    setError('');
    setOpen(true);
  }

  function toggleTooth(tooth: number) {
    setPicked((prev) =>
      prev.includes(tooth) ? prev.filter((t) => t !== tooth) : [...prev, tooth],
    );
  }

  function patch(itemId: string, next: Draft) {
    setDrafts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...next } }));
  }

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const changes = chosen
      .map((item) => {
        const d = drafts[item.id];
        if (!d) return null;

        return {
          itemId: item.id,
          typeCode: d.typeCode,
          materialCode: d.materialCode,
          shadeSystem: d.shadeSystem,
          ...(d.shade
            ? { shadeCervical: d.shade.cervical, shadeIncisal: d.shade.incisal }
            : {}),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const result = await submitRemake({
      orderId,
      itemIds: chosen.map((i) => i.id),
      changes,
      dueDate,
      notes,
      reuseFileIds: scanMode === 'reuse' ? scanFiles.map((f) => f.id) : [],
      willUploadNew: scanMode === 'new' && newFiles.length > 0,
    });

    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }

    if (scanMode === 'new' && newFiles.length > 0) {
      setProgress('파일 올리는 중…');

      const upload = await uploadOrderFiles(result.orderId, newFiles, (progress) =>
        setUpload({ phase: 'uploading', progress }),
      );

      setProgress('');
      setUpload(
        upload.ok
          ? { phase: 'done', total: newFiles.length }
          : { phase: 'failed', total: newFiles.length, failed: upload.failed },
      );

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
      router.push(`${basePath}/${result.orderId}`);
      router.refresh();
    });
  }

  return (
    <>
      <UploadToast state={upload} onClose={() => setUpload(null)} />

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
          <div className="flex max-h-[92vh] w-full max-w-[880px] flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center gap-2.5 px-6 pb-2 pt-5">
              <h3 className="text-[17px] font-extrabold tracking-[-0.035em] text-[#1A2130]">
                리메이크 요청
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="grid h-7 w-7 place-items-center rounded text-[#98A2B3] hover:bg-[#F4F6F9]"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-3">
              {/* ---------- ① 치식 ---------- */}
              <section>
                <SectionTitle no="①">다시 만들 치식을 선택하세요</SectionTitle>

                <ToothPickRow
                  available={availableTeeth}
                  selected={picked}
                  onToggle={toggleTooth}
                />

                <p className="mt-2 text-[13.5px] text-[#4A5567]">
                  {chosen.length === 0 ? (
                    <span className="text-[#C4383A]">치식을 하나 이상 골라 주세요</span>
                  ) : (
                    <>
                      <b className="font-bold">{chosen.length}개 치식 선택됨</b>
                      <span className="text-[#98A2B3]">
                        {' '}
                        — 필요하면 아래에서 보철과 쉐이드를 바꿀 수 있습니다
                      </span>
                    </>
                  )}
                </p>

                {/* 고른 치아별로 보철·쉐이드 */}
                {chosen.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {chosen.map((item) => {
                      const d = drafts[item.id] ?? {};
                      const typeCode = d.typeCode ?? item.type_code;
                      const materials = getMaterials(prosthesisCatalog, typeCode);
                      const changed = Boolean(d.typeCode || d.materialCode);

                      const shadeText = d.shade
                        ? formatShade(d.shade) || '없음'
                        : formatShade({
                            cervical: item.shade_cervical,
                            incisal: item.shade_incisal,
                          }) || '없음';

                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-end gap-3 rounded-lg border border-[#E8EBF0] px-4 py-3"
                        >
                          <span className="grid h-[38px] w-[46px] shrink-0 place-items-center rounded-md bg-[#F4F6F9] text-[14px] font-bold tabular-nums text-[#1A2130]">
                            {item.tooth_number}
                          </span>

                          <label className="min-w-[220px] flex-1">
                            <span className="mb-1 block text-[12.5px] font-semibold text-[#98A2B3]">
                              보철
                            </span>
                            <select
                              value={
                                changed ? `${typeCode}|${d.materialCode ?? materials[0]?.code}` : ''
                              }
                              onChange={(e) => {
                                if (!e.target.value) {
                                  setDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[item.id]?.typeCode;
                                    delete next[item.id]?.materialCode;
                                    if (next[item.id] && Object.keys(next[item.id]).length === 0) {
                                      delete next[item.id];
                                    }
                                    return { ...next };
                                  });
                                  return;
                                }
                                const [t, m] = e.target.value.split('|');
                                patch(item.id, { typeCode: t, materialCode: m });
                              }}
                              className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-[14px] outline-none focus:border-[#1279E8]"
                            >
                              {/*
                                ★ '그대로' 옆에 **지금 무엇인지**를 적습니다
                                  (사용자 결정 2026-08-12). 그냥 '그대로' 라고만
                                  두면 그게 무엇인지 위 글자를 다시 읽어야 합니다.
                              */}
                              <option value="">
                                그대로 ({specLabel(prosthesisCatalog, item.type_code, item.material_code)})
                              </option>

                              {/*
                                ★ 지금과 똑같은 것은 목록에 없습니다.
                                  다만 임플란트는 남습니다 — 같은 지르코니아라도
                                  스크류 구멍 유무가 다릅니다 (domain/prosthesis).
                              */}
                              {changeOptions(prosthesisCatalog, item.type_code, item.material_code).map(
                                (opt) => (
                                  <option
                                    key={`${opt.typeCode}|${opt.materialCode}`}
                                    value={`${opt.typeCode}|${opt.materialCode}`}
                                  >
                                    {opt.label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <label className="min-w-[180px] flex-1">
                            <span className="mb-1 block text-[12.5px] font-semibold text-[#98A2B3]">
                              쉐이드
                            </span>
                            <button
                              type="button"
                              onClick={() => setShadeFor(item)}
                              className="h-10 w-full rounded-md border border-[#DDE2EA] px-2.5 text-left text-[14px] hover:border-[#1279E8]"
                            >
                              {d.shade ? (
                                <b className="font-semibold text-[#1279E8]">{shadeText}</b>
                              ) : (
                                <span className="text-[#4A5567]">그대로 ({shadeText})</span>
                              )}
                            </button>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ★ 사양을 올리면 리메이크라도 그 차이는 받습니다 */}
                {specChanged && (
                  <p className="mt-2.5 rounded-md border border-[#F5D9A8] bg-[#FDF6E8] px-3.5 py-2.5 text-[13.5px] font-semibold text-[#8A5A00]">
                    보철을 바꾸면 원래 주문과의 <b>차액이 청구</b>됩니다. 리메이크 자체는 청구되지
                    않습니다.
                  </p>
                )}
              </section>

              {/* ---------- ② 요청시한 ---------- */}
              <section>
                <SectionTitle no="②">요청시한</SectionTitle>
                <DueDatePicker value={dueDate} today={today} holidays={holidays} onChange={setDueDate} />
                <p className="mt-2 text-[13.5px] text-[#98A2B3]">
                  일반 주문과 같은 기준입니다. 기본값은 주문일 포함 워킹데이 5일째입니다.
                </p>
              </section>

              {/* ---------- ③ 스캔 데이터 ---------- */}
              <section>
                <SectionTitle no="③">스캔 데이터</SectionTitle>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ScanCard
                    on={scanMode === 'reuse'}
                    disabled={scanFiles.length === 0}
                    onClick={() => setScanMode('reuse')}
                    icon={<ReuseIcon />}
                    title="이전 스캔 그대로 사용"
                    desc={
                      scanFiles.length > 0
                        ? `${scanFiles.length}개 파일 재사용`
                        : '원주문에 스캔 파일이 없습니다'
                    }
                  />

                  <ScanCard
                    on={scanMode === 'new'}
                    onClick={() => setScanMode('new')}
                    icon={<UploadIcon />}
                    title="새로 촬영해서 올리기"
                    desc="파일을 선택하거나 끌어 놓으세요"
                  />
                </div>

                {scanMode === 'new' && (
                  <div className="mt-3">
                    <ScanDropZone files={newFiles} onChange={setNewFiles} disabled={busy} />
                  </div>
                )}

                {!hasFiles && (
                  <p className="mt-2 text-[13px] text-[#C4383A]">
                    이전 스캔을 쓰거나 새 파일을 올려주세요.
                  </p>
                )}
              </section>

              {/* ---------- 사유 ---------- */}
              <section>
                <SectionTitle no="④">왜 다시 만드나요</SectionTitle>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="예) 컨택이 너무 강해 들어가지 않습니다. 근심측을 줄여 주세요."
                  className="w-full rounded-md border border-[#DDE2EA] px-3 py-2 text-[14px] outline-none focus:border-[#1279E8]"
                />
              </section>

              {progress && <p className="text-[13.5px] text-[#1279E8]">{progress}</p>}
              {error && <p className="text-[13.5px] text-[#D8453F]">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#E8EBF0] px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-[38px] rounded-md border border-[#DDE2EA] px-5 text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy || !ready}
                className="h-[38px] rounded-md bg-[#1279E8] px-6 text-[13.5px] font-bold text-white hover:bg-[#1554C8] disabled:cursor-not-allowed disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
              >
                {busy ? '처리 중…' : '리메이크 신청'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 쉐이드 변경 — 주문등록과 같은 창을 씁니다 */}
      {shadeFor && (
        <ShadeDialog
          title={`${shadeFor.tooth_number}번 쉐이드 변경`}
          keepLabel="그대로 두기"
          system={
            (drafts[shadeFor.id]?.shadeSystem ??
              shadeFor.shade_system ??
              'vita_classic') as ShadeSystemCode
          }
          shade={
            drafts[shadeFor.id]?.shade ?? {
              cervical: shadeFor.shade_cervical,
              incisal: shadeFor.shade_incisal,
            }
          }
          onApply={(sys, next) => patch(shadeFor.id, { shadeSystem: sys, shade: next })}
          onClose={() => setShadeFor(null)}
        />
      )}
    </>
  );
}

// ---------- 조각들 ----------

function SectionTitle({ no, children }: { no: string; children: React.ReactNode }) {
  return (
    <h4 className="mb-2.5 flex items-center gap-1.5 text-[13.5px] font-bold text-[#1A2130]">
      <span className="text-[#98A2B3]">{no}</span>
      {children}
    </h4>
  );
}

function ScanCard({
  on,
  disabled,
  onClick,
  icon,
  title,
  desc,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors ' +
        (disabled
          ? 'cursor-not-allowed border-[#EEF1F5] bg-white opacity-60'
          : on
            ? 'border-[#1279E8] bg-[#F2F7FE]'
            : 'border-[#E8EBF0] bg-white hover:border-[#98A2B3]')
      }
    >
      <span
        className={
          'grid h-9 w-9 shrink-0 place-items-center rounded-full ' +
          (on ? 'bg-[#1279E8] text-white' : 'bg-[#F4F6F9] text-[#98A2B3]')
        }
      >
        {icon}
      </span>

      <span className="min-w-0">
        <b className="block text-[14px] font-bold text-[#1A2130]">{title}</b>
        <span className="block text-[12.5px] text-[#98A2B3]">{desc}</span>
      </span>
    </button>
  );
}

function RemakeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6.4h8a3.4 3.4 0 0 1 0 6.8H5.4" />
      <path d="M5.6 3.8 3 6.4l2.6 2.6" />
    </svg>
  );
}

function ReuseIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 10a6.5 6.5 0 1 1 2 4.7" />
      <path d="M3.2 6.2v3.9h3.9" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14V4M6.2 7.8 10 4l3.8 3.8" />
    </svg>
  );
}
