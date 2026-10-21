// =========================================================
// 놓을 위치: src/app/design/devices/page.tsx
//
// 기기 상태판 — 치과 PC·설계 PC 가 잘 도는지 (사용자 요청 2026-10-16).
//
// ★ 센터 관리자만 봅니다(메뉴 결정). 꺼짐 알림은 센터 전체에 갑니다.
// ★ 30초마다 저절로 다시 그립니다(TickRefresh) — 켜 두고 보는 화면입니다.
// ★★ 단순하게 (사용자 2026-10-21 "어지럽구나"). 묶음은 셋 — 문제 / 정상 / 옛 판.
//   정상인 기기는 한 줄로 끝나고, 지난 기록은 접습니다. 설계 기기는 **서버 PC** 와
//   **디자인 PC** 로 갈라 적습니다 (domain/device-health 의 deviceRole).
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { deviceBoard } from '@/server/repositories/device-health';
import {
  deviceGroup,
  deviceRole,
  deviceState,
  ROLE_LABEL,
  splitEvents,
  staleWatchers,
  stateLabel,
  versionBehind,
  type DeviceGroup,
  type DeviceRole,
  type DeviceState,
} from '@/server/domain/device-health';
import { AGENT_VERSION } from '@/server/domain/agent';
import TickRefresh from '@/components/layout/TickRefresh';

export const dynamic = 'force-dynamic';

const TONE: Record<DeviceState, { dot: string; chip: string; ink: string }> = {
  offline: { dot: '#D64545', chip: '#FDECEA', ink: '#A32F2F' },
  warn: { dot: '#E09A1B', chip: '#FFF6E5', ink: '#8A5A12' },
  ok: { dot: '#12855B', chip: '#E7F5EE', ink: '#0E6B49' },
  legacy: { dot: '#B6BECC', chip: '#F2F4F7', ink: '#5B6577' },
};
const STATE_ORDER: Record<DeviceState, number> = { offline: 0, warn: 1, ok: 2, legacy: 3 };
// 서버 PC 가 맨 위 — 설계가 거기서 돕니다
const ROLE_ORDER: Record<DeviceRole, number> = { server: 0, design: 1, clinic: 2 };

const GROUP: Record<DeviceGroup, { title: string; ink: string }> = {
  trouble: { title: '문제', ink: '#A32F2F' },
  fine: { title: '정상', ink: '#0E6B49' },
  legacy: { title: '옛 판 — 상태를 안 보냄', ink: '#5B6577' },
};

function ago(iso: string | null, now: number): string {
  if (!iso) return '소식 없음';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export default async function DesignDevicesPage() {
  await requireManagerSector('design_center');
  const board = await deviceBoard();
  const now = board.now;
  const rows = board.rows
    .map((d) => {
      const state = deviceState(d, now);
      return { ...d, state, role: deviceRole(d), group: deviceGroup(state) };
    })
    .sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        a.orgName.localeCompare(b.orgName, 'ko'),
    );

  const groups = (['trouble', 'fine', 'legacy'] as const).map((g) => ({ key: g, items: rows.filter((r) => r.group === g) }));
  const trouble = rows.filter((r) => r.group === 'trouble').length;

  return (
    <div className="mx-auto max-w-[900px] pb-10">
      <TickRefresh everySec={30} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#1A2130]">기기 상태</h1>
          <p className="mt-1 text-[13px] text-[#7C8595]">
            {trouble === 0 ? '모두 정상입니다.' : `${trouble}대를 봐 주세요.`} 최신 판 {AGENT_VERSION}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-[#E8EBF0] bg-white p-8 text-center text-[13.5px] text-[#98A2B3]">
          연결된 기기가 없습니다.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(({ key, items }) =>
            items.length === 0 ? null : (
              <section key={key}>
                <h2 className="mb-2 text-[12.5px] font-bold" style={{ color: GROUP[key].ink }}>
                  {GROUP[key].title} {items.length}
                </h2>
                <ul className="space-y-2">
                  {items.map((d) => {
                    const tone = TONE[d.state];
                    const stale = staleWatchers(d.status.watchers);
                    const { shown, folded } = splitEvents(d.events, d.state, now);
                    // 문제가 있을 때만 그 까닭을 한 줄로 — 정상이면 아무 말 없음
                    const why: string[] = [];
                    if (d.status.missing?.length) why.push(`빠진 것: ${d.status.missing.join(' · ')}`);
                    if (stale.length) why.push(`멈춘 프로그램: ${stale.join(', ')}`);
                    if (d.status.printer?.ok === false) why.push('프린터 연결 안 됨');
                    if (d.status.folderOk === false) why.push('스캔 감시 폴더 없음');
                    const behind = versionBehind(d.version, AGENT_VERSION);

                    return (
                      <li
                        key={d.id}
                        className="rounded-xl border bg-white px-4 py-3"
                        style={{ borderColor: key === 'trouble' ? tone.dot : '#E8EBF0' }}
                      >
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone.dot }} aria-hidden="true" />
                          <span className="rounded-md bg-[#1A2130] px-1.5 py-0.5 text-[11.5px] font-bold text-white">
                            {ROLE_LABEL[d.role]}
                          </span>
                          <b className="text-[14.5px] font-bold tracking-[-0.02em] text-[#1A2130]">
                            {d.role === 'clinic' ? d.orgName : d.status.host ?? d.name}
                          </b>
                          <span className="text-[12.5px] text-[#7C8595]">{ago(d.heartbeatAt ?? d.lastSeenAt, now)}</span>
                          {d.status.printer?.kind && d.status.printer.kind !== 'mock' && d.status.printer.ok !== false ? (
                            <span className="text-[12.5px] text-[#7C8595]">· 프린터 연결됨</span>
                          ) : null}
                          {behind ? <span className="text-[12px] text-[#E09A1B]">· 판 {d.version} (최신 {AGENT_VERSION})</span> : null}
                          <span
                            className="ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-bold"
                            style={{ background: tone.chip, color: tone.ink }}
                          >
                            {stateLabel(d.state).split(' — ')[0]}
                          </span>
                        </div>

                        {why.length ? (
                          <p className="mt-1.5 text-[12.5px] font-semibold text-[#A32F2F]">{why.join(' · ')}</p>
                        ) : null}

                        {shown.map((e, i) => (
                          <p key={i} className="mt-1.5 flex gap-2 text-[12.5px]">
                            <span className="shrink-0 tabular-nums text-[#98A2B3]">{clock(e.at)}</span>
                            <span style={{ color: e.level === 'error' ? '#A32F2F' : e.level === 'warn' ? '#8A5A12' : '#4A5567' }}>
                              {e.message}
                            </span>
                          </p>
                        ))}

                        {folded.length ? (
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-[12px] text-[#98A2B3]">지난 기록 {folded.length}</summary>
                            <ul className="mt-1.5 space-y-1 rounded-lg bg-[#F8F9FB] p-2.5">
                              {folded.map((e, i) => (
                                <li key={i} className="flex gap-2 text-[12px] text-[#7C8595]">
                                  <span className="shrink-0 tabular-nums text-[#B6BECC]">{clock(e.at)}</span>
                                  <span>{e.message}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
