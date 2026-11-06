// =========================================================
// 놓을 위치: src/server/domain/learn-cases/index.ts
//
// 밤 실행(디자인PC 덴트버드 자동 설계 검토)이 덴플로우 주문에서 **배울 거리**를 고르는 규칙 (2026-11-06).
//
// ★ 사용자 "덴플로우에 올라오는 자연치 케이스 자동으로 학습 가능해? 하루 동안 모아 놨다가 밤작업 누르면
//   진행 — 메모리 쌓이지 않게". 목표는 구치부 브릿지·싱글 100%, 전치부는 안 함.
// ★ 고르는 것: 자연치 크라운(폰틱 포함)·인레이로만 된 주문, 크라운이 하나 이상, 크라운이 모두 구치부(x4~x8).
//   임플란트가 하나라도 있으면 뺍니다. 인레이는 밤 실행이 자연치로 돌려 빼고 크라운만 합니다.
// ★ Next.js 도 Supabase 도 모르는 순수 계산입니다.
// =========================================================

export interface LearnItem {
  tooth: number;
  /** order_items.type_code — crown · inlay · implant · auto_temp … */
  type: string;
  /** 임플란트 칸이 채워져 있으면 true (type 이 crown 이어도 임플란트 위 크라운일 수 있음) */
  implant: boolean;
}

export type Learnable = { ok: true; teeth: number[] } | { ok: false; why: string };

export function isPosterior(tooth: number): boolean {
  const unit = tooth % 10;
  return unit >= 4 && unit <= 8;
}

export function learnable(items: LearnItem[]): Learnable {
  if (!items.length) return { ok: false, why: '치식 없음' };
  if (items.some((i) => i.implant || i.type === 'implant')) return { ok: false, why: '임플란트' };
  const odd = items.filter((i) => i.type !== 'crown' && i.type !== 'inlay');
  if (odd.length) return { ok: false, why: `다른 종류: ${[...new Set(odd.map((i) => i.type))].join(', ')}` };
  const crowns = [...new Set(items.filter((i) => i.type === 'crown').map((i) => i.tooth))].sort((a, b) => a - b);
  if (!crowns.length) return { ok: false, why: '크라운 없음' };
  const front = crowns.filter((t) => !isPosterior(t));
  if (front.length) return { ok: false, why: `전치부: ${front.join(', ')}` };
  return { ok: true, teeth: crowns };
}

export interface LearnFile {
  name: string;
  size: number | null;
}

const MESH = /\.(stl|ply|obj)$/i;

/**
 * 내려받을 스캔 파일. dxd 가 있으면 가장 큰 dxd 하나(밤 실행이 DS Core 로 바꿈),
 * 없으면 가장 큰 zip 하나, 그것도 없으면 stl·ply·obj 전부(밤 실행이 위·아래턱을 고름). 고를 것이 없으면 빈 배열.
 */
export function pickLearnFiles(files: LearnFile[]): LearnFile[] {
  const biggest = (list: LearnFile[]) => [...list].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
  const dxd = files.filter((f) => /\.dxd$/i.test(f.name));
  if (dxd.length) return [biggest(dxd)];
  const zip = files.filter((f) => /\.zip$/i.test(f.name));
  if (zip.length) return [biggest(zip)];
  return files.filter((f) => MESH.test(f.name)).slice(0, 12);
}
