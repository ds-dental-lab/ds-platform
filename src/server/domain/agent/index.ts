// =========================================================
// 놓을 위치: src/server/domain/agent/index.ts
//
// 덴플로우 에이전트의 판 번호 (사용자 요청 2026-10-06).
//
// ★ 왜 필요한가 — 에이전트는 치과 PC 에 **복사해 둔 폴더**입니다. 고쳐도
//   저절로 안 바뀝니다. 치과가 한두 곳일 때는 USB 로 되지만, 늘면 어느
//   치과가 어느 판인지 아무도 모르게 됩니다.
//
// ★ **저절로 받지 않습니다.** "새 판이 있습니다" 만 알리고, 받는 것은
//   사람이 누릅니다. 치과 PC 에서 프로그램이 저 혼자 바뀌는 것은
//   좋지 않습니다 — 스캔이 안 올라가는 날 원인을 못 찾습니다.
//
// ★ Next.js 도 Supabase 도 모르는 순수 계산입니다.
// =========================================================

/**
 * 지금 내보낸 판.
 *
 * ★ 에이전트를 고쳐 새로 빌드할 때마다 **여기를 올립니다.**
 *   올리고 배포하면 치과 에이전트에 "새 판이 있습니다" 가 뜹니다.
 *   scan_agent.py 의 AGENT_VERSION 과 같아야 합니다.
 */
export const AGENT_VERSION = '1.3.22';

/** 무엇이 바뀌었는지 한 줄. 에이전트 알림에 그대로 뜹니다 */
export const AGENT_NOTE = '스스로 업데이트됩니다 — 출력·스캔이 없을 때 새 판으로 저절로 바뀝니다';

/**
 * 받는 곳 — 안내 화면입니다.
 *
 * ★ zip 을 바로 가리키지 않습니다. **켜져 있는 폴더는 덮어쓸 수 없습니다** —
 *   그냥 받으면 치과가 압축을 풀다 막힙니다. 끝내고·덮고·켜는 세 걸음을
 *   읽고 받게 합니다.
 */
export const AGENT_DOWNLOAD_URL = 'https://denflow.kr/agent';

/** 실제 zip 이 놓이는 자리. release.py 가 여기로 올립니다 */
export const AGENT_BUCKET = 'agent-release';
export const AGENT_ZIP_NAME = 'latest.zip';
export const AGENT_ZIP_PATH = `${AGENT_BUCKET}/${AGENT_ZIP_NAME}`;

/**
 * 스스로 업데이트 (사용자 2026-10-24 — "계속 다운로드 말고 최신 버전 있으면 자동 업데이트").
 *
 * ★ 안내 파일 둘 — release.py 가 올립니다.
 *   · beta.json   — 올릴 때마다 바뀜. **시험 PC 만** 받습니다
 *   · stable.json — 사장님이 시험 PC 에서 확인하고 `release.py --promote` 로 올린 판. 치과가 받습니다
 *   잘못 만든 판이 모든 치과에 한꺼번에 퍼져 같이 멈추는 것을 막는 문입니다.
 * ★ 시험 PC 는 기기 id 로 정합니다(사장님 PC 의 치ㅣ 에이전트).
 */
export const AGENT_BETA_DEVICE_IDS: readonly string[] = ['4a00a20d-4bc8-42a9-b5e0-c2e1e0aa7285'];

export interface AgentManifest {
  version: string;
  sha256: string;
  file: string;
}

export function manifestFor(deviceId: string): 'beta.json' | 'stable.json' {
  return AGENT_BETA_DEVICE_IDS.includes(deviceId) ? 'beta.json' : 'stable.json';
}

/** 안내 파일을 믿을 만한 모양인지 — 판 번호·sha256(64자)·같은 버킷 안 zip 이름 */
export function parseManifest(raw: unknown): AgentManifest | null {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const version = cleanVersion(m.version);
  const sha256 = typeof m.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(m.sha256) ? m.sha256.toLowerCase() : null;
  const file = typeof m.file === 'string' && /^\d+(\.\d+){1,3}\.zip$/.test(m.file) ? m.file : null;
  return version && sha256 && file ? { version, sha256, file } : null;
}

/**
 * 내려받기 번호 — 여섯 자리 고정 비밀번호 (사용자 결정 2026-10-19).
 *
 * ★★ 왜 공개를 닫았나 — "다른 회사가 치과로 가입해서 받아 갈 수 있다". 로그인은
 *   울타리가 못 됩니다(치과 계정은 누구나 만듭니다). 번호는 **센터만 압니다** —
 *   설치는 사장님이 직접 가거나 원격으로 해 주기로 했으니 번호가 돌아다닐 일이 없습니다.
 * ★ 번호는 코드에 없습니다 — 환경 변수 AGENT_DOWNLOAD_PIN. 여기는 **견주는 법**만 둡니다.
 * ★ 길이가 달라도 끝까지 견줍니다 — 몇 자리에서 틀렸는지 시간으로 새지 않게.
 */
export const AGENT_PIN_LENGTH = 6;

export function pinMatches(input: unknown, secret: string | undefined): boolean {
  if (typeof input !== 'string' || !secret) return false;
  const a = input.trim();
  if (!/^\d{6}$/.test(a) || !/^\d{6}$/.test(secret)) return false;
  let diff = 0;
  for (let i = 0; i < AGENT_PIN_LENGTH; i += 1) diff |= a.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

/**
 * 판 번호를 견줍니다.
 *
 * ★ 글자로 비교하면 '1.10.0' 이 '1.9.0' 보다 작아집니다. 숫자로 나눠 봅니다.
 * ★ 모양이 이상하면 **알리지 않습니다.** 잘못 알리느니 조용한 쪽이 낫습니다 —
 *   멀쩡한 치과에 "새 판이 있습니다" 가 계속 뜨면 그 알림을 아무도 안 믿습니다.
 */
export function olderThan(theirs: string, latest: string): boolean {
  const parse = (v: string): number[] | null => {
    const parts = v.trim().split('.');
    if (parts.length < 2 || parts.length > 4) return null;
    const nums = parts.map((p) => Number(p));
    return nums.every((n) => Number.isInteger(n) && n >= 0) ? nums : null;
  };

  const a = parse(theirs);
  const b = parse(latest);
  if (!a || !b) return false;

  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

export interface AgentUpdate {
  latest: string;
  note: string;
  url: string;
  /** 새 판이 있는가. 같은 판이거나 모양이 이상하면 false */
  outdated: boolean;
}

export function agentUpdate(theirs: unknown): AgentUpdate {
  const mine = typeof theirs === 'string' ? theirs : '';
  return {
    latest: AGENT_VERSION,
    note: AGENT_NOTE,
    url: AGENT_DOWNLOAD_URL,
    outdated: olderThan(mine, AGENT_VERSION),
  };
}

/** 표에 적을 판 번호. 이상한 값을 그대로 넣지 않습니다 */
export function cleanVersion(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return /^\d{1,3}(\.\d{1,3}){1,3}$/.test(t) ? t : null;
}
