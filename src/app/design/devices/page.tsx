// =========================================================
// 놓을 위치: src/app/design/devices/page.tsx
//
// 기기 상태판 — 치과 PC·설계 PC 가 잘 도는지 (사용자 요청 2026-10-16).
//
// ★ 센터 관리자만 봅니다(메뉴 결정). 꺼짐 알림은 센터 전체에 갑니다.
// ★ 급한 것이 위로: 꺼짐 → 확인 필요 → 정상 → 옛 판.
// ★ 30초마다 저절로 다시 그립니다(TickRefresh) — 켜 두고 보는 화면입니다.
// =========================================================

import { requireManagerSector } from '@/server/policies/session';
import { deviceBoard } from '@/server/repositories/device-health';
import { deviceState, stateLabel, staleWatchers, versionBehind, type DeviceState } from '@/server/domain/device-health';
import { AGENT_VERSION } from '@/server/domain/agent';
import TickRefresh from '@/components/layout/TickRefresh';

export const dynamic = 'force-dynamic';

const TONE: Record<DeviceState, { dot: string; chip: string; ink: string }> = {
  offline: { dot: '#D64545', chip: '#FDECEA', ink: '#A32F2F' },
  warn: { dot: '#E09A1B', chip: '#FFF6E5', ink: '#8A5A12' },
  ok: { dot: '#12855B', chip: '#E7F5EE', ink: '#0E6B49' },
  legacy: { dot: '#B6BECC', chip: '#F2F4F7', ink: '#5B6577' },
};
const ORDER: Record<DeviceState, number> = { offline: 0, warn: 1, ok: 2, legacy: 3 };

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
    .map((d) => ({ ...d, state: deviceState(d, now) }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.orgName.localeCompare(b.orgName, 'ko'));

  const count = (s: DeviceState) => rows.filter((r) => r.state === s).length;

  return (
    <div className="mx-auto max-w-[1100px] pb-10">
      <TickRefresh everySec={30} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#1A2130]">기기 상태</h1>
          <p className="mt-1 text-[13px] text-[#7C8595]">
            치과 PC(덴플로우 에이전트)와 설계 PC 가 잘 도는지. 새 판은 1분마다 상태를 보냅니다 · 최신 판 {AGENT_VERSION}
          </p>
        </div>
        <div className="flex gap-2 text-[12.5px]">
          {(['offline', 'warn', 'ok', 'legacy'] as const).map((s) => (
            <span
              key={s}
              className="rounded-full px-2.5 py-1 font-semibold"
              style={{ background: TONE[s].chip, color: TONE[s].ink }}
            >
              {stateLabel(s).split(' — ')[0]} {count(s)}
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-[#E8EBF0] bg-white p-8 text-center text-[13.5px] text-[#98A2B3]">
          연결된 기기가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((d) => {
            const tone = TONE[d.state];
            const isDesign = d.orgType === 'design_center' || d.status.kind === 'design';
            const stale = staleWatchers(d.status.watchers);
            return (
              <li
                key={d.id}
                className="rounded-xl border bg-white p-4"
                style={{ borderColor: d.state === 'ok' || d.state === 'legacy' ? '#E8EBF0' : tone.dot }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone.dot }} aria-hidden="true" />
                  <b className="text-[15px] font-bold tracking-[-0.02em] text-[#1A2130]">{d.orgName}</b>
                  <span className="text-[13px] text-[#4A5567]">{d.name}</span>
                  <span className="rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#4A5567]">
                    {isDesign ? '설계 PC' : '치과 PC'}
                  </span>
                  <span
                    className="ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-bold"
                    style={{ background: tone.chip, color: tone.ink }}
                  >
                    {stateLabel(d.state)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[#4A5567]">
                  <span>
                    마지막 소식 <b className="font-semibold text-[#1A2130]">{ago(d.heartbeatAt ?? d.lastSeenAt, now)}</b>
                  </span>
                  <span>
                    판 <b className="font-semibold text-[#1A2130]">{d.version ?? '—'}</b>
                    {versionBehind(d.version, AGENT_VERSION) ? (
                      <span className="ml-1 text-[#E09A1B]">(최신 {AGENT_VERSION})</span>
                    ) : null}
                  </span>
                  {d.status.printer?.kind && d.status.printer.kind !== 'mock' ? (
                    <span>
                      프린터{' '}
                      <b className="font-semibold" style={{ color: d.status.printer.ok === false ? '#A32F2F' : '#1A2130' }}>
                        {d.status.printer.ok === false ? '연결 안 됨' : '연결됨'}
                      </b>
                      {d.status.printer.ip ? <span className="text-[#98A2B3]"> · {d.status.printer.ip}</span> : null}
                    </span>
                  ) : null}
                  {d.status.folderOk === false ? (
                    <span className="font-semibold text-[#A32F2F]">스캔 감시 폴더 없음</span>
                  ) : null}
                  {d.status.dentbird ? (
                    <span>
                      덴트버드 창 <b className="font-semibold text-[#1A2130]">{d.status.dentbird}</b>
                    </span>
                  ) : null}
                  {d.status.missing?.length ? (
                    <span className="font-semibold text-[#A32F2F]">빠진 것: {d.status.missing.join(' · ')}</span>
                  ) : null}
                  {stale.length ? (
                    <span className="font-semibold text-[#A32F2F]">멈춘 프로그램: {stale.join(', ')}</span>
                  ) : null}
                  {d.status.doing ? <span>지금 {d.status.doing}</span> : null}
                </div>

                {d.events.length ? (
                  <ul className="mt-2.5 space-y-1 rounded-lg bg-[#F8F9FB] p-2.5">
                    {d.events.map((e, i) => (
                      <li key={i} className="flex gap-2 text-[12px]">
                        <span className="shrink-0 tabular-nums text-[#98A2B3]">{clock(e.at)}</span>
                        <span style={{ color: e.level === 'error' ? '#A32F2F' : e.level === 'warn' ? '#8A5A12' : '#4A5567' }}>
                          {e.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
