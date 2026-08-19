// =========================================================
// 놓을 위치: tests/domain/terms.test.ts
// 기준: 사용자 요청 2026-08-19 — 전 직장(문자발송 서비스) 약관을 버리고
//       덴플로우에 맞게 새로 쓴 뒤 "만들어줘"
//
// ★ 여기서 지키는 것은 문장이 아니라 **문서의 뼈대**입니다.
//   조가 하나 빠지거나 번호가 어긋나면, 다른 조에서 "제27조에 따라"
//   라고 가리킨 곳이 엉뚱한 조가 됩니다. 원본 약관이 실제로 그랬습니다
//   (제17조가 금지행위로 제18조를 가리켰는데 제18조는 이용 시간이었음).
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  CHAPTERS,
  allArticles,
  isDraft,
  missingTermsFields,
  type TermsFacts,
} from '@/server/domain/terms';

const facts = (over: Partial<TermsFacts> = {}): TermsFacts => ({
  orgName: '덴플로우치과기공소',
  bizNo: '123-45-67890',
  address: '어딘가',
  tel: '010-3365-3145',
  email: 'hep789@naver.com',
  effectiveOn: '2026-09-01',
  ...over,
});

describe('초안인가', () => {
  // ★ 처리방침과 같은 규칙입니다 — 날짜를 넣는 행위가 곧 "검토를 마쳤다"
  it('★ 시행일이 없으면 초안입니다', () => {
    expect(isDraft(facts({ effectiveOn: null }))).toBe(true);
  });

  it('시행일이 있으면 정식 약관입니다', () => {
    expect(isDraft(facts())).toBe(false);
  });

  it('빈 문자열도 초안입니다 — 화면이 빈 칸으로 저장할 수 있습니다', () => {
    expect(isDraft(facts({ effectiveOn: '' }))).toBe(true);
  });
});

describe('안 채운 곳', () => {
  it('다 채우면 아무 말도 안 합니다', () => {
    expect(missingTermsFields(facts())).toEqual([]);
  });

  it('★ 사업자등록 전에는 세 가지가 빕니다', () => {
    const missing = missingTermsFields(
      facts({ bizNo: null, address: null, effectiveOn: null }),
    );

    expect(missing).toEqual(['사업자등록번호', '주소', '시행일']);
  });

  // ★ 전화나 메일 중 하나만 있어도 연락은 됩니다. 둘 다 없을 때만 잡습니다
  it('연락처는 전화나 메일 중 하나만 있으면 됩니다', () => {
    expect(missingTermsFields(facts({ tel: null }))).toEqual([]);
    expect(missingTermsFields(facts({ email: null }))).toEqual([]);
    expect(missingTermsFields(facts({ tel: null, email: null }))).toEqual(['문의 연락처']);
  });

  it('공백만 있는 것은 안 채운 것입니다', () => {
    expect(missingTermsFields(facts({ bizNo: '   ' }))).toContain('사업자등록번호');
  });
});

describe('문서의 뼈대', () => {
  const articles = allArticles();

  it('7장입니다', () => {
    expect(CHAPTERS).toHaveLength(7);
  });

  // ★ 번호가 1부터 빠짐없이 이어져야 합니다.
  //   화면이 조 번호를 데이터에서 그대로 읽어 쓰기 때문입니다.
  it('★ 조 번호가 1부터 34까지 빠짐없이 이어집니다', () => {
    expect(articles.map((a) => a.n)).toEqual(
      Array.from({ length: 34 }, (_, i) => i + 1),
    );
  });

  it('모든 조에 제목과 본문이 있습니다', () => {
    for (const article of articles) {
      expect(article.title.trim(), `제${article.n}조`).not.toBe('');
      expect(article.paras.length, `제${article.n}조`).toBeGreaterThan(0);
    }
  });

  it('빈 항이나 빈 호가 없습니다', () => {
    for (const article of articles) {
      for (const para of article.paras) {
        expect(para.text.trim(), `제${article.n}조`).not.toBe('');
        for (const item of para.items ?? []) {
          expect(item.trim(), `제${article.n}조`).not.toBe('');
        }
      }
    }
  });

  it('조 제목이 겹치지 않습니다 — 원본은 회사의 의무가 두 번 있었습니다', () => {
    const titles = articles.map((a) => a.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  /**
   * ★ 본문이 가리키는 조가 실제로 있는가.
   *   원본 약관이 무너진 자리가 바로 여기였습니다.
   */
  it('★ 다른 조를 가리키는 곳이 모두 실재하는 조입니다', () => {
    const exists = new Set(articles.map((a) => a.n));

    for (const article of articles) {
      for (const para of article.paras) {
        const text = [para.text, ...(para.items ?? [])].join(' ');

        for (const hit of text.matchAll(/제(\d+)조/g)) {
          const n = Number(hit[1]);
          expect(exists.has(n), `제${article.n}조가 없는 제${n}조를 가리킵니다`).toBe(true);
        }
      }
    }
  });

  /**
   * ★ 스스로를 가리키지 않습니다.
   *   "제15조 제3항에 따라" 같은 참조가 제15조 안에 있으면 순환입니다.
   */
  it('자기 조를 가리키지 않습니다', () => {
    for (const article of articles) {
      const text = article.paras
        .map((p) => [p.text, ...(p.items ?? [])].join(' '))
        .join(' ');

      expect(
        text.includes(`제${article.n}조`),
        `제${article.n}조가 자기를 가리킵니다`,
      ).toBe(false);
    }
  });
});

describe('버린 것이 안 돌아왔는가', () => {
  const everything = allArticles()
    .flatMap((a) => [a.title, ...a.paras.flatMap((p) => [p.text, ...(p.items ?? [])])])
    .join(' ');

  /**
   * ★ 전 직장 약관은 문자발송(SMS) 서비스용이었습니다.
   *   이름만 바꿔 쓰면 하지도 않는 일에 대한 의무를 지게 됩니다.
   *   다시 섞여 들어오면 여기서 잡힙니다.
   */
  it('★ 문자발송 서비스 조항이 없습니다', () => {
    for (const word of ['발신번호', '변작', '스팸', '전송제한', '한국인터넷진흥원']) {
      expect(everything, `'${word}' 가 돌아왔습니다`).not.toContain(word);
    }
  });

  it('★ 충전·환불 구조가 없습니다 — 우리는 월정산입니다', () => {
    for (const word of ['충전', '잔여금액', '잔액']) {
      expect(everything, `'${word}' 가 돌아왔습니다`).not.toContain(word);
    }
  });

  it('★ 없어진 부처 이름과 옛 회사 흔적이 없습니다', () => {
    for (const word of ['미래창조과학부', '큐브세븐틴', 'NeXways', 'quve']) {
      expect(everything).not.toContain(word);
    }
  });

  // ★ 상호는 본문에 안 씁니다. organizations 에서 읽어 머리·꼬리에만 넣습니다
  it('★ 본문에 상호를 박아 두지 않습니다', () => {
    expect(everything).not.toContain('덴플로우치과기공소');
  });
});

describe('실제 동작을 옮겼는가', () => {
  const find = (n: number) => allArticles().find((a) => a.n === n)!;
  const textOf = (n: number) =>
    find(n)
      .paras.map((p) => [p.text, ...(p.items ?? [])].join(' '))
      .join(' ');

  // ★ domain/due-date — 주문한 날이 1일차, 최소 4번째 영업일, 일요일 불가
  it('요청시한 규칙이 도메인과 같습니다', () => {
    const text = textOf(12);

    expect(text).toContain('첫째 영업일');
    expect(text).toContain('넷째 영업일');
    expect(text).toContain('일요일은 요청시한으로 정할 수 없습니다');
  });

  // ★ 다운로드 = 제작시작
  it('파일을 내려받으면 제작이 시작된 것으로 봅니다', () => {
    expect(textOf(13)).toContain('내려받으면 해당 주문은 제작이 시작된 것으로 봅니다');
  });

  // ★ 주문취소라는 기능이 없습니다
  it('제작이 시작되면 삭제할 수 없다고 적혀 있습니다', () => {
    expect(textOf(14)).toContain('제작이 시작된 뒤에는 주문을 삭제할 수 없습니다');
  });

  // ★ 가격 격리 — 이 판의 뼈대입니다
  it('가격 격리가 약관에도 적혀 있습니다', () => {
    const text = textOf(16);

    expect(text).toContain('기공소는 치과에 청구되는 금액을 볼 수 없고');
    expect(text).toContain('치과는 기공소에 지급되는 금액을 볼 수 없습니다');
  });

  // ★ domain/billing — 배송일이 든 달, 발행 한 번으로 마감
  it('정산 귀속과 청구서 발행이 도메인과 같습니다', () => {
    const text = textOf(20);

    expect(text).toContain('실제로 배송된 날이 속한 정산 기간에 귀속');
    expect(text).toContain('정산 기간마다 한 번 발행');
  });

  /**
   * ★ 면책의 단서.
   *   이 한 줄이 빠지면 면책 조항 전체가 약관규제법 제7조로 무효가 될
   *   수 있습니다. 앞의 다섯 항이 통째로 힘을 잃습니다.
   */
  it('★ 면책에 고의·중과실 단서가 있습니다', () => {
    expect(textOf(32)).toContain('고의 또는 중대한 과실로 생긴 손해에는 적용하지 않습니다');
  });

  // ★ 특정 법원을 못 박지 않습니다 — 사업장 주소가 아직 없습니다
  it('관할을 특정 법원으로 못 박지 않습니다', () => {
    const text = textOf(34);

    expect(text).toContain('「민사소송법」에 따른 관할');
    expect(text).not.toContain('서울');
  });
});
