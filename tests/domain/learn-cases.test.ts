import { describe, it, expect } from 'vitest';
import { learnable, pickLearnFiles } from '@/server/domain/learn-cases';

const crown = (tooth: number) => ({ tooth, type: 'crown', implant: false });

describe('밤 실행이 배울 덴플로우 주문 고르기 (2026-11-06)', () => {
  it('구치부 자연치 크라운·브릿지는 고릅니다', () => {
    expect(learnable([crown(46), crown(47)])).toEqual({ ok: true, teeth: [46, 47] });
    expect(learnable([crown(16)])).toEqual({ ok: true, teeth: [16] });
  });
  it('인레이가 섞여도 크라운만 셉니다', () => {
    expect(learnable([crown(46), { tooth: 45, type: 'inlay', implant: false }])).toEqual({ ok: true, teeth: [46] });
  });
  it('인레이만 있으면 뺍니다', () => {
    expect(learnable([{ tooth: 45, type: 'inlay', implant: false }]).ok).toBe(false);
  });
  it('임플란트가 하나라도 있으면 뺍니다', () => {
    expect(learnable([crown(46), { tooth: 47, type: 'implant', implant: true }])).toEqual({ ok: false, why: '임플란트' });
    expect(learnable([{ tooth: 36, type: 'crown', implant: true }])).toEqual({ ok: false, why: '임플란트' });
  });
  it('전치부(송곳니 포함)가 있으면 뺍니다', () => {
    expect(learnable([crown(33), crown(34)])).toEqual({ ok: false, why: '전치부: 33' });
    expect(learnable([crown(11)]).ok).toBe(false);
  });
  it('임시치아 같은 다른 종류는 뺍니다', () => {
    expect(learnable([{ tooth: 17, type: 'auto_temp', implant: false }]).ok).toBe(false);
  });
});

describe('내려받을 스캔 고르기', () => {
  it('dxd 가 있으면 가장 큰 dxd 하나', () => {
    expect(pickLearnFiles([
      { name: 'a.dxd', size: 10 }, { name: 'b.DXD', size: 90 }, { name: 'x-upperjaw.stl', size: 5 },
    ])).toEqual([{ name: 'b.DXD', size: 90 }]);
  });
  it('없으면 가장 큰 zip 하나', () => {
    expect(pickLearnFiles([{ name: 's.zip', size: 3 }, { name: 'm.zip', size: 8 }])).toEqual([{ name: 'm.zip', size: 8 }]);
  });
  it('그것도 없으면 메쉬 전부, 사진·문서는 뺌', () => {
    expect(pickLearnFiles([
      { name: 'Maxillary.stl', size: 1 }, { name: 'Mandibular.ply', size: 1 }, { name: 'photo.jpg', size: 1 }, { name: 'x.pdf', size: 1 },
    ]).map((f) => f.name)).toEqual(['Maxillary.stl', 'Mandibular.ply']);
  });
  it('고를 것이 없으면 빈 배열', () => {
    expect(pickLearnFiles([{ name: 'photo.jpg', size: 1 }])).toEqual([]);
  });
});
