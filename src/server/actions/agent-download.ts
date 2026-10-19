// =========================================================
// 놓을 위치: src/server/actions/agent-download.ts
//
// 에이전트 zip 내려받기 — 여섯 자리 번호가 맞을 때만 (사용자 결정 2026-10-19).
//
// ★ 저장소 버킷은 비공개입니다(migration 20261019120000). 번호가 맞으면
//   **1분짜리 서명 주소**를 내줍니다 — 주소가 어디 적혀도 1분 뒤엔 죽습니다.
// ★ 틀리면 1.5초 기다렸다 답합니다 — 여섯 자리를 기계로 돌려 보는 것을 느리게.
//   서버리스라 횟수 세기는 믿을 수 없어서 시간으로 막습니다.
// ★ 로그인은 안 봅니다 — 치과 PC 에서 사장님이 열어 번호만 넣습니다.
// =========================================================

'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { AGENT_BUCKET, AGENT_ZIP_NAME, pinMatches } from '@/server/domain/agent';

const TTL_SECONDS = 60;
const WRONG_DELAY_MS = 1500;

export type AgentDownloadResult = { ok: true; url: string } | { ok: false; error: string };

export async function requestAgentDownload(pin: string): Promise<AgentDownloadResult> {
  if (!pinMatches(pin, process.env.AGENT_DOWNLOAD_PIN)) {
    await new Promise((r) => setTimeout(r, WRONG_DELAY_MS));
    return { ok: false, error: '번호가 맞지 않습니다.' };
  }

  const admin = createAdminClient();
  // ★ 받는 파일 이름은 영문입니다 — 한글은 저장소가 두 번 인코딩해 "%EB%8D…zip" 으로 저장됩니다(실측)
  const { data, error } = await admin.storage.from(AGENT_BUCKET).createSignedUrl(AGENT_ZIP_NAME, TTL_SECONDS, {
    download: 'denflow-agent.zip',
  });
  if (error || !data?.signedUrl) {
    return { ok: false, error: '지금은 내려받을 수 없습니다. 잠시 뒤 다시 해 주세요.' };
  }
  return { ok: true, url: data.signedUrl };
}
