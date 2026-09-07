// =========================================================
// 놓을 위치: src/server/mail/price-sheet-mail.ts
//
// 수가표 메일의 글. (사용자 요청 2026-09-07)
//
// ★ 종이 수가표(덴플로우_수가표.pdf)와 같은 모양을 메일 본문에 그립니다 —
//   같은 색, 같은 세 묶음, 같은 보증 띠. 메일 프로그램은 CSS 를 절반만
//   읽으므로 표와 인라인 스타일만 씁니다 (외부 CSS·flex 금지).
// ★ 첨부가 아니라 본문입니다. 폰에서 열어도 바로 보이고, 전달해도
//   깨지지 않습니다. PDF 는 필요해지면 그때 붙입니다.
// ★ 보내는 것과 글 만드는 것을 나눕니다 — 글은 시험할 수 있어야 합니다.
// =========================================================

import { formatWon, groupRows, type PriceRow } from '@/server/domain/price-sheet';

export interface PriceSheetMailInput {
  /** 받는 치과 이름 — 제목과 첫 줄에 */
  clinicName: string;
  rows: readonly PriceRow[];
  /** 보내는 곳 — 등록 상호·전화·메일 */
  senderName: string;
  senderTel: string;
  senderEmail: string;
  /** '2026' */
  year: string;
}

export function priceSheetSubject(input: Pick<PriceSheetMailInput, 'clinicName' | 'senderName'>): string {
  return `[${input.senderName}] ${input.clinicName} 수가표`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function priceSheetHtml(input: PriceSheetMailInput): string {
  const ink = '#16324F';
  const muted = '#5B7186';
  const line = '#E3E9EF';
  const teal = '#14B8A6';

  const groups = groupRows(input.rows);

  const body = groups
    .map(({ group, rows }) =>
      rows
        .map(
          (r, i) => `
      <tr>
        ${
          i === 0
            ? `<td rowspan="${rows.length}" style="padding:14px 12px;border-top:1px solid ${line};border-left:4px solid ${teal};font-weight:700;font-size:16px;color:${ink};vertical-align:middle;white-space:nowrap">${esc(group)}</td>`
            : ''
        }
        <td style="padding:14px 12px;border-top:1px solid ${line};font-size:15px;color:#2A4460">${esc(r.item)}</td>
        <td align="right" style="padding:14px 12px;border-top:1px solid ${line};font-size:16px;font-weight:700;color:${ink};white-space:nowrap">${formatWon(r.price)}<span style="font-size:12px;font-weight:400;color:${muted};margin-left:3px">원</span></td>
      </tr>`,
        )
        .join(''),
    )
    .join('');

  return `<!doctype html>
<html lang="ko"><body style="margin:0;background:#F4F7FA;font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;color:${ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FA;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;padding:32px 28px">
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:3px solid ${ink};padding-bottom:16px">
      <tr>
        <td style="font-size:30px;font-weight:800;letter-spacing:-0.5px;color:${ink}">수가표</td>
        <td align="right" style="font-size:13px;font-weight:700;letter-spacing:1px;color:${ink}">${esc(input.senderName)}<div style="font-size:12px;font-weight:400;color:${muted};margin-top:6px">Price List · ${esc(input.year)} · 단위: ₩ / ea</div></td>
      </tr>
    </table>

    <p style="margin:22px 0 6px;font-size:15px;line-height:1.6;color:${ink}"><b>${esc(input.clinicName)}</b> 원장님, 안녕하세요.<br>문의해 주신 수가표를 보내 드립니다.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:collapse">
      <thead>
        <tr>
          <th align="left" style="padding:12px;font-size:12px;letter-spacing:1px;color:${muted};border-bottom:1px solid ${line}">대분류</th>
          <th align="left" style="padding:12px;font-size:12px;letter-spacing:1px;color:${muted};border-bottom:1px solid ${line}">상세분류</th>
          <th align="right" style="padding:12px;font-size:12px;letter-spacing:1px;color:${muted};border-bottom:1px solid ${line}">공급가</th>
        </tr>
      </thead>
      <tbody>${body}
      </tbody>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#F0F9F7;border:1px solid #D3EEE9;border-radius:12px">
      <tr><td style="padding:16px 20px;font-size:14px;color:${ink}"><b>리메이크 1년 무상 보증</b> <span style="color:${muted};font-size:13px;margin-left:8px">제작일로부터 1년 이내 무상 리메이크를 지원합니다.</span></td></tr>
    </table>

    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid ${line};font-size:13px;line-height:1.7;color:${muted}">
      ${esc(input.senderName)} · Tel. ${esc(input.senderTel)} · ${esc(input.senderEmail)}<br>
      주문은 <a href="https://denflow.kr" style="color:${teal};font-weight:700;text-decoration:none">denflow.kr</a> 에서 회원가입 후 바로 넣으실 수 있습니다.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
