// =========================================================
// 놓을 위치: tests/domain/shade-photo.test.ts
//
// 쉐이드 포토의 규칙. (명세서 SPEC_shade-photo, 사용자 결정 2026-08-21)
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  canShoot,
  isPhoto,
  shadeStatusOf,
  shadePhotoName,
  SHADE_CUTS,
  isAnterior,
  SHOT_HINT,
  SHADE_STATUS_LABEL,
  HOME_DAYS,
  shadeNotice,
  shadePushPayload,
  thumbTransform,
  THUMB_EDGE,
  VIEW_EDGE,
  shouldRetry,
  queueLabel,
  QUEUE_MAX_TRIES,
} from '@/server/domain/shade-photo';
import { LAB_OPEN_EXTENSIONS } from '@/server/domain/file-access';
import { STATUS_ORDER } from '@/server/domain/order-status';

describe('찍을 수 있는 단계', () => {
  it('만들고 있는 동안만 찍습니다', () => {
    expect(canShoot('uploading')).toBe(true);
    expect(canShoot('received')).toBe(true);
    expect(canShoot('rescan')).toBe(true);
    expect(canShoot('designing')).toBe(true);
  });

  // ★ 배송 나간 뒤에 쉐이드를 찍는 일은 없습니다 — 있다면 리메이크입니다
  it('넘어간 뒤에는 안 찍습니다', () => {
    expect(canShoot('production_wait')).toBe(false);
    expect(canShoot('production')).toBe(false);
    expect(canShoot('shipping')).toBe(false);
    expect(canShoot('completed')).toBe(false);
    expect(canShoot('cancelled')).toBe(false);
  });

  it('모든 상태에 답이 있습니다', () => {
    for (const s of STATUS_ORDER) expect(typeof canShoot(s)).toBe('boolean');
  });
});

describe('무엇이 사진인가', () => {
  it('흔한 사진 확장자', () => {
    for (const name of ['a.jpg', 'a.JPEG', 'b.png', 'c.webp', 'd.HEIC']) {
      expect(isPhoto(name)).toBe(true);
    }
  });

  it('스캔·설계 파일은 사진이 아닙니다', () => {
    for (const name of ['a.stl', 'b.obj', 'c.dxd', 'd.ply', 'e.zip', '확장자없음']) {
      expect(isPhoto(name)).toBe(false);
    }
  });

  /*
    ★★ 기공소에게 열어 주는 목록과 **같은 잣대**여야 합니다.
      화면이 '촬영 완료' 라고 해 놓고 기공소가 못 여는 파일이면
      거짓말이 됩니다 (domain/file-access).
  */
  it('★ 기공소가 열 수 있는 것만 사진으로 셉니다', () => {
    for (const ext of LAB_OPEN_EXTENSIONS) {
      expect(isPhoto(`shade.${ext}`)).toBe(true);
    }
  });
});

describe('쉐이드 상태', () => {
  it('사진이 한 장이라도 있으면 촬영 완료', () => {
    expect(shadeStatusOf([{ file_name: 'a.jpg', kind: 'scan' }])).toBe('done');
  });

  it('스캔 파일만 있으면 아직 대기', () => {
    expect(shadeStatusOf([{ file_name: 'a.stl', kind: 'scan' }])).toBe('waiting');
    expect(shadeStatusOf([])).toBe('waiting');
  });

  /*
    ★ 디자인 파일은 안 셉니다. 센터가 만든 미리보기 png 가 섞여 있어,
      세면 진료실이 안 찍었는데 '촬영 완료' 로 보입니다.
  */
  it('★ 센터가 올린 미리보기 png 는 안 셉니다', () => {
    expect(shadeStatusOf([{ file_name: '미리보기.png', kind: 'design' }])).toBe('waiting');
  });

  it('말은 시안 그대로', () => {
    expect(SHADE_STATUS_LABEL.waiting).toBe('쉐이드 대기');
    expect(SHADE_STATUS_LABEL.done).toBe('촬영 완료');
  });
});

describe('사진 이름', () => {
  const at = new Date(2026, 7, 21, 9, 5);

  it('주문번호와 순번과 시각으로 짓습니다', () => {
    expect(shadePhotoName('ORD-260821-001', 0, at)).toBe(
      'ORD-260821-001_shade1_20260821-0905.jpg',
    );
    expect(shadePhotoName('ORD-260821-001', 2, at)).toContain('_shade3_');
  });

  /*
    ★★ 환자 이름을 안 씁니다. 파일명은 저장소 경로에도 남고 내려받을
      때 사람 눈에도 보입니다 (설계서 §8.5).
  */
  it('★ 환자 이름이 안 들어갑니다', () => {
    const name = shadePhotoName('ORD-260821-001', 0, at);
    expect(name).not.toContain('김');
    expect(name).toMatch(/^ORD-[0-9-]+_shade\d+_\d{8}-\d{4}\.jpg$/);
  });
});

describe('시안에서 가져온 값', () => {
  /*
    ★★ 시안·명세는 셋이었습니다. 사장님이 둘로 줄였습니다 (2026-08-23) —
      원본 화질로 담아서 한 장이 큽니다. 색을 정하는 데 실제로 쓰이는
      것은 앞의 둘입니다.
  */
  it('★ 컷은 둘 (셋에서 줄임)', () => {
    expect(SHADE_CUTS).toHaveLength(2);
    expect(SHADE_CUTS[0]).toContain('쉐이드탭');
    expect(SHADE_CUTS[1]).toContain('정면');
  });

  it('홈은 최근 7일', () => {
    expect(HOME_DAYS).toBe(7);
  });
});


/*
  ★★ 화면이 "기공소에 알림을 보냈습니다" 라고 **말만** 하고 있었습니다
    (2026-08-21). 하지도 않은 일을 했다고 하는 것이라 먼저 고쳤습니다.
*/
describe('쉐이드 알림 문구', () => {
  it('몇 장인지 적습니다', () => {
    expect(shadeNotice('ORD-260821-001', '김민서', 3).title).toBe('쉐이드 사진 3장이 왔습니다');
  });

  /*
    ★ "왔다" 만으로는 세 장 중 한 장만 온 것을 못 알아챕니다.
      장수가 제목에 있어야 목록에서 바로 보입니다.
  */
  it('한 장이어도 장수가 보입니다', () => {
    expect(shadeNotice('ORD-1', '김', 1).title).toContain('1장');
  });

  // ★ 기공소는 환자 이름으로 케이스를 찾습니다
  it('본문에 주문번호와 환자 이름', () => {
    expect(shadeNotice('ORD-260821-001', '김민서', 2).body).toBe('ORD-260821-001 · 김민서');
  });

  /*
    ★ 같은 주문이면 폰의 알림을 **갈아끼웁니다.** 세 번 찍었다고
      폰에 세 줄이 쌓이면 그게 곧 카톡입니다.
  */
  it('★ 같은 주문은 같은 딱지(tag)', () => {
    const a = shadePushPayload('order-1', 'ORD-1', '김', 1, '/lab/orders/order-1');
    const b = shadePushPayload('order-1', 'ORD-1', '김', 3, '/lab/orders/order-1');

    expect(a.tag).toBe(b.tag);
    expect(a.tag).toContain('order-1');
  });

  it('누를 곳이 함께 갑니다', () => {
    expect(shadePushPayload('o1', 'ORD-1', '김', 1, '/design/orders/o1').link).toBe(
      '/design/orders/o1',
    );
  });
});


/*
  ★★ **섬네일 파일을 안 만듭니다.** 명세는 "서버에서 별도 생성" 이라고
    했지만 저장소가 줄여서 내줍니다. 원본은 손 하나 안 댑니다.
*/
describe('섬네일', () => {
  it('목록은 칸을 채웁니다(cover)', () => {
    const t = thumbTransform('grid');
    expect(t.resize).toBe('cover');
    expect(t.width).toBe(THUMB_EDGE);
  });

  /*
    ★ 크게 볼 때는 잘리면 안 됩니다. 쉐이드탭이 가장자리에 있는
      사진이 흔합니다.
  */
  it('★ 크게보기는 안 자릅니다(contain)', () => {
    expect(thumbTransform('view').resize).toBe('contain');
    expect(thumbTransform('view').width).toBe(VIEW_EDGE);
  });

  it('크게보기가 목록보다 큽니다', () => {
    expect(VIEW_EDGE).toBeGreaterThan(THUMB_EDGE);
  });

  // ★ 목록은 여러 장이 한꺼번에 뜹니다 — 화질을 더 낮게
  it('목록 화질이 더 낮습니다', () => {
    expect(thumbTransform('grid').quality).toBeLessThan(thumbTransform('view').quality);
  });
});


/*
  ★★ 진료실 와이파이는 자주 약합니다. 전에는 올리다 끊기면 그 자리에서
    실패하고 **찍은 사진이 사라졌습니다** — 환자는 이미 일어났고
    다시 찍을 수 없습니다.
*/
describe('전송 대기', () => {
  it('처음에는 다시 해 봅니다', () => {
    expect(shouldRetry(0)).toBe(true);
    expect(shouldRetry(QUEUE_MAX_TRIES - 1)).toBe(true);
  });

  /*
    ★ 무한정 하지 않습니다. 다섯 번을 실패했으면 연결 문제가 아니라
      다른 사정입니다 — 조용히 계속 두드리면 배터리만 먹습니다.
  */
  it('★ 다섯 번이면 멈춥니다', () => {
    expect(shouldRetry(QUEUE_MAX_TRIES)).toBe(false);
    expect(shouldRetry(QUEUE_MAX_TRIES + 1)).toBe(false);
  });

  it('기다리는 것만 있으면 장수만', () => {
    expect(queueLabel(3, 0)).toBe('전송 대기 3장');
  });

  // ★ 못 보낸 것은 따로 셉니다. 섞어 세면 '기다리는 중' 으로 읽힙니다
  it('★ 못 보낸 것이 있으면 갈라서 말합니다', () => {
    expect(queueLabel(0, 2)).toBe('사진 2장을 못 보냈습니다');
    expect(queueLabel(1, 2)).toContain('못 보낸 것 2장');
  });
});


/*
  ★★ 앞니는 색만 맞아서는 안 됩니다. 얼굴 안에서 봤을 때 맞아야 합니다 —
    입술선·피부톤이 같이 보여야 어울리는지가 보입니다.
    (사용자 요청 2026-08-23 — "전치부 경우 코까지 보였으면 좋겠는데")
*/
describe('전치부인가', () => {
  it('견치에서 견치까지가 전치부입니다', () => {
    for (const n of [11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43]) {
      expect(isAnterior([n])).toBe(true);
    }
  });

  // ★ 소구치부터는 웃어도 잘 안 보입니다 — 얼굴을 담을 이유가 적습니다
  it('★ 소구치·대구치는 아닙니다', () => {
    for (const n of [14, 15, 16, 17, 18, 24, 26, 36, 37, 46, 48]) {
      expect(isAnterior([n])).toBe(false);
    }
  });

  /*
    ★ 한 치아라도 앞니면 얼굴을 담습니다. #13-#16 브릿지에서 앞니가
      섞여 있는데 구치부 기준으로 찍으면, 정작 사람 눈에 보이는 쪽을
      못 맞춥니다.
  */
  it('★ 섞여 있으면 전치부로 봅니다', () => {
    expect(isAnterior([13, 14, 15, 16])).toBe(true);
  });

  it('비어 있으면 아닙니다', () => {
    expect(isAnterior([])).toBe(false);
  });
});


/*
  ★★ 환자가 입을 벌리고 있고 한 손에 폰, 한 손에 쉐이드탭인 사람은
    **문장을 안 읽습니다.** 눈에 스치는 것은 서너 단어가 전부입니다.
    (사용자 요청 2026-08-23 — "안내문구가 너무 길어")
*/
describe('카메라 한 마디', () => {
  it('★ 짧습니다 — 열다섯 자 안', () => {
    for (const hint of Object.values(SHOT_HINT)) {
      expect(hint.length).toBeLessThanOrEqual(15);
    }
  });

  // ★ 문장이 아닙니다. 마침표·쉼표가 있으면 이미 읽을 것이 둘입니다
  it('★ 문장이 아닙니다', () => {
    for (const hint of Object.values(SHOT_HINT)) {
      expect(hint).not.toMatch(/[.,·]/);
      expect(hint).not.toContain('하세요');
    }
  });

  // ★ 지금 안 하면 사진을 버리게 되는 것만 남깁니다
  it('할 일이 하나씩 들어 있습니다', () => {
    expect(SHOT_HINT.normal).toContain('쉐이드탭');
    expect(SHOT_HINT.anterior).toContain('코');
  });
});
