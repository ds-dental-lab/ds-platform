// =========================================================
// 놓을 위치: src/components/implant/ImplantMasterEditor.tsx
//
// 임플란트 마스터 관리. (설계서 §9.2 임플란트 마스터)
//   제조사 → 타입 → 사이즈 · 스크류 를 왼쪽부터 좁혀 갑니다.
//   주문등록의 ImplantPicker 와 같은 순서로 보여, 편집 결과가
//   치과 화면에서 어떻게 보일지 그대로 짐작할 수 있게 했습니다.
// =========================================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  submitAddImplantNode,
  submitRenameImplantNode,
  submitDeactivateImplantNode,
} from '@/server/actions/implant';
import { getTypes, getSizes, getScrews, type ImplantCatalog } from '@/server/domain/implant';
import type { ImplantNode } from '@/server/services/implant';

interface Item {
  code: string;
  name: string;
}

export default function ImplantMasterEditor({ catalog }: { catalog: ImplantCatalog }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [makerCode, setMakerCode] = useState<string | null>(null);
  const [typeCode, setTypeCode] = useState<string | null>(null);

  const busy = saving || refreshing;

  const types = getTypes(catalog, makerCode);
  const sizes = getSizes(catalog, makerCode, typeCode);
  const screws = getScrews(catalog, makerCode, typeCode);

  // 고른 항목이 사라졌으면(비활성 처리 등) 선택을 놓습니다
  const liveMaker = catalog.some((m) => m.code === makerCode) ? makerCode : null;
  const liveType = types.some((t) => t.code === typeCode) ? typeCode : null;

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    setSaving(true);
    const result = await action();
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? '처리하지 못했습니다');
      return false;
    }

    startTransition(() => router.refresh());
    return true;
  }

  const add = (node: ImplantNode, name: string, parentCode?: string) =>
    run(() => submitAddImplantNode(node, name, parentCode));

  const rename = (node: ImplantNode, code: string, name: string) =>
    run(() => submitRenameImplantNode(node, code, name));

  const deactivate = (node: ImplantNode, code: string) =>
    run(() => submitDeactivateImplantNode(node, code));

  return (
    <div>
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2.5 text-[14px] text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Column
          title="제조사"
          items={catalog.map(({ code, name }) => ({ code, name }))}
          selected={liveMaker}
          onSelect={(code) => {
            setMakerCode(code);
            setTypeCode(null);
          }}
          onAdd={(name) => add('maker', name)}
          onRename={(code, name) => rename('maker', code, name)}
          onDeactivate={(code) => deactivate('maker', code)}
          busy={busy}
        />

        <Column
          title="타입"
          items={types.map(({ code, name }) => ({ code, name }))}
          selected={liveType}
          onSelect={setTypeCode}
          onAdd={(name) => add('type', name, liveMaker ?? undefined)}
          onRename={(code, name) => rename('type', code, name)}
          onDeactivate={(code) => deactivate('type', code)}
          hint={!liveMaker ? '제조사를 먼저 고르세요' : undefined}
          busy={busy}
        />

        <Column
          title="사이즈"
          items={sizes.map(({ code, name }) => ({ code, name }))}
          onAdd={(name) => add('size', name, liveType ?? undefined)}
          onRename={(code, name) => rename('size', code, name)}
          onDeactivate={(code) => deactivate('size', code)}
          hint={!liveType ? '타입을 먼저 고르세요' : undefined}
          note="비워 두면 주문 화면에서 사이즈 칸이 사라집니다"
          busy={busy}
        />

        <Column
          title="스크류"
          items={screws.map(({ code, name }) => ({ code, name }))}
          onAdd={(name) => add('screw', name, liveType ?? undefined)}
          onRename={(code, name) => rename('screw', code, name)}
          onDeactivate={(code) => deactivate('screw', code)}
          hint={!liveType ? '타입을 먼저 고르세요' : undefined}
          busy={busy}
        />
      </div>
    </div>
  );
}

// ---------- 한 칸 ----------

function Column({
  title,
  items,
  selected,
  onSelect,
  onAdd,
  onRename,
  onDeactivate,
  hint,
  note,
  busy,
}: {
  title: string;
  items: Item[];
  selected?: string | null;
  onSelect?: (code: string) => void;
  onAdd: (name: string) => Promise<boolean>;
  onRename: (code: string, name: string) => Promise<boolean>;
  onDeactivate: (code: string) => Promise<boolean>;
  hint?: string;
  note?: string;
  busy: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  async function handleAdd() {
    if (!draft.trim()) return;
    if (await onAdd(draft)) setDraft('');
  }

  async function handleRename(code: string) {
    if (await onRename(code, editName)) setEditing(null);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-[14px] font-bold text-gray-800">{title}</h2>

      {hint ? (
        <p className="py-6 text-center text-[13px] text-gray-400">{hint}</p>
      ) : (
        <>
          <ul className="mb-3 flex flex-col gap-1.5">
            {items.length === 0 && (
              <li className="py-3 text-center text-[13px] text-gray-400">아직 없습니다</li>
            )}

            {items.map((item) => (
              <li key={item.code}>
                {editing === item.code ? (
                  <div className="flex gap-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(item.code)}
                      autoFocus
                      className="min-w-0 flex-1 rounded border border-blue-400 px-2 py-1.5 text-[14px] outline-none"
                    />
                    <button
                      onClick={() => handleRename(item.code)}
                      disabled={busy}
                      className="rounded bg-blue-600 px-2 py-1 text-[13px] font-semibold text-white"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="rounded border border-gray-300 px-2 py-1 text-[13px] text-gray-600"
                    >
                      취소
                    </button>
                  </div>
                ) : confirming === item.code ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2">
                    <p className="text-[13px] text-red-800">
                      목록에서 내립니다. 이미 이 값으로 등록된 주문은 그대로 남습니다.
                    </p>
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={async () => {
                          if (await onDeactivate(item.code)) setConfirming(null);
                        }}
                        disabled={busy}
                        className="rounded bg-red-600 px-2.5 py-1 text-[13px] font-semibold text-white"
                      >
                        내리기
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="rounded border border-gray-300 bg-white px-2.5 py-1 text-[13px] text-gray-600"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      'group flex items-center gap-1 rounded-md border px-2.5 py-2 ' +
                      (selected === item.code
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-400')
                    }
                  >
                    <button
                      onClick={() => onSelect?.(item.code)}
                      disabled={!onSelect}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <span className="block truncate text-[14px] font-semibold text-gray-900">
                        {item.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-gray-400">
                        {item.code}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setEditing(item.code);
                        setEditName(item.name);
                      }}
                      aria-label={`${item.name} 이름 바꾸기`}
                      className="shrink-0 px-1 text-[11px] text-gray-400 hover:text-blue-600"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => setConfirming(item.code)}
                      aria-label={`${item.name} 내리기`}
                      className="shrink-0 px-1 text-[11px] text-gray-400 hover:text-red-600"
                    >
                      내리기
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex gap-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="새 이름"
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-[14px] outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={busy || !draft.trim()}
              className="shrink-0 rounded bg-gray-800 px-3 py-1.5 text-[13px] font-semibold text-white disabled:bg-gray-300"
            >
              추가
            </button>
          </div>

          {note && <p className="mt-2 text-[11px] text-gray-400">{note}</p>}
        </>
      )}
    </div>
  );
}
