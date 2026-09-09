// =========================================================
// exocad 로 보내기 — 런처가 먹는 JSON 계약. (2026-09-09)
// 설계서: Desktop/exocad-연동-설계서.md v2
// =========================================================

import { describe, expect, it } from 'vitest';
import {
  buildExocadPayload,
  exocadLaunchUrl,
  exocadTokenMessage,
  exocadType,
  isExocadResultStatus,
  isExocadScanFile,
  stripUploadPrefix,
  EXOCAD_TOKEN_TTL_SECONDS,
} from '@/server/domain/exocad';

describe('종류 매핑 — 설계서 §4-1', () => {
  it('crown·implant·inlay 는 그대로, 폰틱이 우선', () => {
    expect(exocadType('crown', false)).toBe('crown');
    expect(exocadType('implant', false)).toBe('implant');
    expect(exocadType('inlay', false)).toBe('inlay');
    expect(exocadType('crown', true)).toBe('pontic');
  });

  it('★ 모르는 코드는 crown 으로 눕히지 않습니다', () => {
    expect(exocadType('veneer', false)).toBeNull();
    expect(exocadType('', false)).toBeNull();
  });
});

describe('파일명', () => {
  it('업로드 접두어(밀리초 13자리_)만 뗍니다', () => {
    expect(stripUploadPrefix('1788961097003_2026-08-21_홍길동-upperjaw.ply')).toBe('2026-08-21_홍길동-upperjaw.ply');
    expect(stripUploadPrefix('2026-09-02-김정자-2026-09-02-upperjaw.obj')).toBe('2026-09-02-김정자-2026-09-02-upperjaw.obj');
    expect(stripUploadPrefix('123_scan.stl')).toBe('123_scan.stl');
  });

  it('스캔이고 다 올라온 것만 갑니다', () => {
    expect(isExocadScanFile({ kind: 'scan', uploadStatus: 'done' })).toBe(true);
    expect(isExocadScanFile({ kind: 'scan', uploadStatus: 'pending' })).toBe(false);
    expect(isExocadScanFile({ kind: 'photo', uploadStatus: 'done' })).toBe(false);
    expect(isExocadScanFile({ kind: 'design', uploadStatus: 'done' })).toBe(false);
  });
});

describe('페이로드 조립', () => {
  const items = [
    { id: 'a', toothNumber: 46, typeCode: 'crown', isPontic: false },
    { id: 'b', toothNumber: 45, typeCode: 'crown', isPontic: true },
    { id: 'c', toothNumber: 44, typeCode: 'crown', isPontic: false },
    { id: 'd', toothNumber: 26, typeCode: 'inlay', isPontic: false },
    { id: 'e', toothNumber: 36, typeCode: 'implant', isPontic: false },
  ];

  it('설계서 §2-3 의 예시 그대로 나옵니다', () => {
    const { payload, unknownTypes } = buildExocadPayload({
      orderId: 'o1',
      orderNo: 'ORD-260909-001',
      patientName: '홍길동',
      orderDate: '2026-09-09',
      items,
      bridges: [{ memberItemIds: ['c', 'b', 'a'] }],
      files: [{ name: '1788961097003_x.dxd', url: 'https://u', size: 10 }],
    });
    expect(unknownTypes).toEqual([]);
    expect(payload.teeth).toEqual([
      { number: 26, type: 'inlay' },
      { number: 36, type: 'implant' },
      { number: 44, type: 'crown' },
      { number: 45, type: 'pontic' },
      { number: 46, type: 'crown' },
    ]);
    expect(payload.bridges).toEqual([[44, 45, 46]]);
    expect(payload.files).toEqual([{ name: 'x.dxd', url: 'https://u', size: 10 }]);
    expect(payload.patientName).toBe('홍길동');
    expect(payload.orderDate).toBe('2026-09-09');
  });

  it('같은 치아 두 줄(slot)은 한 번만, 모르는 종류는 unknownTypes 로', () => {
    const { payload, unknownTypes } = buildExocadPayload({
      orderId: 'o',
      orderNo: 'n',
      patientName: 'p',
      orderDate: '2026-01-01',
      items: [
        { id: 'a', toothNumber: 11, typeCode: 'crown', isPontic: false },
        { id: 'a2', toothNumber: 11, typeCode: 'crown', isPontic: false },
        { id: 'v', toothNumber: 12, typeCode: 'veneer', isPontic: false },
      ],
      bridges: [{ memberItemIds: ['a'] }],
      files: [],
    });
    expect(payload.teeth).toEqual([{ number: 11, type: 'crown' }]);
    expect(payload.bridges).toEqual([]); // 한 개짜리는 브릿지가 아닙니다
    expect(unknownTypes).toEqual(['veneer']);
  });
});

describe('토큰·주소', () => {
  it('서명 글에는 주문 id 와 만료가 같이 들어갑니다 — 다른 주문에 못 씁니다', () => {
    expect(exocadTokenMessage('o1', 1700000000)).toBe('exocad:o1:1700000000');
    expect(exocadTokenMessage('o2', 1700000000)).not.toBe(exocadTokenMessage('o1', 1700000000));
  });

  it('10분 삽니다', () => {
    expect(EXOCAD_TOKEN_TTL_SECONDS).toBe(600);
  });

  it('런처 주소는 denflow://exocad/<주문>?t=<토큰>', () => {
    expect(exocadLaunchUrl('abc', '1.x/y+z')).toBe('denflow://exocad/abc?t=1.x%2Fy%2Bz');
  });

  it('결과 상태는 done·failed 뿐', () => {
    expect(isExocadResultStatus('done')).toBe(true);
    expect(isExocadResultStatus('failed')).toBe(true);
    expect(isExocadResultStatus('pending')).toBe(false);
  });
});
