// =========================================================
// 놓을 위치: tests/domain/file-access.test.ts
// 기준: 사용자 결정 2026-08-20 —
//   "기공소는 쉐이드 파일만 봐야 하고 스캔 파일을 열어 봐서는 안 된다"
// =========================================================

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  extensionOf,
  isLabOpenable,
  fileBlockedFor,
  isFileBlockedFor,
  LAB_OPEN_EXTENSIONS,
} from '@/server/domain/file-access';

const scan = (fileName: string) => ({ kind: 'scan', fileName });
const design = (fileName: string) => ({ kind: 'design', fileName });

describe('확장자 읽기', () => {
  it('마지막 점 뒤를 소문자로', () => {
    expect(extensionOf('a.STL')).toBe('stl');
    expect(extensionOf('김지영2026-08-11_15-47-06.dxd')).toBe('dxd');
    expect(extensionOf('a.b.c.png')).toBe('png');
  });

  it('확장자가 없으면 빈 글자', () => {
    expect(extensionOf('noext')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
    expect(extensionOf('.hidden')).toBe('');
    expect(extensionOf('')).toBe('');
  });
});

describe('기공소가 스캔 칸에서 여는 것', () => {
  // ★ 사용자가 짚은 넷
  it('★ dxd · obj · stl · ply 는 못 엽니다', () => {
    for (const ext of ['dxd', 'obj', 'stl', 'ply']) {
      expect(fileBlockedFor('lab', scan(`case.${ext}`))).not.toBeNull();
    }
  });

  it('쉐이드 사진은 엽니다', () => {
    for (const ext of LAB_OPEN_EXTENSIONS) {
      expect(fileBlockedFor('lab', scan(`shade.${ext}`))).toBeNull();
    }
  });

  it('대문자 확장자도 같습니다', () => {
    expect(fileBlockedFor('lab', scan('SHADE.JPG'))).toBeNull();
    expect(fileBlockedFor('lab', scan('CASE.STL'))).not.toBeNull();
  });

  // ★★ 막을 것을 세면 새 스캐너가 나오는 날 새어 나갑니다
  it('★ 모르는 확장자는 전부 닫힙니다 — 열 것만 셉니다', () => {
    for (const name of ['case.3oxz', 'case.zip', 'case', 'case.pdf', 'case.dcm']) {
      expect(fileBlockedFor('lab', scan(name))).not.toBeNull();
    }
  });

  it('막을 때는 무엇을 하라는지 말해 줍니다', () => {
    expect(fileBlockedFor('lab', scan('a.stl'))).toContain('설계 파일');
  });
});

describe('막지 않는 경우', () => {
  // ★ 센터가 기공소에게 주라고 올린 것입니다. stl 이 정상입니다
  it('★ 디자인 파일은 확장자를 안 따집니다', () => {
    for (const ext of ['stl', 'dxd', 'obj', 'ply', 'zip']) {
      expect(fileBlockedFor('lab', design(`design.${ext}`))).toBeNull();
    }
  });

  it('치과·디자인센터는 아무것도 안 막힙니다', () => {
    for (const sector of ['clinic', 'design_center'] as const) {
      expect(fileBlockedFor(sector, scan('case.stl'))).toBeNull();
      expect(fileBlockedFor(sector, design('d.stl'))).toBeNull();
    }
  });

  // ★ 자사 제작 — 센터가 기공소 자리를 겸합니다. 주문의 역할로 가르면
  //   센터가 자기 주문의 스캔을 못 봅니다. 보는 사람의 소속으로만 가릅니다
  it('★ 소속이 없거나 모르면 안 막습니다 — 막는 것은 기공소 하나뿐', () => {
    expect(fileBlockedFor(null, scan('case.stl'))).toBeNull();
    expect(fileBlockedFor(undefined, scan('case.stl'))).toBeNull();
  });
});

describe('자물쇠 표시', () => {
  it('막힌 것만 true', () => {
    expect(isFileBlockedFor('lab', scan('a.stl'))).toBe(true);
    expect(isFileBlockedFor('lab', scan('a.png'))).toBe(false);
    expect(isFileBlockedFor('design_center', scan('a.stl'))).toBe(false);
  });
});

describe('열어 주는 목록', () => {
  it('사진 확장자만 들어 있습니다', () => {
    expect(isLabOpenable('a.png')).toBe(true);
    expect(isLabOpenable('a.stl')).toBe(false);
    expect(LAB_OPEN_EXTENSIONS).toContain('heic'); // 아이폰 사진
  });
});

// =========================================================
// ★★ 같은 규칙이 **두 곳**에 있습니다 — 코드와 저장소 정책.
//
//   앱의 문 : domain/file-access 의 LAB_OPEN_EXTENSIONS
//   DB 의 문: can_read_order_file() (20260820140000)
//
//   DB 쪽이 없으면 기공소가 우리 화면을 안 거치고 저장소를 직접 찔러
//   서명 주소를 만들 수 있습니다 — 실제로 그랬고, 그래서 붙였습니다.
//   두 목록이 어긋나면 **한쪽만 막힌 채 아무도 모릅니다.**
// =========================================================

describe('★ 코드와 DB 가 같은 확장자를 봅니다', () => {
  const sql = fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260820140000_lab_cannot_read_scan.sql',
    ),
    'utf8',
  );

  /**
   * 정책 안 `in ('png', 'jpg', ...)` 에서 따옴표 친 낱말만 뽑습니다.
   *
   * ★ 정규식을 안 씁니다 — 여기서 한 번 escape 때문에 파일이 깨졌습니다.
   *   목록이 늘 'png' 로 시작하므로 그 자리부터 닫는 괄호까지 자릅니다.
   */
  function extensionsInPolicy(): string[] {
    const open = sql.indexOf("('png'");
    const close = sql.indexOf(')', open);

    return sql
      .slice(open + 1, close)
      .split(',')
      .map((word) => word.trim().split("'").join(''))
      .filter(Boolean)
      .sort();
  }

  it('저장소 정책의 목록이 LAB_OPEN_EXTENSIONS 와 같습니다', () => {
    expect(extensionsInPolicy()).toEqual([...LAB_OPEN_EXTENSIONS].sort());
  });

  it('표에 없는 덩어리는 DB 에서 닫힙니다 — 경로만 알고 찌르는 것을 막습니다', () => {
    expect(sql).toContain('coalesce');
    expect(sql).toContain('false');
  });

  it('기공소가 아니면 안 막습니다 — 자사 제작이어도 센터는 센터입니다', () => {
    expect(sql).toContain("my_org_type() is distinct from 'lab'");
  });
});
