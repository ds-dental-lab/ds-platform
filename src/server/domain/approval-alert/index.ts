// =========================================================
// 놓을 위치: src/server/domain/approval-alert/index.ts
//
// 센터가 **처리해야 할 일**이 들어왔을 때 무엇을 어떻게 알릴지.
// (사용자 지적 2026-09-05 — "실제로 해보니까 알림이 오는 게 없어")
//
//   가입 신청   → 승인해야 그 치과가 들어옵니다
//   수가표 문의 → 전화해야 거래가 시작됩니다
//
// ★★ 둘 다 **늦으면 잃는 일**입니다. 신청하고 하루 넘게 소식이 없으면
//   "여기 운영은 하나" 가 되고, 그건 거래 전에 잃는 것입니다.
//   그래서 통로 셋(종·푸시·메일)에 다 보냅니다 — 한 통로만 두면
//   그 통로를 안 볼 때 놓칩니다.
//
// ★ 이 파일은 순수 함수입니다. DB 도 메일 서버도 모릅니다.
//   종 문구는 표 트리거(SQL)에도 같은 뜻으로 적혀 있습니다 — 거기는
//   여기서 못 부르니, 문구를 바꾸면 둘 다 보세요.
// =========================================================

import type { PushPayload } from '../push';

const SECTOR_NAME: Record<string, string> = {
  clinic: '치과',
  lab: '기공소',
};

export interface SignupAlertInput {
  orgName: string;
  orgType: string;
}

/** 폰·PC 푸시. 누르면 승인 화면으로 */
export function signupPush(input: SignupAlertInput): PushPayload {
  return {
    title: '가입 신청이 들어왔습니다',
    body: `${input.orgName} · ${SECTOR_NAME[input.orgType] ?? input.orgType}`,
    link: '/design/signups',
    // ★ 같은 딱지 — 신청이 셋 오면 폰에 알림 셋이 쌓이지 않고 갈아끼웁니다
    tag: 'signup-requested',
  };
}

export interface ContactAlertInput {
  clinicName: string;
}

export function contactPush(input: ContactAlertInput): PushPayload {
  return {
    title: '수가표 문의가 들어왔습니다',
    body: input.clinicName,
    link: '/design/contacts',
    tag: 'contact-requested',
  };
}

/**
 * HOME 띠 한 줄.
 *
 * ★ 둘을 **갈라서** 셉니다. '할 일 3건' 은 무엇을 해야 하는지 모릅니다 —
 *   승인과 전화는 다른 일이고 다른 화면입니다.
 */
export function approvalSummary(counts: { signups: number; contacts: number }): string {
  const parts: string[] = [];
  if (counts.signups > 0) parts.push(`가입 신청 ${counts.signups}건`);
  if (counts.contacts > 0) parts.push(`수가표 문의 ${counts.contacts}건`);

  return parts.join(' · ');
}

export function hasApprovalWork(counts: { signups: number; contacts: number }): boolean {
  return counts.signups > 0 || counts.contacts > 0;
}

// ---------- 메일 ----------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 메일 틀. 청구서 메일과 같은 결 — 한 문단, 단추 하나.
 *
 * ★ 내용을 길게 안 씁니다. 메일은 "가서 보라" 는 신호이고 진짜
 *   내용은 로그인해야 보이는 화면에 있습니다.
 */
function mailShell(title: string, line: string, buttonLabel: string, link: string): string {
  return (
    `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;color:#1A2130">` +
    `<p style="font-size:13px;color:#98A2B3;margin:0 0 14px">덴플로우 디지털 기공소</p>` +
    `<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>` +
    `<p style="font-size:15px;line-height:1.7;margin:0 0 22px">${escapeHtml(line)}</p>` +
    `<a href="${link}" style="display:inline-block;background:#1279E8;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;font-size:15px">${escapeHtml(buttonLabel)}</a>` +
    `<p style="font-size:12px;color:#98A2B3;margin:26px 0 0">이 메일은 덴플로우 관리자에게만 갑니다. 로그인해야 내용이 보입니다.</p>` +
    `</div>`
  );
}

export interface MailDraft {
  subject: string;
  html: string;
}

export function signupMail(input: SignupAlertInput, siteUrl: string): MailDraft {
  const sector = SECTOR_NAME[input.orgType] ?? input.orgType;
  return {
    subject: `[덴플로우] 가입 신청 · ${input.orgName}`,
    html: mailShell(
      '가입 신청이 들어왔습니다',
      `${input.orgName}(${sector})이 거래를 신청했습니다. 승인해야 들어올 수 있습니다.`,
      '승인하러 가기',
      `${siteUrl}/design/signups`,
    ),
  };
}

export function contactMail(input: ContactAlertInput, siteUrl: string): MailDraft {
  return {
    subject: `[덴플로우] 수가표 문의 · ${input.clinicName}`,
    html: mailShell(
      '수가표 문의가 들어왔습니다',
      `${input.clinicName}에서 수가표를 요청했습니다. 연락처는 문의 목록에 있습니다.`,
      '문의 보러 가기',
      `${siteUrl}/design/contacts`,
    ),
  };
}
