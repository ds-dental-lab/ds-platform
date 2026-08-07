'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PatientPicker, { type Patient } from '@/components/order/PatientPicker';
import ProsthesisPanel, { DEFAULT_BRUSH, type Brush } from '@/components/order/ProsthesisPanel';
import ToothChart from '@/components/dental/ToothChart';
import ProsthesisSummary from '@/components/dental/ProsthesisSummary';
import { submitOrder } from '@/server/actions/order';
import { addPlacement, type Placement } from '@/server/domain/duplicate';
import type { ToothPlacement } from '@/server/domain/bridge';
import type { ToothShade } from '@/server/domain/shade';
import type { ImplantSelection } from '@/server/domain/implant';
import type { SummaryLine } from '@/server/domain/summary';

interface Entry extends ToothPlacement {
  shadeSystem: string;
  shade: ToothShade;
  implant: ImplantSelection;
}

export default function NewOrderPage() {
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [brush, setBrush] = useState<Brush>(DEFAULT_BRUSH);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [severedKeys, setSeveredKeys] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const shades: Record<number, ToothShade> = {};
  const implants: Record<number, ImplantSelection> = {};
  for (const e of entries) {
    shades[e.tooth] = e.shade;
    if (e.typeCode === 'implant') implants[e.tooth] = e.implant;
  }

  function handleToothClick(tooth: number) {
    setError('');

    const current: Placement[] = entries
      .filter((e) => e.tooth === tooth)
      .map(({ typeCode, materialCode }) => ({ typeCode, materialCode }));

    const result = addPlacement(current, {
      typeCode: brush.typeCode,
      materialCode: brush.materialCode,
    });

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
        isPontic: brush.isPontic,
        shadeSystem: brush.shadeSystem,
        shade: brush.shade,
        implant: brush.implant,
      };
    });

    setEntries([...kept, ...rebuilt]);
  }

  function handleSever(key: string) {
    setSeveredKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function handleRemoveLine(line: SummaryLine) {
    setEntries((prev) =>
      prev.filter(
        (e) => !(e.typeCode === line.typeCode && e.materialCode === line.materialCode),
      ),
    );
  }

  function handleReset() {
    setEntries([]);
    setSeveredKeys([]);
    setError('');
  }

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const result = await submitOrder({
      patientId: patient?.id ?? null,
      patientLabel: patient ? patient.name + ' (' + patient.chart_no + ')' : '',
      dueDate,
      notes,
      severedKeys,
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
      })),
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    alert('주문이 등록되었습니다. ' + result.orderNo);
    router.push('/clinic');
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-bold">주문 등록</h1>

      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-5">
        <Field label="환자">
          <PatientPicker value={patient} onChange={setPatient} />
        </Field>

        <Field label="요청시한">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </Field>

        <Field label="요청사항">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="기공소에 전달할 내용"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </Field>
      </div>

      <div className="mt-5">
        <ProsthesisPanel value={brush} onChange={setBrush} />
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-5">
        <ToothChart
          placements={entries}
          severedKeys={severedKeys}
          onToothClick={handleToothClick}
          onSeverLink={handleSever}
        />
      </div>

      <div className="mt-5">
        <ProsthesisSummary
          placements={entries}
          shades={shades}
          implants={implants}
          onRemoveLine={handleRemoveLine}
          onReset={handleReset}
        />
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2 pb-10">
        <button
          onClick={() => router.push('/clinic')}
          className="rounded border border-gray-300 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || entries.length === 0 || !patient || !dueDate}
          className="rounded bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {saving ? '등록 중...' : '주문 등록'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-gray-100 py-3 last:border-0">
      <span className="w-20 shrink-0 pt-2 text-[13px] font-semibold text-gray-500">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
