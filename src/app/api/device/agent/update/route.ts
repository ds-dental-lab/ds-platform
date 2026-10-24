// =========================================================
// 놓을 위치: src/app/api/device/agent/update/route.ts
//
// 에이전트 스스로 업데이트 — "내가 받을 판" 을 묻는 곳 (사용자 2026-10-24).
//
// ★ 연결된 기기만(기기 열쇠). 다운로드 번호 없이 받습니다 — 이미 우리가 깔아 준 PC 입니다.
// ★ 시험 PC 는 beta.json, 치과는 stable.json (domain/agent manifestFor). 안내 파일이 없으면
//   { ok: true, version: null } — 받을 판이 없다는 뜻입니다.
// ★ zip 은 5분짜리 서명 주소로 — 우리 서버를 안 지나갑니다. 지문(sha256)을 같이 줘서
//   에이전트가 받은 뒤 맞는지 봅니다.
// =========================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { deviceFromToken } from '@/server/repositories/device-link';
import { AGENT_BUCKET, manifestFor, parseManifest } from '@/server/domain/agent';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401, headers: NO_STORE });

  const admin = createAdminClient();
  const { data: blob } = await admin.storage.from(AGENT_BUCKET).download(manifestFor(device.id));
  if (!blob) return Response.json({ ok: true, version: null }, { headers: NO_STORE });

  let manifest = null;
  try {
    manifest = parseManifest(JSON.parse(await blob.text()));
  } catch {
    manifest = null;
  }
  if (!manifest) return Response.json({ ok: true, version: null }, { headers: NO_STORE });

  const { data: signed } = await admin.storage.from(AGENT_BUCKET).createSignedUrl(manifest.file, 300);
  if (!signed?.signedUrl) return Response.json({ ok: false, error: '받을 주소를 못 만들었습니다' }, { status: 500, headers: NO_STORE });

  return Response.json(
    { ok: true, version: manifest.version, sha256: manifest.sha256, url: signed.signedUrl },
    { headers: NO_STORE },
  );
}
