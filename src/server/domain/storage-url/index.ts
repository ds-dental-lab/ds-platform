// =========================================================
// 놓을 위치: src/server/domain/storage-url/index.ts
//
// 서명 주소에 '이 이름으로 내려받기' 를 붙입니다 (2026-09-22).
//
// ★ supabase-js 의 createSignedUrl(path, ttl, { download: 이름 }) 은 이름을
//   **두 번** 인코딩합니다. 저장소가 한 번만 풀어 머리글에 넣으므로
//   '23,24 지그.stl' 이 '23%2C24 %EC%A7%80…stl' 이라는 파일로 내려받아졌습니다
//   (사용자 제보 — "44%2C45 %EC%A7%80…" 로 저장됨).
//   그래서 download 없이 주소만 받고, 이름은 여기서 **한 번만** 인코딩해 붙입니다.
//   저장소는 filename*=UTF-8'' 로 돌려주고 브라우저가 한글·쉼표를 그대로 씁니다.
// =========================================================

export function withDownloadName(signedUrl: string, fileName: string): string {
  const sep = signedUrl.includes('?') ? '&' : '?';
  return `${signedUrl}${sep}download=${encodeURIComponent(fileName)}`;
}
