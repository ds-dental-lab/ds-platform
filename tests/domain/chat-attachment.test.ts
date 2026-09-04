// =========================================================
// 놓을 위치: tests/domain/chat-attachment.test.ts
// 기준: 사용자 요청 2026-09-04 —
//   "대화창에서 카톡처럼 다운로드받고 바로 볼 수 있게" · "기공소는 그대로 잠궈둬"
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  attachmentKindFor,
  opensInBrowser,
  canAttach,
  checkAttachment,
  attachmentNotice,
  attachmentSize,
  MAX_ATTACHMENT_BYTES,
} from '@/server/domain/chat-attachment';
import { fileBlockedFor } from '@/server/domain/file-access';

describe('종류 고르기', () => {
  it('사진은 photo', () => {
    expect(attachmentKindFor('a.jpg')).toBe('photo');
    expect(attachmentKindFor('IMG_0012.HEIC')).toBe('photo');
  });

  /*
    ★★ 스캔·설계로는 안 넣습니다. 설계 파일은 기공소가 받으면 '제작' 으로
      넘어가는 신호라, 대화에 흘려 넣은 html 뷰어가 그 신호를 내면 안 됩니다.
      photo·etc 는 그 규칙(kind === 'design')에 안 걸립니다.
  */
  it('★ 그 밖은 전부 etc — 설계(design)가 아닙니다', () => {
    expect(attachmentKindFor('디자인1.html')).toBe('etc');
    expect(attachmentKindFor('crown.stl')).toBe('etc');
    expect(attachmentKindFor('설명.pdf')).toBe('etc');
  });
});

describe('바로 열기', () => {
  it('사진·html·pdf 는 새 탭에서 바로 봅니다', () => {
    expect(opensInBrowser('a.png')).toBe(true);
    expect(opensInBrowser('exocad_viewer.html')).toBe(true);
    expect(opensInBrowser('a.pdf')).toBe(true);
  });

  it('stl·zip 은 받기만', () => {
    expect(opensInBrowser('crown.stl')).toBe(false);
    expect(opensInBrowser('scan.zip')).toBe(false);
  });
});

/*
  ★★ 기공소 잠금은 file-access 가 그대로 합니다 — 여기서 다시 적지 않습니다.
    이 시험은 "대화 첨부가 그 규칙 아래 놓여 있는가" 를 확인합니다.
*/
describe('기공소는 그대로 잠겨 있습니다', () => {
  it('★ 사진(photo)은 기공소도 엽니다', () => {
    expect(fileBlockedFor('lab', { kind: 'photo', fileName: 'a.jpg' })).toBeNull();
  });

  it('★ html 뷰어(etc)는 기공소가 못 엽니다', () => {
    expect(fileBlockedFor('lab', { kind: 'etc', fileName: '디자인1.html' })).not.toBeNull();
  });

  it('치과·센터는 아무것도 안 막힙니다', () => {
    expect(fileBlockedFor('clinic', { kind: 'etc', fileName: '디자인1.html' })).toBeNull();
    expect(fileBlockedFor('design_center', { kind: 'etc', fileName: 'a.stl' })).toBeNull();
  });

  // ★ 붙이는 것도 치과·센터만. 기공소는 읽기만 (사용자 결정 2026-09-04)
  it('★ 기공소는 붙일 수 없습니다', () => {
    expect(canAttach('clinic')).toBe(true);
    expect(canAttach('design_center')).toBe(true);
    expect(canAttach('lab')).toBe(false);
    expect(canAttach(null)).toBe(false);
  });
});

describe('붙이기 전 검사', () => {
  it('보통 파일은 통과', () => {
    expect(checkAttachment({ name: 'a.jpg', size: 3 * 1024 * 1024 }).ok).toBe(true);
  });

  /*
    ★ 스캔(500MB)보다 훨씬 낮습니다. 대화창에는 진행률도 이어 올리기도
      없습니다 — 큰 덩어리는 파일 칸으로 가야 합니다.
  */
  it('★ 상한을 넘으면 파일 칸으로 보냅니다', () => {
    const v = checkAttachment({ name: 'big.zip', size: MAX_ATTACHMENT_BYTES + 1 });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('파일 칸');
  });

  it('빈 파일·이름 없는 파일은 막습니다', () => {
    expect(checkAttachment({ name: 'a.jpg', size: 0 }).ok).toBe(false);
    expect(checkAttachment({ name: '  ', size: 10 }).ok).toBe(false);
  });
});

describe('알림 한 줄', () => {
  // ★ 본문은 비워도 종에는 글이 있어야 합니다 — 빈 알림은 무엇이 왔는지 모릅니다
  it('사진과 파일을 갈라 말합니다', () => {
    expect(attachmentNotice('a.png')).toBe('사진을 보냈습니다');
    expect(attachmentNotice('디자인1.html')).toContain('디자인1.html');
  });
});

describe('크기 글자', () => {
  it('단위가 붙습니다', () => {
    expect(attachmentSize(4.9 * 1024 * 1024)).toBe('4.9MB');
    expect(attachmentSize(300 * 1024)).toBe('300KB');
    expect(attachmentSize(12)).toBe('12B');
  });
});
