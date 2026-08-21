// =========================================================
// 놓을 위치: src/server/domain/hangul/index.ts
//
// 초성으로 이름 찾기. (명세서 SPEC_shade-photo S1 — "ㄱㅁㅅ → 김민서")
//
// ★★ **왜 필요한가.** 진료실에서 환자 이름을 다 치고 있을 수 없습니다.
//   'ㄱㅁㅅ' 세 글자면 김민서가 나와야 합니다. 3탭 안에 촬영까지
//   가야 하는데, 이름 치는 데 다섯 번 두드리면 그 흐름이 깨집니다.
//
// ★★ **화면에서 거릅니다, DB 가 아니라.**
//   명세의 API 스케치는 "초성 검색 서버 처리" 라고 적었지만, 진료실
//   홈은 **최근 7일 · 백 줄 남짓**입니다. 그것을 브라우저가 거르면
//   글자를 칠 때마다 즉시 좁혀집니다 — 서버에 물으면 한 글자마다
//   왕복이 생기고, 그게 진료실에서는 느림으로 느껴집니다.
//   목록이 커지면 그때 옮기면 됩니다.
// =========================================================

/** 한글 첫소리 열아홉. 유니코드 순서 그대로여야 합니다 */
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const HANGUL_START = 0xac00; // '가'
const HANGUL_END = 0xd7a3; // '힣'
const JUNG_JONG = 21 * 28; // 한 첫소리가 차지하는 글자 수

/**
 * 된소리를 예사소리로.
 *
 * ★ 자판에서 ㄲ 을 치려면 시프트를 눌러야 합니다. 급한 사람은 ㄱ 만
 *   칩니다 — 'ㄱㅅ' 로 '까치' 를 찾을 수 있어야 합니다.
 *   반대는 안 합니다(ㄲ 을 친 사람은 ㄲ 을 찾는 것입니다).
 */
const SOFTEN: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' };

/** 그 글자의 첫소리. 한글이 아니면 그대로 돌려줍니다 */
export function initialOf(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return ch;

  return CHOSUNG[Math.floor((code - HANGUL_START) / JUNG_JONG)];
}

/** '김민서' → 'ㄱㅁㅅ' */
export function initials(text: string): string {
  return [...text].map(initialOf).join('');
}

/** 찾는 말이 첫소리로만 되어 있는가 — 'ㄱㅁㅅ' 은 그렇고 '김ㅁ' 은 아닙니다 */
export function isChosungQuery(query: string): boolean {
  const clean = query.replace(/\s/g, '');
  if (clean.length === 0) return false;

  return [...clean].every((c) => CHOSUNG.includes(c));
}

/**
 * 찾는 글자 하나가 이름의 글자 하나에 맞는가.
 *
 * ★★ **봐주기는 한쪽으로만.** 양쪽에 다 걸면 ㄲ 로 '가치' 가 걸립니다 —
 *   시프트까지 눌러 ㄲ 을 친 사람은 ㄲ 을 찾는 것입니다.
 *   ㄱ(찾는 말) → ㄲ(이름) 만 봐줍니다.
 */
function initialMatches(nameChar: string, queryChar: string): boolean {
  if (nameChar === queryChar) return true;
  return SOFTEN[nameChar] === queryChar;
}

/** 찾는 첫소리가 이름 안에 **이어서** 들어 있는가 */
function chosungIncludes(name: string, query: string): boolean {
  if (query.length === 0) return true;
  if (query.length > name.length) return false;

  for (let start = 0; start + query.length <= name.length; start += 1) {
    let all = true;

    for (let i = 0; i < query.length; i += 1) {
      if (!initialMatches(name[start + i], query[i])) {
        all = false;
        break;
      }
    }

    if (all) return true;
  }

  return false;
}

/**
 * 이 이름이 찾는 말에 걸리는가.
 *
 * ★ 두 가지를 봅니다 —
 *     그냥 들어 있는가   '민서' → 김민서
 *     첫소리가 맞는가    'ㄱㅁㅅ' → 김민서
 *
 * ★ 첫소리는 **이어져 있어야** 합니다. 'ㄱㅅ' 가 김민서에 걸리면
 *   아무 이름이나 다 걸립니다 — 좁히는 게 목적인데 넓어집니다.
 *
 * ★ 빈 말이면 다 통과입니다. 검색칸이 비었을 때 목록이 사라지면 안 됩니다.
 */
export function matchesKorean(text: string, query: string): boolean {
  const q = query.trim();
  if (q === '') return true;

  const target = text ?? '';

  // ① 글자 그대로 (대소문자는 안 가립니다 — 주문번호가 섞입니다)
  if (target.toLowerCase().includes(q.toLowerCase())) return true;

  // ② 첫소리
  if (isChosungQuery(q)) {
    return chosungIncludes(initials(target), q.replace(/\s/g, ''));
  }

  return false;
}

/**
 * 여러 칸 중 하나라도 걸리면 통과.
 *
 * ★ 환자 이름과 주문번호를 함께 봅니다. 데스크는 번호로,
 *   진료실은 이름으로 찾습니다.
 */
export function matchesAny(fields: (string | null | undefined)[], query: string): boolean {
  const q = query.trim();
  if (q === '') return true;

  return fields.some((f) => f && matchesKorean(f, q));
}
