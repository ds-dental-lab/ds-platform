// =========================================================
// 놓을 위치: tests/domain/patient-call.test.ts
// 기준: 사용자 요청 2026-08-19 — HOME 알림 띠를 환자명(님)으로
// =========================================================

import { describe, it, expect } from 'vitest';
import { patientCall } from '@/server/domain/notification';

describe('부를 이름 뽑기', () => {
  // ★ 알림 띠는 지나가는 눈에 걸리라고 있는 자리입니다.
  //   숫자가 앞에 걸리면 이름이 늦게 읽힙니다
  it('★ 차트번호를 뗍니다', () => {
    expect(patientCall('이건희 (12345)')).toBe('이건희님');
  });

  it('차트번호가 없으면 그대로', () => {
    expect(patientCall('이건희')).toBe('이건희님');
  });

  it('괄호 앞뒤 공백이 어떻든 뗍니다', () => {
    expect(patientCall('이건희(12345)')).toBe('이건희님');
    expect(patientCall('  이건희   (12345)  ')).toBe('이건희님');
  });

  // ★ '김님님' 이 나옵니다
  it("★ 이미 '님' 으로 끝나면 안 붙입니다", () => {
    expect(patientCall('이건희님')).toBe('이건희님');
  });

  it('이름 안의 괄호는 안 건드립니다', () => {
    expect(patientCall('김(가명) 환자 (77)')).toBe('김(가명) 환자님');
  });
});

describe('부를 이름이 없을 때', () => {
  it('비어 있으면 null — 화면이 주문번호로 돌아갑니다', () => {
    expect(patientCall('')).toBeNull();
    expect(patientCall('   ')).toBeNull();
    expect(patientCall(null)).toBeNull();
    expect(patientCall(undefined)).toBeNull();
  });

  // ★ '(비공개)님' 은 사람 이름처럼 보입니다
  it('★ 가려 둔 값에는 님을 안 붙입니다', () => {
    expect(patientCall('(비공개)')).toBeNull();
    expect(patientCall('(12345)')).toBeNull();
  });

  it('이름 없이 차트번호만 있어도 null', () => {
    expect(patientCall('-')).toBeNull();
  });
});
