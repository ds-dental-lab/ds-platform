// =========================================================
// 놓을 위치: src/lib/format/date.ts
//
// DB 는 UTC 로 저장하고, 화면에는 KST 로 보여줍니다. (설계서 §4.1)
// =========================================================

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
