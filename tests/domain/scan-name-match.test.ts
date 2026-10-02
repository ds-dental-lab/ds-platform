// =========================================================
// 놓을 위치: tests/domain/scan-name-match.test.ts
//
// 스캐너가 보낸 이름과 덴플로우 이름 맞추기 (사용자 결정 2026-10-02).
// =========================================================

import { describe, it, expect } from 'vitest';
import { cleanScanMeta, sameClinicName, samePatientName } from '@/server/domain/device-link';

describe('치과명 맞추기', () => {
  it('같은 이름', () => {
    expect(sameClinicName('다서울치과', '다서울치과')).toBe(true);
    expect(sameClinicName('다서울 치과', '다서울치과')).toBe(true);
  });

  /*
    ★★ 꼬리가 다를 뿐인 집에 경고를 띄우면, 맞는 집이 매번 노란 띠를 봅니다.
      스캐너에는 '…치과의원', 덴플로우에는 '…치과' 로 적히는 일이 흔합니다.
  */
  it('★ 치과·치과의원 같은 꼬리 차이는 같은 것으로 봅니다', () => {
    expect(sameClinicName('다서울치과의원', '다서울치과')).toBe(true);
    expect(sameClinicName('서울치과병원', '서울의원')).toBe(true);
  });

  it('품고 있으면 같은 것으로 봅니다', () => {
    expect(sameClinicName('서울치과 본점', '서울치과')).toBe(true);
  });

  it('다른 치과면 다릅니다 — 이때만 알립니다', () => {
    expect(sameClinicName('부산치과', '다서울치과')).toBe(false);
  });

  // ★ 모르는 것을 틀렸다고 알리지 않습니다
  it('한쪽이 비면 알리지 않습니다', () => {
    expect(sameClinicName('', '다서울치과')).toBe(true);
    expect(sameClinicName('다서울치과', '')).toBe(true);
  });
});

describe('환자명 맞추기', () => {
  it('띄어쓰기만 지웁니다', () => {
    expect(samePatientName('안 현석', '안현석')).toBe(true);
  });

  /*
    ★★ 환자는 품는 것으로 맞추지 않습니다. 남의 주문에 스캔이 붙는 쪽이
      새 주문을 하나 더 쓰는 것보다 훨씬 위험합니다.
  */
  it('★ 일부만 같으면 다른 사람입니다', () => {
    expect(samePatientName('김민', '김민수')).toBe(false);
  });

  it('비면 아무와도 안 맞습니다', () => {
    expect(samePatientName('', '')).toBe(false);
    expect(samePatientName('', '안현석')).toBe(false);
  });
});

/*
  ★★ 내보낸 파일의 <Dentist> 칸에 '2510' 처럼 번호만 적힌 것이 있었습니다
    (2026-10-02, 실제 파일에서 확인). 치과명이 아닌 값으로 경고를 띄우면
    맞는 치과에 매번 노란 띠가 뜹니다.
*/
describe('치과명이 아닌 값', () => {
  it('★ 번호만 적혀 있으면 알리지 않습니다', () => {
    expect(sameClinicName('2510', '치ㅣ')).toBe(true);
    expect(sameClinicName('250-1', '다서울치과')).toBe(true);
  });

  it('글자가 섞여 있으면 그대로 봅니다', () => {
    expect(sameClinicName('2510치과', '다서울치과')).toBe(false);
  });
});

/*
  스캐너 PC 가 보낸 값은 그대로 믿지 않습니다. 치식은 11~48 이면서 끝자리가
  1~8 인 것만 둡니다 — '19'·'30' 같은 칸은 없습니다.
*/
describe('보내온 치식 거르기', () => {
  it('없는 번호는 버립니다', () => {
    expect(cleanScanMeta({ fileName: 'a.dxd', teeth: [11, 19, 30, 48, 49, 0] })?.teeth).toEqual([
      11, 48,
    ]);
  });

  it('겹친 것은 한 번만, 순서대로', () => {
    expect(cleanScanMeta({ fileName: 'a.dxd', teeth: [21, 11, 21] })?.teeth).toEqual([11, 21]);
  });
})
