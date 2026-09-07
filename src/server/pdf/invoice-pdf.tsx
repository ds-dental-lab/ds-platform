// =========================================================
// 놓을 위치: src/server/pdf/invoice-pdf.tsx
//
// 청구서 PDF. (사용자 요청 2026-09-07 — "청구서 보기에서 PDF 다운로드,
// 메일에도 PDF 로 받는 선택권")
//
// ★ 화면의 InvoiceSheet 와 **같은 내용, 같은 순서**입니다 — 머리(제목·
//   기간·발행일·입금) → 공급자/공급받는 자 → 총액 → 청구 내역(제품별)
//   → 조정 내역 → 보철 세부내역 → 꼬리. 한쪽만 고치면 두 문서가 다른
//   말을 하게 되니, 내용을 바꿀 때는 둘을 같이 봅니다.
//
// ★ 서버에서 만듭니다. 브라우저 인쇄창의 'PDF 로 저장' 은 여백·머리글이
//   기계마다 달라 같은 청구서가 다른 모양으로 남았습니다. 서버가 만들면
//   누가 어디서 받아도 같은 파일입니다.
//
// ★ 글꼴은 Noto Sans KR 을 우리 파일로 심습니다 (public/fonts — Windows 의
//   가변 글꼴에서 한글 음절 전부 + 라틴·기호만 뽑은 정적 2벌, 각 2.4MB).
//   PDF 는 글꼴을 안에 품어야 어디서 열어도 한글이 안 깨집니다.
//   Vercel 에서는 함수 안에 안 넣고(크기) 우리 사이트에서 받아 옵니다 —
//   한 번 받으면 프로세스가 살아 있는 동안 다시 안 받습니다.
// =========================================================

import 'server-only';
import path from 'node:path';
import React from 'react';
import { Document, Page, Text, View, Font, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { groupInvoiceLines, formatTeeth } from '@/server/domain/billing';
import type { InvoiceSheetProps } from '@/components/billing/InvoiceSheet';

const FAMILY = 'NotoSansKR';
let registered = false;

function fontSrc(file: string): string {
  if (process.env.VERCEL) return `https://denflow.kr/fonts/${file}`;
  return path.join(process.cwd(), 'public', 'fonts', file);
}

function ensureFonts() {
  if (registered) return;
  Font.register({
    family: FAMILY,
    fonts: [
      { src: fontSrc('NotoSansKR-Regular.ttf'), fontWeight: 400 },
      { src: fontSrc('NotoSansKR-Bold.ttf'), fontWeight: 700 },
    ],
  });
  // ★ 한글은 하이픈으로 안 끊습니다 — 단어 중간에 '-' 가 끼면 이상합니다
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const INK = '#1A2130';
const MUTED = '#98A2B3';
const SOFT = '#4A5567';
const LINE = '#E8EBF0';
const WARN = '#C2721B';

const s = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: 9.5, color: INK, paddingTop: 36, paddingBottom: 44, paddingHorizontal: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: INK, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5 },
  sub: { marginTop: 3, fontSize: 9.5, color: SOFT },
  meta: { fontSize: 9, color: SOFT, textAlign: 'right' },
  parties: { flexDirection: 'row', gap: 14, marginTop: 16 },
  party: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9 },
  partyTitle: { fontSize: 8, fontWeight: 700, color: MUTED },
  partyName: { marginTop: 3, fontSize: 12, fontWeight: 700 },
  partyLine: { flexDirection: 'row', marginTop: 2, fontSize: 8.5, color: SOFT },
  partyKey: { width: 52, color: MUTED },
  total: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F4F6F9', borderRadius: 6, paddingHorizontal: 18, paddingVertical: 11 },
  totalLabel: { fontSize: 10.5, fontWeight: 700 },
  totalAmount: { fontSize: 20, fontWeight: 700, letterSpacing: -0.3 },
  section: { marginTop: 18 },
  h2: { fontSize: 10.5, fontWeight: 700, marginBottom: 5 },
  thead: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: INK, paddingVertical: 4, fontSize: 8.5, fontWeight: 700 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 4 },
  tfoot: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: INK, paddingVertical: 4, fontWeight: 700 },
  tfootTotal: { flexDirection: 'row', borderTopWidth: 2, borderTopColor: INK, paddingVertical: 5, fontWeight: 700, fontSize: 11 },
  cell: { paddingHorizontal: 4 },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  muted: { color: MUTED },
  warn: { color: WARN, fontWeight: 700 },
  empty: { paddingVertical: 18, textAlign: 'center', color: MUTED },
  note: { marginTop: 5, fontSize: 8.5, color: SOFT },
  footer: { position: 'absolute', left: 40, right: 40, bottom: 22, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6, fontSize: 8, color: MUTED, flexDirection: 'row', justifyContent: 'space-between' },
});

function won(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₩${Math.abs(value).toLocaleString('ko-KR')}`;
}

function day(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function Party({ title, org }: { title: string; org: InvoiceSheetProps['issuer'] }) {
  return (
    <View style={s.party}>
      <Text style={s.partyTitle}>{title}</Text>
      <Text style={s.partyName}>{org.name}</Text>
      {[
        ['대표자', org.ceoName || '-'],
        ['사업자번호', org.bizNo || '-'],
        ['주소', org.address || '-'],
      ].map(([k, v]) => (
        <View key={k} style={s.partyLine}>
          <Text style={s.partyKey}>{k}</Text>
          <Text style={{ flex: 1 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

export function InvoicePdf(props: InvoiceSheetProps) {
  const { parties, issuer, receiver, yearMonth, settlement, issuedAt, paidAt } = props;
  const adjustments = settlement.items.filter((i) => i.adjustment !== 0);
  const remakes = settlement.items.filter((i) => !i.billable);
  const lines = groupInvoiceLines(settlement.items, (id) => settlement.bridgeOf[id] ?? null);
  const unitCount = settlement.products.reduce((n, p) => n + p.count, 0);

  // 열 폭 — 화면 표와 같은 비율
  const P = { no: 30, label: 0, count: 50, amount: 80 };
  const D = { date: 54, patient: 0, product: 0, teeth: 64, count: 34, adj: 56, amount: 68 };

  return (
    <Document title={`${parties.title} ${receiver.name} ${yearMonth}`} author={issuer.name} language="ko">
      <Page size="A4" style={s.page}>
        {/* ---------- 머리 ---------- */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>{parties.title}</Text>
            <Text style={s.sub}>
              {yearMonth} · {settlement.from} ~ {settlement.to}
            </Text>
          </View>
          <View>
            <Text style={s.meta}>발행일  {day(issuedAt) || '미발행'}</Text>
            <Text style={[s.meta, { marginTop: 2 }]}>입금  {day(paidAt) || '미입금'}</Text>
          </View>
        </View>

        {/* ---------- 공급자 / 공급받는 자 ---------- */}
        <View style={s.parties}>
          <Party title="공급자 (청구)" org={issuer} />
          <Party title="공급받는 자" org={receiver} />
        </View>

        {/* ---------- 총액 ---------- */}
        <View style={s.total}>
          <Text style={s.totalLabel}>{parties.amountLabel}</Text>
          <Text style={s.totalAmount}>₩{settlement.total.toLocaleString('ko-KR')}</Text>
        </View>

        {/* ---------- 청구 내역 (제품별) ---------- */}
        <View style={s.section}>
          <Text style={s.h2}>청구 내역</Text>
          <View style={s.thead}>
            <Text style={[s.cell, s.center, { width: P.no }]}>#</Text>
            <Text style={[s.cell, { flex: 1 }]}>제품</Text>
            <Text style={[s.cell, s.right, { width: P.count }]}>수량</Text>
            <Text style={[s.cell, s.right, { width: P.amount }]}>금액</Text>
          </View>
          {settlement.products.length === 0 ? (
            <Text style={s.empty}>이 기간에 청구할 건이 없습니다.</Text>
          ) : (
            settlement.products.map((row, i) => (
              <View key={row.key} style={s.tr}>
                <Text style={[s.cell, s.center, s.muted, { width: P.no }]}>{i + 1}</Text>
                <Text style={[s.cell, { flex: 1 }]}>{row.label}</Text>
                <Text style={[s.cell, s.right, { width: P.count }]}>{row.count}</Text>
                <Text style={[s.cell, s.right, { width: P.amount }]}>{won(row.amount)}</Text>
              </View>
            ))
          )}
          <View style={s.tfoot}>
            <Text style={[s.cell, { flex: 1 }]}>보철 합계</Text>
            <Text style={[s.cell, s.right, { width: P.count }]}>{unitCount}</Text>
            <Text style={[s.cell, s.right, { width: P.amount }]}>{won(settlement.subtotal)}</Text>
          </View>
          {settlement.adjustment !== 0 && (
            <View style={[s.tr, { fontWeight: 700 }]}>
              <Text style={[s.cell, { flex: 1 }]}>조정 금액</Text>
              <Text style={[s.cell, s.right, { width: P.amount }]}>{won(settlement.adjustment)}</Text>
            </View>
          )}
          <View style={s.tfootTotal}>
            <Text style={[s.cell, { flex: 1 }]}>합계</Text>
            <Text style={[s.cell, s.right, { width: P.amount }]}>{won(settlement.total)}</Text>
          </View>
        </View>

        {/* ---------- 조정 내역 ---------- */}
        {adjustments.length > 0 && (
          <View style={s.section}>
            <Text style={s.h2}>조정 내역</Text>
            <View style={s.thead}>
              <Text style={[s.cell, { width: 90 }]}>환자</Text>
              <Text style={[s.cell, s.center, { width: 44 }]}>치식</Text>
              <Text style={[s.cell, { flex: 1 }]}>제품</Text>
              <Text style={[s.cell, { flex: 1 }]}>사유</Text>
              <Text style={[s.cell, s.right, { width: 76 }]}>조정</Text>
            </View>
            {adjustments.map((item) => (
              <View key={item.itemId} style={s.tr}>
                <Text style={[s.cell, { width: 90 }]}>{item.patientLabel}</Text>
                <Text style={[s.cell, s.center, { width: 44 }]}>{item.toothNumber}</Text>
                <Text style={[s.cell, { flex: 1 }]}>{item.label}</Text>
                <Text style={[s.cell, { flex: 1 }]}>{item.adjustmentReason || '-'}</Text>
                <Text style={[s.cell, s.right, { width: 76, fontWeight: 700 }]}>{won(item.adjustment)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ---------- 보철 세부내역 ---------- */}
        <View style={s.section}>
          <Text style={s.h2}>
            보철 세부내역 ({lines.length}건 · {settlement.items.length}유닛)
          </Text>
          <View style={s.thead}>
            <Text style={[s.cell, { width: D.date }]}>접수일</Text>
            <Text style={[s.cell, { width: D.date }]}>배송일</Text>
            <Text style={[s.cell, { flex: 1 }]}>환자</Text>
            <Text style={[s.cell, { flex: 1.3 }]}>제품</Text>
            <Text style={[s.cell, { width: D.teeth }]}>치식</Text>
            <Text style={[s.cell, s.right, { width: D.count }]}>수량</Text>
            <Text style={[s.cell, s.right, { width: D.adj }]}>조정</Text>
            <Text style={[s.cell, s.right, { width: D.amount }]}>금액</Text>
          </View>
          {lines.length === 0 ? (
            <Text style={s.empty}>이 기간에 청구할 건이 없습니다.</Text>
          ) : (
            lines.map((line) => {
              const pink = line.items.filter((i) => i.hasGingival).length;
              return (
                <View key={line.key} style={s.tr} wrap={false}>
                  <Text style={[s.cell, { width: D.date }]}>{day(line.first.receivedAt)}</Text>
                  <Text style={[s.cell, { width: D.date }]}>{day(line.first.shippedAt)}</Text>
                  <Text style={[s.cell, { flex: 1 }]}>
                    {line.first.patientLabel}
                    {line.first.isRemake ? <Text style={s.warn}> {line.first.remakeSeq}차</Text> : null}
                  </Text>
                  <Text style={[s.cell, { flex: 1.3 }]}>
                    {line.label}
                    {pink > 0 ? <Text style={s.muted}> +핑크 {pink}</Text> : null}
                  </Text>
                  <Text style={[s.cell, { width: D.teeth }]}>{formatTeeth(line.teeth, line.isBridge)}</Text>
                  <Text style={[s.cell, s.right, { width: D.count }]}>{line.count}</Text>
                  <Text style={[s.cell, s.right, { width: D.adj }]}>{line.adjustment === 0 ? '' : won(line.adjustment)}</Text>
                  {line.first.billable ? (
                    <Text style={[s.cell, s.right, { width: D.amount }]}>{won(line.amount)}</Text>
                  ) : (
                    <Text style={[s.cell, s.right, { width: D.amount, color: WARN }]}>₩0 (재제작)</Text>
                  )}
                </View>
              );
            })
          )}
          {remakes.length > 0 && (
            <Text style={s.note}>
              재제작 {remakes.length}건은 청구하지 않습니다. 무엇을 다시 만들었는지 남기려고 함께 적었습니다.
            </Text>
          )}
        </View>

        {/* ---------- 꼬리 (쪽마다) ---------- */}
        <View style={s.footer} fixed>
          <Text>이 문서는 DenFlow 에서 자동으로 만들어졌습니다. 금액이 다르면 발행처에 알려 주세요.</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** PDF 바이트. 부르는 쪽(route)이 파일 이름과 헤더를 답니다 */
export async function renderInvoicePdf(props: InvoiceSheetProps): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<InvoicePdf {...props} />);
}
