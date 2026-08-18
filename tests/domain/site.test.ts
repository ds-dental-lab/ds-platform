// =========================================================
// 놓을 위치: tests/domain/site.test.ts
// 기준: 사용자 요청 2026-08-18 — 검색 결과에 상호만, 로고가 뜨게
//
// ★ 제목은 **두 번 바뀌었습니다** (DenFlow → 상호·설명 → 상호).
//   세 번째로 흔들리지 않게 여기 못 박아 둡니다.
// =========================================================

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  SITE_URL,
  SITE_NAME,
  SITE_NAME_TIGHT,
  SITE_TAGLINE,
  SITE_TITLE,
  SITE_DESCRIPTION,
  SITE_LOGO,
  SITE_LOGO_SIZE,
  NAVER_VERIFICATION,
  GOOGLE_VERIFICATION,
} from '@/server/domain/site';

describe('검색 결과의 이름', () => {
  // *"DS덴탈랩.모델리스 전문 기공소 라고 쓰여있는거 DS덴탈랩만 보이게 해줘"*
  //
  // ★ 규칙은 '설명이 **뒤에 덧붙지** 않는다' 입니다.
  //   '태그라인이라는 글자가 제목에 없다' 로 적었다가 틀렸습니다 —
  //   상호가 `덴플로우 디지털 기공소`, 태그라인이 `디지털 기공소` 가
  //   되면서 겹쳤거든요. 겹치는 것은 흠이 아닙니다. 막을 것은
  //   `이름 · 설명` 처럼 두 토막으로 이어 붙이는 모양입니다.
  it('★ 이름만 나갑니다 — 설명이 뒤에 안 붙습니다', () => {
    expect(SITE_TITLE).toBe(SITE_NAME);

    for (const 이음표 of ['·', '|', '-', ':', '–']) {
      expect(SITE_TITLE).not.toContain(이음표);
    }
  });

  // *"서류까지 전부 덴플로우 디지털 기공소로 해줘"*
  //
  // ★ 반나절 동안 검색 이름과 상호가 갈라져 있었습니다.
  //   다시 갈라지면 명함·세금계산서·플레이스마다 "어느 쪽이었지" 가
  //   따라붙습니다. 하나라는 것을 여기서 못 박습니다.
  it('★ 검색 이름과 상호가 같습니다 — 이름은 하나입니다', () => {
    expect(SITE_TITLE).toBe(SITE_NAME);
    expect(SITE_NAME).toBe('덴플로우 디지털 기공소');
  });

  it('붙여 쓴 이름도 들고 있습니다 — 사람들은 이렇게 칩니다', () => {
    expect(SITE_NAME_TIGHT).toBe(SITE_NAME.replace(/\s/g, ''));
  });
});

// ★ 상호·제목·사이트명이 **한 값에서** 나오는지 봅니다.
//   구조화 데이터만 옛 이름으로 남으면 검색엔진은 그쪽을 믿습니다
describe('구조화 데이터도 같은 이름을 봅니다', () => {
  const jsonLd = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'site', 'SiteJsonLd.tsx'),
    'utf8',
  );

  it('★ 이름을 손으로 적어 두지 않았습니다', () => {
    expect(jsonLd).toContain('name: SITE_NAME');
    expect(jsonLd).not.toContain('덴플로우');
  });
});

describe('설명 줄', () => {
  // ★ 제목이 포기한 낱말은 여기서 살아 있어야 합니다.
  //   안 그러면 '모델리스 기공소' 로 찾는 사람에게 어디에도 안 걸립니다
  it('★ 무엇을 하는 곳인지가 맨 앞에 있습니다', () => {
    expect(SITE_DESCRIPTION.startsWith(SITE_TAGLINE)).toBe(true);
    expect(SITE_DESCRIPTION).toContain('기공소');
  });

  it('너무 길지 않습니다 — 뒤는 잘려 나갑니다', () => {
    expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });
});

describe('로고', () => {
  // ★ 구글은 112px 미만이면 아예 안 씁니다
  it('★ 정사각 512px 이고 실제로 그 크기입니다', () => {
    const file = path.join(process.cwd(), 'public', SITE_LOGO.replace(/^\//, ''));
    expect(fs.existsSync(file), `${file} 가 없습니다 — make-icons.mjs 를 돌리세요`).toBe(true);

    // PNG 머리에 적힌 가로·세로를 그대로 읽습니다
    const png = fs.readFileSync(file);
    expect(png.readUInt32BE(16)).toBe(SITE_LOGO_SIZE);
    expect(png.readUInt32BE(20)).toBe(SITE_LOGO_SIZE);
    expect(SITE_LOGO_SIZE).toBeGreaterThanOrEqual(112);
  });

  // ★ 빌드마다 주소가 바뀌면 구글이 매번 새 그림으로 봅니다
  it('★ 주소가 안 변하는 곳(public)에 있습니다', () => {
    expect(SITE_LOGO.startsWith('/')).toBe(true);
    expect(SITE_LOGO).not.toContain('_next');
  });
});

describe('주소와 소유확인', () => {
  it('정본 주소는 https 이고 끝에 / 가 없습니다', () => {
    expect(SITE_URL.startsWith('https://')).toBe(true);
    expect(SITE_URL.endsWith('/')).toBe(false);
  });

  // ★ 흔한 실수 — 태그를 통째로 붙여 넣습니다. 그러면 소유확인이 조용히 실패합니다
  it('★ 소유확인 코드에 태그가 섞여 있지 않습니다', () => {
    for (const code of [NAVER_VERIFICATION, GOOGLE_VERIFICATION]) {
      if (!code) continue;

      expect(code).not.toContain('<');
      expect(code).not.toContain('content=');
      expect(code.trim()).toBe(code);
    }
  });
});
