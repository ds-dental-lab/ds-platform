// =========================================================
// 놓을 위치: src/components/order/NewOrderForm.tsx
//
// 주문 등록. (기능명세서 §4.2, 시안 data-page="order-new")
//
// 구성 — 시안의 카드 순서를 그대로 따릅니다.
//   ① 환자정보 (이름 · 요청시한 · 주문유형 · 치과)
//   ② 보철선택 + 임플란트 모델 + 치식선택
//   ③ 제작옵션 · 기타 요청사항 (2열)
//   ④ 스캔/쉐이드 파일
//   ⑤ 주문완료
//
// ★ 입력 순서는 ① 종류 → ② 재료 → ③ 쉐이드 → ④ 치식 입니다 (§4.2).
//   앞 단계가 비면 치아를 눌러도 등록되지 않고 무엇이 빠졌는지 알려 줍니다.
// =========================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PatientPicker, { type Patient } from '@/components/order/PatientPicker';
import OrderSection, { SECTION_ICON } from '@/components/order/OrderSection';
import ProductionOptionPanel from '@/components/order/ProductionOptionPanel';
import LeaveGuard from '@/components/order/LeaveGuard';
import DueDatePicker from '@/components/order/DueDatePicker';
import ShadeButton from '@/components/order/ShadeButton';
import ScanDropZone from '@/components/order/ScanDropZone';
import ToothChart from '@/components/dental/ToothChart';
import ProsthesisSummary from '@/components/dental/ProsthesisSummary';
import ImplantModelDialog from '@/components/dental/ImplantPicker/ImplantModelDialog';
import {
  submitAddImplantFavorite,
  submitRemoveImplantFavorite,
} from '@/server/actions/implant';
import { submitOrder, submitUpdateOrder } from '@/server/actions/order';
import { uploadOrderFiles } from '@/lib/upload';
import {
  type ProsthesisCatalog,
  getMaterials,
  colorOfType,
  allowsGingival,
  buildAbbr,
} from '@/server/domain/prosthesis';
import { addPlacement, type Placement } from '@/server/domain/duplicate';
import {
  EMPTY_SHADE,
  formatShade,
  SHADE_SYSTEMS,
  type ToothShade,
  type ShadeSystemCode,
} from '@/server/domain/shade';
import {
  EMPTY_SELECTION,
  formatSelection,
  isComplete as implantComplete,
  type ImplantCatalog,
  type ImplantSelection,
} from '@/server/domain/implant';
import { ORDER_TYPE_LABEL } from '@/lib/format/order';
import type { ToothPlacement } from '@/server/domain/bridge';
import type { SummaryLine } from '@/server/domain/summary';
import type { ImplantFavorite } from '@/server/repositories/implant';
import type { ProductionOptionGroup } from '@/server/repositories/production-option';
import type { OptionPreset } from '@/server/repositories/option-preset';
import type { IsoDate } from '@/server/domain/week';
import type { OrderFormInitial } from '@/components/order/orderFormInitial';

interface Entry extends ToothPlacement {
  shadeSystem: string;
  shade: ToothShade;
  implant: ImplantSelection;
  /** 치은포셀린. 휠클릭으로 붙였다 뗍니다 */
  hasGingival: boolean;
}

/**
 * 화면에서 고를 수 있는 주문유형.
 * 리페어는 주문상세의 별도 신청 경로로 들어옵니다.
 * with_model · model_only 는 옛 주문에만 남아 있어 목록에서 뺍니다.
 */
const ORDER_TYPES = ['modelless', 'analog'] as const;

export interface NewOrderFormProps {
  clinicName: string;
  today: IsoDate;
  defaultDue: IsoDate;
  implantCatalog: ImplantCatalog;
  implantFavorites: ImplantFavorite[];
  optionGroups: ProductionOptionGroup[];
  optionPresets: OptionPreset[];
  /** 제품탭에서 켜 둔 보철 종류·재료. 새 제품을 넣으면 여기로 따라 들어옵니다 */
  prosthesisCatalog: ProsthesisCatalog;
  /**
   * 고칠 주문. 주면 수정 모드가 됩니다.
   * 접수 상태에서만 넘어옵니다 — 재스캔은 파일만 바꿉니다 (설계서 §2.1 C-4).
   */
  initial?: OrderFormInitial;
}

/**
 * 주문등록 껍데기.
 *
 * ★ 같은 주소로 이동하면 리액트가 컴포넌트를 죽이지 않습니다.
 *   '새 주문 등록' 도, 사이드바에서 주문등록을 다시 누르는 것도
 *   같은 주소라 지난 주문이 그대로 남아 있었습니다.
 *
 *   키를 갈아 끼워 통째로 새로 태어나게 합니다. 칸이 늘어나도
 *   초기화를 빠뜨릴 일이 없습니다 — 하나하나 지우지 않으니까요.
 */
export default function NewOrderForm(props: NewOrderFormProps) {
  const [generation, setGeneration] = useState(0);

  return (
    <OrderFormBody
      key={generation}
      {...props}
      onStartOver={() => setGeneration((g) => g + 1)}
    />
  );
}

function OrderFormBody({
  onStartOver,
  clinicName,
  today,
  defaultDue,
  implantCatalog,
  implantFavorites,
  optionGroups,
  optionPresets,
  prosthesisCatalog,
  initial,
}: NewOrderFormProps & { onStartOver: () => void }) {
  const router = useRouter();
  const editing = Boolean(initial);

  // ---------- 환자정보 ----------
  // 적힌 글자와, 그 글자가 실제 환자와 맞아떨어졌을 때의 환자.
  // 안 맞아도 주문은 나갑니다 — 이름만 적고 지나가는 경우가 더 많습니다.
  const [patientText, setPatientText] = useState(initial?.patientText ?? '');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [dueDate, setDueDate] = useState<IsoDate>(initial?.dueDate ?? defaultDue);
  const [orderType, setOrderType] = useState<string>(initial?.orderType ?? 'modelless');

  // ---------- 보철선택 ----------
  const [typeCode, setTypeCode] = useState<string>(prosthesisCatalog[0]?.code ?? 'crown');
  const [materialCode, setMaterialCode] = useState(getMaterials(prosthesisCatalog, prosthesisCatalog[0]?.code ?? 'crown')[0]?.code ?? '');
  const [shadeSystem, setShadeSystem] = useState<ShadeSystemCode>('vita_classic');
  const [shade, setShade] = useState<ToothShade>(EMPTY_SHADE);
  const [implant, setImplant] = useState<ImplantSelection>(EMPTY_SELECTION);
  const [shadeOpen, setShadeOpen] = useState(false);
  /**
   * 쉐이드 없이 먼저 누른 치아.
   *
   * ★ 원래 순서는 종류 → 재료 → 쉐이드 → 치식 이지만
   *   치식부터 누르는 사람이 많습니다. 그때 쫓아내지 않고
   *   쉐이드창을 대신 띄운 뒤, 고르고 나면 그 치아에 바로 찍어 줍니다.
   */
  const [pendingTooth, setPendingTooth] = useState<number | null>(null);
  /** 열려 있는 모델 팝업 — 'pick' 은 이번 주문용, 'favorite' 은 즐겨찾기 등록 */
  const [modelDialog, setModelDialog] = useState<'pick' | 'favorite' | null>(null);

  // ---------- 치식선택 ----------
  const [isPontic, setIsPontic] = useState(false);
  const [entries, setEntries] = useState<Entry[]>(initial?.entries ?? []);
  const [severedKeys, setSeveredKeys] = useState<string[]>([]);

  // ---------- 제작옵션 · 나머지 ----------
  const [options, setOptions] = useState<Record<string, string>>(() => {
    const defaults = Object.fromEntries(
      optionGroups
        .map((g) => [g.id, (g.values.find((v) => v.isDefault) ?? g.values[0])?.id])
        .filter(([, v]) => Boolean(v)) as [string, string][],
    );
    // 저장된 값이 있으면 덮어씁니다. 못 찾은 줄은 기본값 그대로 둡니다
    return { ...defaults, ...(initial?.options ?? {}) };
  });
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [createdOrderNo, setCreatedOrderNo] = useState('');

  /** 주문완료를 한 번이라도 눌렀는가. 누르기 전에는 빈 칸을 지적하지 않습니다 */
  const [showProblems, setShowProblems] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);

  /** 다 끝난 주문. 주문번호를 보여 주고 다음 할 일을 고르게 합니다 */
  const [done, setDone] = useState<{ orderId: string; orderNo: string } | null>(null);

  const materials = getMaterials(prosthesisCatalog, typeCode);
  const isImplant = typeCode === 'implant';

  /** 지금 찍는 조건 — 'Zir-Cr · Vita classic A3 · 폰틱' */
  const brushLabel = [
    buildAbbr(prosthesisCatalog, typeCode, materialCode),
    formatShade(shade)
      ? `${SHADE_SYSTEMS.find((s) => s.code === shadeSystem)?.name ?? ''} ${formatShade(shade)}`
      : null,
    isPontic ? '폰틱' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const shades: Record<number, ToothShade> = {};
  const implants: Record<number, ImplantSelection> = {};
  for (const e of entries) {
    shades[e.tooth] = e.shade;
    if (e.typeCode === 'implant') implants[e.tooth] = e.implant;
  }

  // ---------- 입력 순서 ----------
  /** 치아를 누르기 전에 채워져 있어야 하는 것 (명세서 §4.2) */
  function missingStep(): string | null {
    if (!typeCode) return '보철물 종류를 선택해 주세요';
    if (!materialCode) return '재료를 선택해 주세요';
    if (!isPontic && shade.cervical === null) return '쉐이드를 선택해 주세요';
    if (isImplant && !isPontic && !implantComplete(implantCatalog, implant)) {
      return '임플란트 모델을 선택해 주세요';
    }
    return null;
  }

  function changeType(next: string) {
    setTypeCode(next);
    setMaterialCode(getMaterials(prosthesisCatalog, next)[0]?.code ?? '');
    if (next !== 'implant') setImplant(EMPTY_SELECTION);
    if (next === 'inlay') setIsPontic(false);
    setHint('');
  }

  function handleToothClick(tooth: number) {
    setError('');

    const blocked = missingStep();
    if (blocked) {
      // ★ 쉐이드만 비었다면 막지 않고 창을 대신 띄웁니다.
      //   고르고 나면 지금 누른 치아에 그대로 찍힙니다.
      if (blocked.includes('쉐이드')) {
        setPendingTooth(tooth);
        setShadeOpen(true);
        setHint('');
        return;
      }

      setHint(blocked);
      if (blocked.includes('임플란트')) setModelDialog('pick');
      return;
    }

    setHint('');
    placeTooth(tooth, shadeSystem, shade);
  }

  /** 치아 하나에 지금 조건대로 보철을 얹습니다 */
  function placeTooth(tooth: number, useSystem: string, useShade: ToothShade) {
    const current: Placement[] = entries
      .filter((e) => e.tooth === tooth)
      .map(({ typeCode: t, materialCode: m }) => ({ typeCode: t, materialCode: m }));

    const result = addPlacement(current, { typeCode, materialCode });
    const kept = entries.filter((e) => e.tooth !== tooth);

    const rebuilt: Entry[] = result.placements.map((p) => {
      const old = entries.find(
        (e) => e.tooth === tooth && e.typeCode === p.typeCode && e.materialCode === p.materialCode,
      );
      if (old) return old;

      return {
        tooth,
        typeCode: p.typeCode,
        materialCode: p.materialCode,
        isPontic,
        shadeSystem: useSystem,
        shade: useShade,
        implant,
        hasGingival: false,
      };
    });

    setEntries([...kept, ...rebuilt]);
  }

  /** 쉐이드창에서 확인을 눌렀을 때 */
  function handleShadeApply(nextSystem: ShadeSystemCode, nextShade: ToothShade) {
    setShadeSystem(nextSystem);
    setShade(nextShade);
    setHint('');

    const tooth = pendingTooth;
    setPendingTooth(null);
    if (tooth === null) return;

    // 선택 해제하고 닫았다면 얹을 것이 없습니다
    if (nextShade.cervical === null && nextShade.incisal === null) {
      setHint('쉐이드를 골라야 치아에 넣을 수 있습니다');
      return;
    }

    // 임플란트인데 모델이 아직이면 다음 관문으로 넘깁니다
    if (isImplant && !isPontic && !implantComplete(implantCatalog, implant)) {
      setHint('임플란트 모델을 선택해 주세요');
      setModelDialog('pick');
      return;
    }

    placeTooth(tooth, nextSystem, nextShade);
  }

  /**
   * 우클릭 — 폰틱을 찍거나 지웁니다.
   *
   * ★ 세 번째 상태를 만들지 않습니다.
   *   빈 치아 → 폰틱 → (다시 우클릭) 빈 치아.
   *   폰틱을 일반 치아로 되돌리는 길은 두지 않았습니다 —
   *   그건 왼쪽 클릭이 하는 일이고, 우클릭까지 그러면 지울 방법이 없어집니다.
   */
  function handleTogglePontic(tooth: number) {
    setError('');

    const mine = entries.filter((e) => e.tooth === tooth);

    // 이미 폰틱이면 지웁니다
    if (mine.length > 0 && mine.some((e) => e.isPontic)) {
      setHint(`${tooth}번을 지웠습니다`);
      setEntries(entries.filter((e) => e.tooth !== tooth));
      return;
    }

    if (typeCode === 'inlay') {
      setHint('인레이는 폰틱이 될 수 없습니다');
      return;
    }

    // 이미 일반 보철이 있으면 폰틱으로 바꿉니다
    if (mine.length > 0) {
      setHint('');
      setEntries(entries.map((e) => (e.tooth === tooth ? { ...e, isPontic: true } : e)));
      return;
    }

    // 빈 치아라면 폰틱으로 새로 찍습니다.
    // ★ 폰틱은 쉐이드·임플란트 모델이 없어도 됩니다 — 색을 낼 치아가 아닙니다.
    if (!typeCode || !materialCode) {
      setHint('보철물 종류와 재료를 먼저 고르세요');
      return;
    }

    setHint('');
    setEntries([
      ...entries,
      {
        tooth,
        typeCode,
        materialCode,
        isPontic: true,
        shadeSystem,
        shade,
        implant,
        hasGingival: false,
      },
    ]);
  }

  /**
   * 휠클릭 — 치은포셀린을 붙였다 뗍니다.
   * 추가 과금 항목이고, 인레이에는 붙지 않습니다.
   */
  function handleToggleGingival(tooth: number) {
    setError('');

    const mine = entries.filter((e) => e.tooth === tooth);

    if (mine.length === 0) {
      setHint('보철을 먼저 찍은 뒤 치은포셀린을 붙일 수 있습니다');
      return;
    }

    if (!mine.every((e) => allowsGingival(e.typeCode))) {
      setHint('인레이에는 치은포셀린을 붙일 수 없습니다');
      return;
    }

    const next = !mine[0].hasGingival;
    setHint(
      next
        ? `${tooth}번에 치은포셀린을 붙였습니다 — 추가 과금됩니다`
        : `${tooth}번의 치은포셀린을 뗐습니다`,
    );

    setEntries(
      entries.map((e) => (e.tooth === tooth ? { ...e, hasGingival: next } : e)),
    );
  }

  function handleRemoveLine(line: SummaryLine) {
    setEntries((prev) =>
      prev.filter((e) => !(e.typeCode === line.typeCode && e.materialCode === line.materialCode)),
    );
  }

  function handleReset() {
    setEntries([]);
    setSeveredKeys([]);
    setError('');
    setHint('');
  }

  async function handleSubmit() {
    // ★ 버튼을 잠가 두지 않습니다.
    //   눌러도 아무 일이 없으면 왜 안 되는지 알 수가 없습니다.
    //   누른 뒤에 무엇이 빈지 알려 주고, 그때부터 칸에도 표시를 답니다.
    if (missingFields.length > 0) {
      setShowProblems(true);
      setProblemsOpen(true);
      return;
    }

    setError('');
    setSaving(true);
    setProgress('');

    /** 주문 하나로 묶어 보낼 항목들 — 등록과 수정이 같은 모양을 씁니다 */
    const payload = {
      patientId: patient?.id ?? null,
      patientLabel: patientText.trim(),
      orderType: orderType as 'modelless' | 'analog',
      dueDate,
      notes,
      severedKeys,
      options,
      items: entries.map((e) => ({
        tooth: e.tooth,
        typeCode: e.typeCode,
        materialCode: e.materialCode,
        isPontic: e.isPontic,
        shadeSystem: e.shadeSystem,
        shadeCervical: e.shade.cervical,
        shadeIncisal: e.shade.incisal,
        implantManufacturer: e.implant.manufacturerCode,
        implantType: e.implant.typeCode,
        implantSize: e.implant.sizeCode,
        implantScrew: e.implant.screwCode,
        implantOption: e.implant.option,
        hasGingival: e.hasGingival,
      })),
    };

    // ---------- 수정 ----------
    if (initial) {
      const result = await submitUpdateOrder({ ...payload, orderId: initial.orderId });
      setSaving(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/clinic/orders/${initial.orderId}`);
      router.refresh();
      return;
    }

    // ---------- 등록 ----------
    let orderId = createdOrderId;
    let orderNo = createdOrderNo;

    if (!orderId) {
      const result = await submitOrder(payload);

      if (!result.ok) {
        setSaving(false);
        setError(result.error);
        return;
      }

      orderId = result.orderId;
      orderNo = result.orderNo;
      setCreatedOrderId(orderId);
      setCreatedOrderNo(orderNo);
    }

    if (pendingFiles.length > 0) {
      setProgress('파일 올리는 중…');

      const upload = await uploadOrderFiles(orderId, pendingFiles, (done, total) => {
        setProgress(`파일 올리는 중 ${done} / ${total}`);
      });

      setPendingFiles((prev) => prev.filter((f) => upload.failed.includes(f.name)));
      setSaving(false);
      setProgress('');

      if (!upload.ok) {
        setError(
          `주문은 등록되었습니다. 다만 파일 ${upload.failed.length}개를 올리지 못했습니다. 다시 시도를 눌러 주세요.`,
        );
        return;
      }
    }

    setSaving(false);
    setDone({ orderId, orderNo });
  }

  /** 안내창에서 항목을 누르면 그 자리로 데려갑니다 */
  function jumpTo(anchor: string) {
    setProblemsOpen(false);
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * 무엇이 비어 있는지.
   *
   * ★ 처음부터 띄우지 않습니다.
   *   아직 아무것도 안 한 사람에게 빨간 글씨부터 보이면 잔소리가 됩니다.
   *   주문완료를 한 번 누른 뒤부터 (showProblems) 보여 줍니다.
   */
  const missingFields: Array<{ label: string; anchor: string }> = [];

  if (!patientText.trim()) missingFields.push({ label: '환자 이름', anchor: 'sec-patient' });
  if (!dueDate) missingFields.push({ label: '요청시한', anchor: 'sec-patient' });
  if (entries.length === 0) {
    missingFields.push({ label: '제작보철 (치식 선택)', anchor: 'sec-prosthesis' });
  }

  // ★ 스캔 파일이 없으면 디자인센터가 열어 볼 것이 없습니다.
  //   이름·치식과 같은 자리의 필수 항목입니다.
  //   수정 모드에서는 이미 올라간 파일이 있으므로 묻지 않습니다.
  if (!editing && pendingFiles.length === 0) {
    missingFields.push({ label: '스캔 파일', anchor: 'sec-files' });
  }

  // 임플란트인데 모델이 덜 채워진 치아
  const implantGaps = entries
    .filter(
      (e) =>
        e.typeCode === 'implant' &&
        !e.isPontic &&
        !implantComplete(implantCatalog, e.implant),
    )
    .map((e) => e.tooth);

  if (implantGaps.length > 0) {
    missingFields.push({
      label: `임플란트 모델 (${[...new Set(implantGaps)].join(', ')}번)`,
      anchor: 'sec-prosthesis',
    });
  }

  /** 주문완료를 눌러 본 뒤, 아직 비어 있는 칸에 표시를 답니다 */
  function problemAt(anchor: string): boolean {
    return showProblems && missingFields.some((f) => f.anchor === anchor);
  }

  /**
   * 지킬 것이 있는가.
   *
   * ★ 요청시한·주문유형은 처음부터 값이 들어 있어 세지 않습니다.
   *   손도 안 댄 폼에서 나가려는데 묻는 건 성가시기만 합니다.
   *   이미 저장된 뒤(done)에도 묻지 않습니다 — 잃을 것이 없습니다.
   */
  const dirty = editing
    // 수정 모드는 처음부터 값이 차 있습니다. 무엇이든 손댔으면 지킵니다
    ? patientText !== initial!.patientText ||
      notes !== initial!.notes ||
      dueDate !== initial!.dueDate ||
      orderType !== initial!.orderType ||
      entries.length !== initial!.entries.length ||
      pendingFiles.length > 0
    : !done &&
      (patientText.trim().length > 0 ||
        entries.length > 0 ||
        notes.trim().length > 0 ||
        pendingFiles.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <LeaveGuard
        dirty={dirty}
        onStartOver={editing ? undefined : onStartOver}
        title={
          editing ? '수정 중인 내용이 있습니다. 이동할까요?' : '작성 중인 주문이 있습니다. 이동할까요?'
        }
      />
      {/* ---------- ① 환자정보 ---------- */}
      <div id="sec-patient" className="scroll-mt-16">
        <OrderSection icon={SECTION_ICON.patient} title="환자정보">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="이름" problem={showProblems && !patientText.trim()}>
            <PatientPicker
              text={patientText}
              patient={patient}
              onChange={(text, matched) => {
                setPatientText(text);
                setPatient(matched);
              }}
            />
          </Field>

          <Field label="요청시한" hint="일요일과 최소 납기 이전은 선택할 수 없습니다">
            <DueDatePicker value={dueDate} today={today} onChange={setDueDate} />
          </Field>

          <Field label="주문유형">
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className="h-11 w-full rounded border border-[#DDE2EA] px-3 text-[13px] outline-none focus:border-[#1279E8]"
            >
              {ORDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ORDER_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="치과">
            <div className="flex h-11 items-center rounded border border-[#E8EBF0] bg-[#F8F9FB] px-3 text-[13px] text-[#4A5567]">
              {clinicName}
            </div>
          </Field>
        </div>
        </OrderSection>
      </div>

      {/* ---------- ② 보철선택 · 임플란트 · 치식선택 ---------- */}
      <section
        id="sec-prosthesis"
        className={
          'scroll-mt-16 rounded-lg border bg-white ' +
          (problemAt('sec-prosthesis') ? 'border-[#E9A9A6]' : 'border-[#E8EBF0]')
        }
      >
        <div className="flex items-start gap-4 px-5 pb-1.5 pt-4">
          <div className="flex shrink-0 items-center gap-[7px] pt-1.5">
            <span className="text-[#1279E8]" aria-hidden="true">
              {SECTION_ICON.prosthesis}
            </span>
            <h3 className="text-[14px] font-bold tracking-tight text-[#1A2130]">보철선택</h3>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2.5">
              {prosthesisCatalog.map((t) => (
                <Chip
                  key={t.code}
                  on={typeCode === t.code}
                  color={colorOfType(t.code)}
                  onClick={() => changeType(t.code)}
                >
                  {t.name}
                </Chip>
              ))}
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {materials.map((m) => (
                <Chip
                  key={m.code}
                  on={materialCode === m.code}
                  color={colorOfType(typeCode)}
                  onClick={() => {
                    setMaterialCode(m.code);
                    setHint('');
                  }}
                >
                  {m.name}
                </Chip>
              ))}
            </div>
          </div>

          <ShadeButton
            system={shadeSystem}
            shade={shade}
            open={shadeOpen}
            onOpenChange={(next) => {
              setShadeOpen(next);
              // 그냥 닫았다면 기다리던 치아를 놓아 줍니다
              if (!next) setPendingTooth(null);
            }}
            onChange={handleShadeApply}
          />
        </div>

        {/* 임플란트 모델 — 임플란트일 때만 */}
        {isImplant && (
          <div className="border-t border-[#F0F2F5] px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-[7px]">
                <span className="text-[#1279E8]" aria-hidden="true">
                  {SECTION_ICON.prosthesis}
                </span>
                <h3 className="text-[14px] font-bold tracking-tight text-[#1A2130]">
                  임플란트 모델
                </h3>
              </div>

              <ImplantModelLabel catalog={implantCatalog} selection={implant} />

              <button
                type="button"
                onClick={() => setModelDialog('pick')}
                className="ml-auto rounded border border-[#DDE2EA] px-3 py-1.5 text-[12.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                모델 선택
              </button>

              <button
                type="button"
                onClick={() => setModelDialog('favorite')}
                className="rounded border border-[#1B63E8] px-3 py-1.5 text-[12.5px] font-semibold text-[#1B63E8] hover:bg-[#EDF3FE]"
              >
                자주쓰는 모델등록
              </button>
            </div>

            {/* 자주 쓰는 모델 — 누르면 바로 채워집니다 */}
            {implantFavorites.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {implantFavorites.map((fav) => {
                  const on =
                    implant.manufacturerCode === fav.makerCode &&
                    implant.typeCode === fav.typeCode &&
                    implant.sizeCode === fav.sizeCode &&
                    implant.screwCode === fav.screwCode;

                  return (
                    <span
                      key={fav.id}
                      className={
                        'inline-flex items-center rounded-full border transition-colors ' +
                        (on
                          ? 'border-[#1B63E8] bg-[#EDF3FE]'
                          : 'border-[#E8EBF0] bg-white hover:border-[#98A2B3]')
                      }
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setImplant({
                            manufacturerCode: fav.makerCode,
                            typeCode: fav.typeCode,
                            sizeCode: fav.sizeCode,
                            screwCode: fav.screwCode,
                            option: implant.option,
                          });
                          setHint('');
                        }}
                        className={
                          'inline-flex items-center gap-1.5 py-1.5 pl-3.5 pr-2 text-[12.5px] font-semibold ' +
                          (on ? 'text-[#1B63E8]' : 'text-[#4A5567]')
                        }
                      >
                        {fav.pushed && (
                          <span className="text-[10px] font-bold text-[#7C6BE8]">배포</span>
                        )}
                        {fav.label}
                      </button>

                      {/* ★ 디자인센터가 배포한 것은 치과가 뺄 수 없습니다 (RLS 도 막습니다) */}
                      {!fav.pushed && (
                        <button
                          type="button"
                          aria-label={`${fav.label} 삭제`}
                          title="이 모델을 즐겨찾기에서 뺍니다"
                          onClick={async () => {
                            const result = await submitRemoveImplantFavorite(fav.id);
                            if (!result.ok) setError(result.error);
                            else router.refresh();
                          }}
                          className="py-1.5 pl-1 pr-3 text-[12px] text-[#C4CBD6] hover:text-[#D8453F]"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 치식선택 */}
        <div className="flex items-center justify-between gap-3 border-t border-[#F0F2F5] px-5 pb-1 pt-4">
          <div className="flex items-center gap-[7px]">
            <span className="text-[#1279E8]" aria-hidden="true">
              {SECTION_ICON.teeth}
            </span>
            <h3 className="text-[14px] font-bold tracking-tight text-[#1A2130]">치식선택</h3>
          </div>

          <div className="flex items-center gap-4">
            <Toggle
              on={isPontic}
              disabled={typeCode === 'inlay'}
              onChange={setIsPontic}
              label="폰틱"
            />

            <button
              type="button"
              onClick={handleReset}
              disabled={entries.length === 0}
              className={
                'flex items-center gap-1 rounded px-2.5 py-1.5 text-[12.5px] ' +
                (entries.length > 0
                  ? 'font-semibold text-[#D8453F] hover:bg-[#FDE7E7]'
                  : 'cursor-not-allowed text-[#C4CBD6]')
              }
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 7a5 5 0 1 1-1.6-3.7" />
                <path d="M12.2 1.6v3h-3" />
              </svg>
              초기화
            </button>
          </div>
        </div>

        <div className="px-5 pb-5 pt-2">
          <ToothChart
            placements={entries}
            severedKeys={severedKeys}
            onToothClick={handleToothClick}
            onTogglePontic={handleTogglePontic}
            onToggleGingival={handleToggleGingival}
            onSeverLink={(key) =>
              setSeveredKeys((prev) =>
                prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
              )
            }
          />

          {/* 시안의 arch-hint — 지금 무엇을 찍고 있는지와 조작을 늘 보여 줍니다 */}
          <p className="mt-3.5 text-center text-[12px] text-[#98A2B3]">
            {hint ? (
              <span className="text-[#E09A1B]">{hint}</span>
            ) : (
              <>
                지금 찍는 조건{' '}
                <b className="font-bold text-[#1A2130]">{brushLabel}</b> — 적용할 치아를 계속
                눌러주세요{' '}
                <span className="text-[11.5px] text-[#B6BECC]">
                  (우클릭 = 폰틱 · 휠클릭 = 치은포셀린)
                </span>
              </>
            )}
          </p>

          <div className="mt-4">
            <ProsthesisSummary
              placements={entries}
              shades={shades}
              implants={implants}
              implantCatalog={implantCatalog}
              onRemoveLine={handleRemoveLine}
              onReset={handleReset}
              readOnly
            />
          </div>
        </div>
      </section>

      {/* ---------- ③ 제작옵션 · 기타 요청사항 ---------- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ProductionOptionPanel
          groups={optionGroups}
          presets={optionPresets}
          value={options}
          onChange={setOptions}
        />

        <OrderSection icon={SECTION_ICON.notes} title="기타 요청사항">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="기타 사항이나 주의사항에 대해서 기록해 주세요"
            className="w-full rounded border border-[#DDE2EA] px-3 py-2 text-[13px] outline-none focus:border-[#1279E8]"
          />
        </OrderSection>
      </div>

      {/* ---------- ④ 스캔/쉐이드 파일 ---------- */}
      <div id="sec-files" className="scroll-mt-16">
        <OrderSection icon={SECTION_ICON.file} title="스캔/쉐이드 파일">
          <ScanDropZone files={pendingFiles} onChange={setPendingFiles} disabled={saving} />
          {showProblems && pendingFiles.length === 0 && !editing && (
            <p className="mt-2 text-[12px] text-[#D8453F]">
              스캔 파일이 있어야 주문을 넣을 수 있습니다.
            </p>
          )}
        </OrderSection>
      </div>

      {progress && (
        <p className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">
          {progress}
        </p>
      )}

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </p>
      )}

      {/* 빠진 항목 알림 — 주문완료를 눌렀을 때만 */}
      {problemsOpen && missingFields.length > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-[16px] font-bold tracking-tight text-[#1A2130]">
              아직 채우지 못한 항목이 있습니다
            </h3>
            <p className="mt-1.5 text-[13px] text-[#98A2B3]">
              누르면 해당 칸으로 이동합니다.
            </p>

            <ul className="mt-4 space-y-2">
              {missingFields.map((field) => (
                <li key={field.label}>
                  <button
                    type="button"
                    onClick={() => jumpTo(field.anchor)}
                    className="flex w-full items-center gap-2.5 rounded-md border border-[#F0D3D2] bg-[#FDF4F4] px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-[#1A2130] hover:border-[#D8453F]"
                  >
                    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#D8453F] text-[11px] font-bold text-white">
                      !
                    </span>
                    {field.label}
                    <span className="ml-auto text-[#C4CBD6]">›</span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setProblemsOpen(false)}
              className="mt-5 h-11 w-full rounded-md bg-[#1279E8] text-[14px] font-bold text-white hover:bg-[#0F68C9]"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 등록 완료 — 주문번호는 치과가 받아 적는 값이라 크게 보여 줍니다 */}
      {done && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6">
          <div className="w-full max-w-[400px] rounded-xl bg-white p-7 text-center shadow-xl">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E6F4EE]">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#12855B"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 12.5 9.5 18 20 6.5" />
              </svg>
            </span>

            <h3 className="mt-4 text-[17px] font-bold tracking-tight text-[#1A2130]">
              주문이 등록되었습니다
            </h3>

            <p className="mt-3 rounded-md bg-[#F4F6F9] py-2.5 text-[15px] font-bold tracking-tight text-[#1279E8]">
              {done.orderNo}
            </p>

            <p className="mt-2.5 text-[12.5px] text-[#98A2B3]">
              디자인센터에 접수 알림이 갔습니다.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // 같은 주소로 push 하면 이 컴포넌트가 살아남아 지난 값이 남습니다
                  setDone(null);
                  onStartOver();
                  router.refresh();
                }}
                className="h-11 flex-1 rounded-md border border-[#DDE2EA] text-[13.5px] font-semibold text-[#4A5567] hover:bg-[#F4F6F9]"
              >
                새 주문 등록
              </button>

              <button
                type="button"
                onClick={() => router.push(`/clinic/orders/${done.orderId}`)}
                className="h-11 flex-1 rounded-md bg-[#1279E8] text-[13.5px] font-bold text-white hover:bg-[#0F68C9]"
              >
                주문서 보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 임플란트 모델 팝업 */}
      {modelDialog && (
        <ImplantModelDialog
          catalog={implantCatalog}
          value={implant}
          title={modelDialog === 'favorite' ? '자주쓰는 모델 등록' : '임플란트 모델 등록'}
          confirmLabel={modelDialog === 'favorite' ? '등록' : '적용'}
          onClose={() => setModelDialog(null)}
          onConfirm={async (next) => {
            setImplant(next);
            setHint('');

            // 즐겨찾기로 등록하면 목록에 남아 다음부터 한 번에 고릅니다
            if (modelDialog === 'favorite' && next.manufacturerCode && next.typeCode) {
              const result = await submitAddImplantFavorite({
                makerCode: next.manufacturerCode,
                typeCode: next.typeCode,
                sizeCode: next.sizeCode,
                screwCode: next.screwCode,
              });

              if (!result.ok) setError(result.error);
              else router.refresh();
            }
          }}
        />
      )}

      {/* ---------- ⑤ 주문완료 ---------- */}
      {/* 한 번 눌러 본 뒤에만, 그것도 한 줄로 조용히 남겨 둡니다 */}
      {showProblems && missingFields.length > 0 && (
        <p className="text-[12.5px] text-[#D8453F]">
          아직 {missingFields.length}가지가 비어 있습니다 —{' '}
          <button
            type="button"
            onClick={() => setProblemsOpen(true)}
            className="font-bold underline underline-offset-2"
          >
            어떤 항목인지 보기
          </button>
        </p>
      )}

      <div className="flex gap-2 pb-10">
        <button
          type="button"
          onClick={() =>
            router.push(editing ? `/clinic/orders/${initial!.orderId}` : '/clinic/orders')
          }
          className="h-12 rounded border border-[#DDE2EA] px-6 text-[14px] text-[#4A5567] hover:bg-[#F4F6F9]"
        >
          취소
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="h-12 flex-1 rounded bg-[#1279E8] text-[15px] font-bold text-white hover:bg-[#0F68C9] disabled:cursor-not-allowed disabled:bg-[#D5DAE2] disabled:text-[#8E98A8]"
        >
          {saving
            ? '처리 중…'
            : editing
              ? '수정 완료'
              : createdOrderId
                ? '파일 다시 시도'
                : '주문완료'}
        </button>
      </div>
    </div>
  );
}

// ---------- 조각들 ----------

function Field({
  label,
  hint,
  problem,
  children,
}: {
  label: string;
  hint?: string;
  /** 주문완료를 눌렀는데 아직 비어 있는 칸 */
  problem?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-[13px] font-bold text-[#1A2130]">
        {label}
        {problem && <span className="text-[#D8453F]">*</span>}
        {hint && (
          <span
            title={hint}
            className="grid h-[15px] w-[15px] cursor-help place-items-center rounded-full border border-[#C4CBD6] text-[9px] font-bold text-[#98A2B3]"
          >
            i
          </span>
        )}
      </label>
      {children}
      {problem && <p className="mt-1 text-[11.5px] text-[#D8453F]">비어 있습니다</p>}
    </div>
  );
}

/**
 * 보철 칩. (시안 .proto)
 * 종류마다 고유한 색이 있고, 고른 것에는 체크가 붙습니다.
 */
/**
 * 고른 임플란트 모델 표시.
 *
 * ★ 제조사·타입·사이즈·스크류를 네 칸으로 갈라 놓지 않습니다.
 *   고르고 나면 하나의 모델 이름으로 읽습니다 — 'Osstem TS Regular Hex'.
 *   칸을 나누면 어디가 어디인지 따지게 되는데, 그건 고를 때 할 일이지
 *   고른 뒤에 할 일이 아닙니다.
 */
function ImplantModelLabel({
  catalog,
  selection,
}: {
  catalog: ImplantCatalog;
  selection: ImplantSelection;
}) {
  const label = formatSelection(catalog, selection);

  if (!label) {
    return (
      <span className="text-[13px] font-semibold text-[#D8453F]">모델을 선택해 주세요</span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <b className="text-[13.5px] font-bold tracking-tight text-[#1A2130]">{label}</b>
      {!implantComplete(catalog, selection) && (
        <span className="text-[12px] font-semibold text-[#E09A1B]">· 미완성</span>
      )}
    </span>
  );
}

function Chip({
  on,
  color,
  onClick,
  children,
}: {
  on: boolean;
  color: { line: string; soft: string };
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13.5px] font-semibold tracking-[-0.02em] transition-colors"
      style={{
        border: `1.5px solid ${color.line}`,
        color: color.line,
        background: on ? color.soft : '#FFFFFF',
        boxShadow: on ? `inset 0 0 0 1px ${color.line}` : undefined,
      }}
    >
      {on && <span className="text-[11px]">✓</span>}
      {children}
    </button>
  );
}

function Toggle({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={
        'flex items-center gap-2 text-[12.5px] font-semibold ' +
        (disabled ? 'cursor-not-allowed text-[#C4CBD6]' : 'cursor-pointer text-[#4A5567]')
      }
      title={disabled ? '인레이는 폰틱이 될 수 없습니다' : undefined}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={
          'relative h-[18px] w-8 rounded-full transition-colors ' +
          (disabled ? 'bg-[#EEF1F5]' : on ? 'bg-[#E09A1B]' : 'bg-[#D5DAE2]')
        }
      >
        <span
          className={
            'absolute top-0.5 h-[14px] w-[14px] rounded-full bg-white transition-all ' +
            (on ? 'left-4' : 'left-0.5')
          }
        />
      </span>
      {label}
    </label>
  );
}
