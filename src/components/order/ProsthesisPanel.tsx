'use client';

import { useState } from 'react';
import { PROSTHESIS_TYPES, getMaterials } from '@/server/domain/prosthesis';
import {
  SHADE_SYSTEMS,
  getShades,
  formatShade,
  EMPTY_SHADE,
  type ToothShade,
  type ShadeSystemCode,
} from '@/server/domain/shade';
import {
  EMPTY_SELECTION,
  formatSelection,
  isComplete as implantComplete,
  type ImplantSelection,
} from '@/server/domain/implant';
import ImplantPicker from '@/components/dental/ImplantPicker';

export interface Brush {
  typeCode: string;
  materialCode: string;
  isPontic: boolean;
  shadeSystem: ShadeSystemCode;
  shade: ToothShade;
  implant: ImplantSelection;
}

export const DEFAULT_BRUSH: Brush = {
  typeCode: 'crown',
  materialCode: 'zirconia',
  isPontic: false,
  shadeSystem: 'vita_classic',
  shade: EMPTY_SHADE,
  implant: EMPTY_SELECTION,
};

export interface ProsthesisPanelProps {
  value: Brush;
  onChange: (brush: Brush) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-gray-100 py-3 last:border-0">
      <span className="w-16 shrink-0 pt-1.5 text-[13px] font-semibold text-gray-500">
        {label}
      </span>
      {children}
    </div>
  );
}

function chip(active: boolean): string {
  return active
    ? 'rounded border border-blue-600 bg-blue-50 px-3 py-1.5 text-[13px] font-semibold text-blue-700'
    : 'rounded border border-gray-300 bg-white px-3 py-1.5 text-[13px] hover:border-gray-400';
}
