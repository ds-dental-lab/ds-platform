// =========================================================
// 놓을 위치: src/server/mail/invoice-mail.ts
//
// 청구서가 나갔다는 메일의 글. (사용자 결정 2026-08-21)
//
// ★★ **세부내역을 메일에 안 싣습니다.**
//   청구서 세부내역에는 **환자 이름**이 들어갑니다. 메일에 실으면
//   그 이름이 우리 손을 떠납니다 — 주소를 잘못 쓰거나, 받은 사람이
//   전달하거나, 그 메일함이 털리면요.
//   메일에는 **얼마·언제까지**만 싣고, 나머지는 눌러서 보게 합니다.
//   보려면 로그인해야 하니 받는 치과만 봅니다.
//
// ★ 보내는 것과 글 만드는 것을 나눕니다. 글은 시험할 수 있어야
//   하는데, 보내는 쪽은 시험할 때마다 진짜 메일이 나갑니다.
//
// ★ 방향이 둘입니다 (설계서 §8.5 · InvoiceSheet 와 같은 규칙).
//     디자인센터 → 치과       '청구서'
//     기공소     → 디자인센터  '청구서 (기공료)'
//   기공소 것을 '청구' 로 적으면 주는 쪽이 달라는 문서가 됩니다.
// =========================================================

export interface InvoiceMailInput {
  /** 받는 곳의 조직 종류. 링크와 문서 이름이 갈립니다 */
  partyType: 'clinic' | 'lab';
  /** 받는 곳 이름 — '[안양]선한이웃치과' */
  partyName: string;
  /** '2026-08' */
  yearMonth: string;
  /** 'INV-26000489' */
  invoiceNo: string;
  /** 청구 총액(원) */
  amount: number;
  /** 납부기한 'YYYY-MM-DD' */
  dueDate: string;
  /** 'https://denflow.kr' — 뒤에 슬래시 없이 */
  siteUrl: string;
}

/** '2026-08' → '2026년 8월' */
export function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  return `${y}년 ${Number(m)}월`;
}

/** 1240000 → '1,240,000원' */
export function moneyLabel(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

/** '2026-09-10' → '2026년 9월 10일' */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

/** 눌러서 볼 곳. 로그인해야 보입니다 */
export function invoiceLink(input: InvoiceMailInput): string {
  const path = input.partyType === 'lab' ? 'lab' : 'clinic';
  return `${input.siteUrl}/${path}/billing/${input.yearMonth}`;
}

export function invoiceSubject(input: InvoiceMailInput): string {
  const what = input.partyType === 'lab' ? '기공료 청구서' : '청구서';
  return `[덴플로우] ${monthLabel(input.yearMonth)}분 ${what}입니다`;
}

const FONT =
  "-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif";

export function invoiceHtml(input: InvoiceMailInput): string {
  const title = input.partyType === 'lab' ? '기공료 청구서' : '청구서';

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6F9;margin:0;padding:32px 12px;width:100%;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E8EBF0;border-radius:12px;">

        <tr>
          <td style="padding:30px 34px 0 34px;font-family:${FONT};">
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#16324F;">DenFlow</div>
            <div style="height:3px;width:34px;background:#14B8A6;margin-top:7px;border-radius:2px;"></div>
            <div style="margin-top:9px;font-size:12.5px;color:#98A2B3;">덴플로우 디지털 기공소</div>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 34px 0 34px;font-family:${FONT};">
            <div style="font-size:19px;font-weight:700;color:#1A2130;">${monthLabel(input.yearMonth)}분 ${title}</div>
            <div style="margin-top:10px;font-size:14.5px;line-height:1.65;color:#4A5567;">
              ${input.partyName} 님, ${monthLabel(input.yearMonth)}분 ${title}가 발행되었습니다.
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 18px 0 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F7FE;border:1px solid #C6DDF9;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;font-family:${FONT};">
                  <div style="font-size:12.5px;color:#5A7FA8;">청구 금액</div>
                  <div style="margin-top:4px;font-size:26px;font-weight:800;color:#14538F;">${moneyLabel(input.amount)}</div>
                  <div style="margin-top:12px;font-size:13.5px;color:#4A5567;">
                    납부기한 <b>${dayLabel(input.dueDate)}</b><br />
                    청구서 번호 ${input.invoiceNo}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 34px 0 34px;font-family:${FONT};">
            <div style="font-size:13.5px;line-height:1.65;color:#4A5567;">
              세부내역은 아래에서 확인하실 수 있습니다.
            </div>
            <div style="margin-top:12px;">
              <a href="${invoiceLink(input)}"
                 style="display:inline-block;background:#1279E8;color:#FFFFFF;text-decoration:none;font-size:14.5px;font-weight:700;padding:12px 26px;border-radius:8px;">
                청구서 보기
              </a>
            </div>
            <div style="margin-top:10px;font-size:12.5px;color:#98A2B3;">
              환자 정보가 들어 있어 메일에는 싣지 않습니다. 로그인 후 보실 수 있습니다.
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 34px 30px 34px;font-family:${FONT};">
            <div style="border-top:1px solid #E8EBF0;padding-top:16px;font-size:12.5px;line-height:1.7;color:#98A2B3;">
              금액이 맞지 않거나 궁금한 점이 있으면 덴플로우로 연락 주세요.<br />
              이 메일은 발신 전용입니다.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
}
