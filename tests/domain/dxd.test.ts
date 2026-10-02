// =========================================================
// 놓을 위치: tests/domain/dxd.test.ts
//
// dxd 안의 DentalCase.xml 읽는 규칙 (사용자 요청 2026-10-02).
// 치과 PC 올리미(파이썬)와 **같은 답**이 나와야 합니다 — 자동으로 올라오든
// 손으로 올리든 주문서가 똑같이 채워져야 하니까요.
//
// 글자는 실제 임상 파일에서 그대로 떼어 왔습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { readDentalCase, teethFromName } from '@/server/domain/dxd';

const XML = `<?xml version="1.0"?>
<DentalCase>
  <Patient>
    <LastName>안현석</LastName>
    <FirstName></FirstName>
    <FullName> 안현석</FullName>
    <PatientID>24447</PatientID>
    <DateOfBirth>1970-01-01</DateOfBirth>
    <CaseGUID>707583DC-610A-4466-8F5A-5B12A352F8F4</CaseGUID>
  </Patient>
  <Dentist><Name>2510</Name></Dentist>
  <FileHistory><DateTime day="8" month="9" year="2026" hour="2" minute="35" second="10"/></FileHistory>
  <Restorations><Restoration><ScanOnly type="Impression"/></Restoration></Restorations>
  <ToothDefinitions/>
</DentalCase>`;

describe('실파일 그대로 읽기', () => {
  const c = readDentalCase(XML, '2025-10-15 안현석.dxd');

  it('환자와 차트번호', () => {
    expect(c.patientName).toBe('안현석');
    expect(c.chartNo).toBe('24447');
  });

  /*
    ★★ xml 의 시각은 UTC 입니다. 파일 이름이 '…11-34-58' 인 스캔의 xml 이
      hour="2" 였습니다 (2026-10-02 실파일). 그대로 쓰면 아홉 시간 어긋납니다.
  */
  it('★ 스캔 시각은 한국 시각으로', () => {
    expect(c.scannedAt).toBe('2026-09-08 11:35');
  });

  it('치과 칸은 적힌 대로 (번호여도)', () => {
    expect(c.clinicNameInFile).toBe('2510');
  });

  // ★★ 생년월일은 읽지 않습니다 (사용자 결정) — 어디에도 담기면 안 됩니다
  it('★ 생년월일은 어디에도 없습니다', () => {
    expect(JSON.stringify(c)).not.toContain('1970');
  });

  it('비면 빈 값이지 멈추지 않습니다', () => {
    expect(readDentalCase('', '').patientName).toBe('');
  });
});

describe('이름 붙이기', () => {
  it('한글은 성+이름을 붙입니다', () => {
    expect(readDentalCase('<LastName>김</LastName><FirstName>영애B</FirstName>').patientName).toBe(
      '김영애B',
    );
  });

  it('영문은 이름 성 순서로 띄웁니다', () => {
    expect(
      readDentalCase('<LastName>SANI</LastName><FirstName>JULIA</FirstName>').patientName,
    ).toBe('JULIA SANI');
  });

  it("'다서울치과, 다서울치과' 는 한 번만", () => {
    expect(
      readDentalCase('<Dentist><Name>다서울치과, 다서울치과</Name></Dentist>').clinicNameInFile,
    ).toBe('다서울치과');
  });
});

/*
  ★★ 실제 임상 파일 다섯 개가 모두 '본만 뜬' 내보내기라 xml 에 치식이
    없었습니다. 대신 파일 이름에 '#11,21' 로 적는 치과가 있었습니다.
*/
describe('치식', () => {
  it('xml 에 있으면 그것이 먼저', () => {
    const c = readDentalCase(`${XML}<ToothNumber>16</ToothNumber>`, '환자 #11,21.dxd');
    expect(c.teeth).toEqual([16]);
  });

  it('xml 에 없으면 파일 이름에서', () => {
    expect(readDentalCase(XML, '김예림 #11,21 최.dxd').teeth).toEqual([11, 21]);
  });

  it('★ # 이 없으면 안 읽습니다 — 날짜·차트번호가 치식이 됩니다', () => {
    expect(teethFromName('2026-10-01_김영애B')).toEqual([]);
    expect(teethFromName('2604040_DI_2026-10_02JULIA8')).toEqual([]);
    expect(teethFromName('박향란 시로나 2026-09-08_11-34-58')).toEqual([]);
  });

  it('없는 번호는 버립니다', () => {
    expect(teethFromName('환자 #09 #49 #30')).toEqual([]);
    expect(teethFromName('아무개 #11, 21, 26 상악')).toEqual([11, 21, 26]);
  });
});
