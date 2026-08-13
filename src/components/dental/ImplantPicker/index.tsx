// =========================================================
// 놓을 위치: src/components/dental/ImplantPicker/index.tsx
//
// 임플란트 계단식 선택. (기능명세서 §4.2.4)
//   제조사 → 타입 → 사이즈 · 스크류 → 옵션(자유 입력)
//   상위를 바꾸면 하위가 초기화됩니다.
//   고를 항목이 없는 칸은 비워 둡니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitAddImplantFavorite,
  submitRemoveImplantFavorite,
} from '@/server/actions/implant';
import type { ImplantFavorite } from '@/server/repositories/implant';
import {
  EMPTY_SELECTION,
  getTypes,
  getSizes,
  getScrews,
  selectManufacturer,
  selectType,
  isComplete,
  getMissingStep,
  formatSelection,
  type ImplantCatalog,
  type ImplantOption,
  type ImplantSelection,
} from '@/server/domain/implant';

export interface ImplantPickerProps {
  /** DB 에서 읽어온 마스터. 서버 컴포넌트가 내려줍니다 */
  catalog: ImplantCatalog;
  /** 이 치과가 자주 쓰는 조합. 없으면 빠른 선택 줄이 나오지 않습니다 */
  favorites?: ImplantFavorite[];
  value?: ImplantSelection;
  onChange?: (selection: ImplantSelection) => void;
}

export default function ImplantPicker({
  catalog,
  favorites,
  value = EMPTY_SELECTION,
  onChange,
}: ImplantPickerProps) {
  const [selection, setSelection] = useState<ImplantSelection>(value);

  function update(next: ImplantSelection) {
    setSelection(next);
    onChange?.(next);
  }

  const { manufacturerCode, typeCode } = selection;

  const types = getTypes(catalog, manufacturerCode);
  const sizes = getSizes(catalog, manufacturerCode, typeCode);
  const screws = getScrews(catalog, manufacturerCode, typeCode);

  const complete = isComplete(catalog, selection);
  const missing = getMissingStep(catalog, selection);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {favorites && (
        <FavoriteBar
          favorites={favorites}
          selection={selection}
          complete={complete}
          onPick={(favorite) =>
            update({
              manufacturerCode: favorite.makerCode,
              typeCode: favorite.typeCode,
              sizeCode: favorite.sizeCode,
              screwCode: favorite.screwCode,
              option: selection.option,
            })
          }
        />
      )}

      <div className="grid grid-cols-1 divide-y divide-gray-200 md:grid-cols-5 md:divide-x md:divide-y-0">
        {/* ---------- 제조사 ---------- */}
        <Column
          title="제조사"
          hint={catalog.length === 0 ? '등록된 제조사가 없습니다' : undefined}
        >
          {catalog.map((m) => (
            <Card
              key={m.code}
              name={m.name}
              code={m.code}
              selected={manufacturerCode === m.code}
              onClick={() => update(selectManufacturer(m.code))}
            />
          ))}
        </Column>

        {/* ---------- 타입 ---------- */}
        <Column title="타입" hint={!manufacturerCode ? '제조사를 먼저 고르세요' : undefined}>
          {types.map((t) => (
            <Card
              key={t.code}
              name={t.name}
              code={t.code}
              selected={typeCode === t.code}
              onClick={() => update(selectType(selection, t.code))}
            />
          ))}
        </Column>

        {/* ---------- 사이즈 ---------- */}
        <Column
          title="사이즈"
          hint={
            !typeCode
              ? '타입을 먼저 고르세요'
              : sizes.length === 0
                ? '이 타입은 사이즈 구분이 없습니다'
                : undefined
          }
        >
          {sizes.map((s) => (
            <OptionCard
              key={s.code}
              option={s}
              selected={selection.sizeCode === s.code}
              onClick={() => update({ ...selection, sizeCode: s.code })}
            />
          ))}
        </Column>

        {/* ---------- 스크류 ---------- */}
        <Column
          title="스크류"
          hint={
            !typeCode
              ? '타입을 먼저 고르세요'
              : screws.length === 0
                ? '이 타입은 스크류 구분이 없습니다'
                : undefined
          }
        >
          {screws.map((s) => (
            <OptionCard
              key={s.code}
              option={s}
              selected={selection.screwCode === s.code}
              onClick={() => update({ ...selection, screwCode: s.code })}
            />
          ))}
        </Column>

        {/* ---------- 옵션 (자유 입력) ---------- */}
        <Column title="옵션">
          <input
            type="text"
            value={selection.option}
            placeholder="직접 입력"
            onChange={(e) => update({ ...selection, option: e.target.value })}
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-2 text-[13px] text-gray-400">
            목록 없이 매번 직접 적습니다.
          </p>
        </Column>
      </div>

      {/* ---------- 요약 ---------- */}
      <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
        <span className="font-mono text-sm text-gray-700">
          {formatSelection(catalog, selection) || '선택 없음'}
        </span>
        <span
          className={`text-[14px] ${complete ? 'font-semibold text-green-700' : 'text-gray-400'}`}
        >
          {complete ? '선택 완료' : `${missing} 를 골라 주세요`}
        </span>
      </div>
    </div>
  );
}

// ---------- 빠른 선택 ----------

/**
 * 자주 쓰는 조합을 한 번에 집어넣습니다. (설계서 §4.4 clinic_implant_favorites)
 *
 * ★ 디자인센터가 배포한 항목은 빼는 버튼이 없습니다.
 *   실제 차단은 RLS 가 하고, 여기서는 버튼을 감출 뿐입니다.
 */
function FavoriteBar({
  favorites,
  selection,
  complete,
  onPick,
}: {
  favorites: ImplantFavorite[];
  selection: ImplantSelection;
  complete: boolean;
  onPick: (favorite: ImplantFavorite) => void;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const busy = saving || refreshing;

  // 지금 고른 것이 이미 담겨 있는가
  const alreadySaved = favorites.some(
    (f) =>
      f.makerCode === selection.manufacturerCode &&
      f.typeCode === selection.typeCode &&
      f.sizeCode === selection.sizeCode &&
      f.screwCode === selection.screwCode,
  );

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

  return (
    <div className="border-b border-gray-200 px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-gray-500">자주 쓰는 조합</span>

        {favorites.length === 0 && (
          <span className="text-[13px] text-gray-400">
            아직 없습니다. 아래에서 고른 뒤 담아 두면 다음부터 한 번에 선택됩니다.
          </span>
        )}

        {favorites.map((favorite) => (
          <span
            key={favorite.id}
            className={
              'inline-flex items-center gap-1 rounded-full border py-1 pl-3 text-[13px] ' +
              (favorite.pushed
                ? 'border-purple-300 bg-purple-50 pr-3'
                : 'border-gray-300 bg-white pr-1')
            }
          >
            <button
              type="button"
              onClick={() => onPick(favorite)}
              className="font-semibold text-gray-800 hover:text-blue-700"
            >
              {favorite.label}
            </button>

            {favorite.pushed ? (
              <span className="text-[10px] font-bold text-purple-600">배포</span>
            ) : (
              <button
                type="button"
                onClick={() => run(() => submitRemoveImplantFavorite(favorite.id))}
                disabled={busy}
                aria-label={`${favorite.label} 빼기`}
                className="px-1 text-gray-400 hover:text-red-500"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {complete && !alreadySaved && (
          <button
            type="button"
            onClick={() =>
              run(() =>
                submitAddImplantFavorite({
                  makerCode: selection.manufacturerCode!,
                  typeCode: selection.typeCode!,
                  sizeCode: selection.sizeCode,
                  screwCode: selection.screwCode,
                }),
              )
            }
            disabled={busy}
            className="rounded-full border border-blue-500 px-3 py-1 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            + 지금 조합 담기
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}

// ---------- 칸 ----------

function Column({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 p-4">
      <h3 className="mb-3 text-center text-[14px] font-bold text-gray-800">{title}</h3>
      <div className="flex flex-col gap-2">
        {hint ? <p className="py-3 text-center text-[13px] text-gray-400">{hint}</p> : children}
      </div>
    </div>
  );
}

// ---------- 카드 ----------

function Card({
  name,
  code,
  selected,
  onClick,
}: {
  name: string;
  code: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-400'
      }`}
    >
      <div className="text-[14px]">
        <span className="text-gray-400">이름 : </span>
        <span className="font-semibold text-gray-900">{name}</span>
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-gray-400">코드 : {code}</div>
    </button>
  );
}

function OptionCard({
  option,
  selected,
  onClick,
}: {
  option: ImplantOption;
  selected: boolean;
  onClick: () => void;
}) {
  return <Card name={option.name} code={option.code} selected={selected} onClick={onClick} />;
}
