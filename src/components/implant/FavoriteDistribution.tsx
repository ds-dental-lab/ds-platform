// =========================================================
// 놓을 위치: src/components/implant/FavoriteDistribution.tsx
//
// 치과 배포. (설계서 §9.2 치과 배포, §8.3 임플란트 강제 배포)
//   디자인센터가 거래 치과의 즐겨찾기에 조합을 꽂아 둡니다.
//
// ★ 배포한 항목은 치과가 뺄 수 없습니다("강제" 배포).
//   회수는 배포한 디자인센터만 할 수 있고, 실제 차단은 RLS 가 합니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitAddImplantFavorite,
  submitRemoveImplantFavorite,
} from '@/server/actions/implant';
import { getTypes, getSizes, getScrews, type ImplantCatalog } from '@/server/domain/implant';
import type { ImplantFavorite } from '@/server/repositories/implant';
import type { PartnerClinic } from '@/server/repositories/order';

export interface FavoriteDistributionProps {
  catalog: ImplantCatalog;
  clinics: PartnerClinic[];
  /** 지금 고른 치과의 즐겨찾기 */
  favorites: ImplantFavorite[];
  selectedClinicId: string | null;
}

export default function FavoriteDistribution({
  catalog,
  clinics,
  favorites,
  selectedClinicId,
}: FavoriteDistributionProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /**
   * 지우려는 항목. 누르면 바로 안 지우고 한 번 묻습니다.
   *
   * ★ 치과가 담은 것은 **남의 자료**입니다. 배포한 것을 거두는 것과
   *   달리, 지우면 그 치과 화면에서 조합이 사라지고 다시 담아야 합니다.
   */
  const [removing, setRemoving] = useState<ImplantFavorite | null>(null);

  const [makerCode, setMakerCode] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [sizeCode, setSizeCode] = useState('');
  const [screwCode, setScrewCode] = useState('');

  const busy = saving || refreshing;

  const types = getTypes(catalog, makerCode || null);
  const sizes = getSizes(catalog, makerCode || null, typeCode || null);
  const screws = getScrews(catalog, makerCode || null, typeCode || null);

  // 고를 것이 있는데 안 골랐으면 배포할 수 없습니다 (도메인 isComplete 와 같은 규칙)
  const ready =
    Boolean(selectedClinicId) &&
    Boolean(makerCode && typeCode) &&
    (sizes.length === 0 || Boolean(sizeCode)) &&
    (screws.length === 0 || Boolean(screwCode));

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    setSaving(true);
    const result = await action();
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? '처리하지 못했습니다');
      return;
    }
    startTransition(() => router.refresh());
  }

  function selectClinic(id: string) {
    const params = new URLSearchParams();
    if (id) params.set('clinic', id);
    router.push(`/design/implants/distribution?${params.toString()}`);
  }

  return (
    <div>
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <label className="mb-1.5 block text-[13px] font-semibold text-gray-600">치과</label>
        <select
          value={selectedClinicId ?? ''}
          onChange={(e) => selectClinic(e.target.value)}
          className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="">치과를 고르세요</option>
          {clinics.map((clinic) => (
            <option key={clinic.id} value={clinic.id}>
              {clinic.name}
            </option>
          ))}
        </select>

        {clinics.length === 0 && (
          <p className="mt-2 text-[13px] text-gray-400">거래 중인 치과가 없습니다.</p>
        )}
      </div>

      {selectedClinicId && (
        <>
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-bold text-gray-900">배포할 조합 고르기</h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Field label="제조사">
                <select
                  value={makerCode}
                  onChange={(e) => {
                    setMakerCode(e.target.value);
                    setTypeCode('');
                    setSizeCode('');
                    setScrewCode('');
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-2 text-[13px]"
                >
                  <option value="">선택</option>
                  {catalog.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="타입">
                <select
                  value={typeCode}
                  onChange={(e) => {
                    setTypeCode(e.target.value);
                    setSizeCode('');
                    setScrewCode('');
                  }}
                  disabled={!makerCode}
                  className="w-full rounded border border-gray-300 px-2 py-2 text-[13px] disabled:bg-gray-100"
                >
                  <option value="">선택</option>
                  {types.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="사이즈">
                <select
                  value={sizeCode}
                  onChange={(e) => setSizeCode(e.target.value)}
                  disabled={!typeCode || sizes.length === 0}
                  className="w-full rounded border border-gray-300 px-2 py-2 text-[13px] disabled:bg-gray-100"
                >
                  <option value="">{sizes.length === 0 ? '구분 없음' : '선택'}</option>
                  {sizes.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="스크류">
                <select
                  value={screwCode}
                  onChange={(e) => setScrewCode(e.target.value)}
                  disabled={!typeCode || screws.length === 0}
                  className="w-full rounded border border-gray-300 px-2 py-2 text-[13px] disabled:bg-gray-100"
                >
                  <option value="">{screws.length === 0 ? '구분 없음' : '선택'}</option>
                  {screws.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              onClick={() =>
                run(async () => {
                  const result = await submitAddImplantFavorite(
                    {
                      makerCode,
                      typeCode,
                      sizeCode: sizeCode || null,
                      screwCode: screwCode || null,
                    },
                    selectedClinicId,
                  );
                  if (result.ok) {
                    setMakerCode('');
                    setTypeCode('');
                    setSizeCode('');
                    setScrewCode('');
                  }
                  return result;
                })
              }
              disabled={busy || !ready}
              className="mt-4 rounded bg-purple-600 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {busy ? '처리 중…' : '이 치과에 배포'}
            </button>

            {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-white">
            <h2 className="border-b border-gray-200 px-5 py-3 text-sm font-bold text-gray-900">
              이 치과의 즐겨찾기
            </h2>

            {favorites.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">아직 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {favorites.map((favorite) => (
                  <li
                    key={favorite.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]"
                  >
                    <span className="font-mono text-gray-900">{favorite.label}</span>

                    <span
                      className={
                        'rounded px-2 py-0.5 text-[11px] font-semibold ' +
                        (favorite.pushed
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-gray-100 text-gray-500')
                      }
                    >
                      {favorite.pushed ? '배포' : '치과가 담음'}
                    </span>

                    {/*
                      ★ 치과가 담은 것도 뺄 수 있습니다 (사용자 요청 2026-08-13).
                        임플란트 마스터를 쥔 쪽은 디자인센터입니다. 치과가
                        단종된 픽스처나 잘못된 조합을 담아 두면 그 조합으로
                        주문이 들어오고, 전화가 오는 곳도 디자인센터입니다.

                      ★ 말은 나눕니다. 내가 보낸 것을 거두는 '회수' 와
                        남이 담은 것을 지우는 '삭제' 는 다른 일입니다.
                    */}
                    <button
                      onClick={() => setRemoving(favorite)}
                      disabled={busy}
                      className="ml-auto text-[12px] text-gray-400 hover:text-red-600"
                    >
                      {favorite.pushed ? '회수' : '삭제'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {removing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[380px] rounded-xl bg-white p-6">
            <h3 className="text-[15px] font-bold text-[#1A2130]">
              {removing.pushed ? '이 배포를 거둘까요?' : '이 조합을 지울까요?'}
            </h3>

            <p className="mt-2 rounded-md bg-[#F4F6F9] px-3 py-2 font-mono text-[12.5px] text-[#4A5567]">
              {removing.label}
            </p>

            {/*
              ★ 치과가 담은 것은 남의 자료입니다. 지우면 그 치과 화면에서
                사라지고 다시 담아야 합니다 — 그 사실을 적어 둡니다.
            */}
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#4A5567]">
              {removing.pushed
                ? '이 치과의 목록에서 빠집니다. 필요하면 다시 배포할 수 있습니다.'
                : '치과가 직접 담은 조합입니다. 지우면 그 치과가 다시 담아야 합니다.'}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className="h-10 flex-1 rounded-md border border-[#DDE2EA] text-[13px] text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await run(() => submitRemoveImplantFavorite(removing.id));
                  setRemoving(null);
                }}
                className="h-10 flex-1 rounded-md bg-[#D8453F] text-[13px] font-bold text-white hover:bg-[#C13B36] disabled:bg-[#D5DAE2]"
              >
                {removing.pushed ? '회수' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  );
}
