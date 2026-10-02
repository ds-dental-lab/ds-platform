// =========================================================
// 놓을 위치: src/lib/dxd-read.ts
//
// 브라우저에서 dxd 열기 — 치과가 **손으로** 올릴 때도 주문서가 채워지게
// (사용자 요청 2026-10-02).
//
// ★★ 파일을 통째로 읽지 않습니다. dxd 는 65~180MB 입니다. 통째로 읽으면
//   진료실 PC 의 브라우저가 몇 초씩 멈추고, 큰 것은 메모리에서 터집니다.
//   zip 의 **꼬리(목차)** 만 읽어 DentalCase.xml 이 어디 있는지 찾고,
//   그 조각(20~30KB)만 꺼냅니다. 180MB 짜리도 한순간입니다.
//
// ★ 압축은 브라우저가 풉니다 (DecompressionStream). 따로 받아 쓰는 것이
//   없습니다 — 치과 PC 에 설치할 것이 하나도 없어야 합니다.
//
// ★ 못 읽으면 조용히 빈 값입니다. 손으로 올리는 길을 막지 않습니다 —
//   dxd 가 아니어도, 깨진 파일이어도 주문은 그대로 쓸 수 있어야 합니다.
// =========================================================

import { readDentalCase, EMPTY_CASE, type DxdCase } from '@/server/domain/dxd';

const CASE_XML = 'DentalCase.xml';

/** zip 꼬리에서 목차를 찾습니다. 주석이 붙어 있을 수 있어 뒤에서 훑습니다 */
const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;

async function slice(file: Blob, start: number, end: number): Promise<DataView> {
  const buf = await file.slice(start, end).arrayBuffer();
  return new DataView(buf);
}

interface Entry {
  offset: number;
  compressed: number;
  method: number;
}

/** 목차에서 DentalCase.xml 한 줄만 찾습니다 */
async function findCaseXml(file: Blob): Promise<Entry | null> {
  const tailSize = Math.min(file.size, 66_000); // 주석 최대 65535 + 머리 22
  const tail = await slice(file, file.size - tailSize, file.size);

  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i -= 1) {
    if (tail.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const dirSize = tail.getUint32(eocd + 12, true);
  const dirOffset = tail.getUint32(eocd + 16, true);
  if (dirSize === 0 || dirOffset + dirSize > file.size) return null;

  const dir = await slice(file, dirOffset, dirOffset + dirSize);
  const names = new TextDecoder();

  let at = 0;
  while (at + 46 <= dir.byteLength && dir.getUint32(at, true) === CENTRAL_SIG) {
    const nameLen = dir.getUint16(at + 28, true);
    const extraLen = dir.getUint16(at + 30, true);
    const commentLen = dir.getUint16(at + 32, true);
    const name = names.decode(new Uint8Array(dir.buffer, dir.byteOffset + at + 46, nameLen));

    if (name === CASE_XML) {
      return {
        method: dir.getUint16(at + 10, true),
        compressed: dir.getUint32(at + 20, true),
        offset: dir.getUint32(at + 42, true),
      };
    }

    at += 46 + nameLen + extraLen + commentLen;
  }

  return null;
}

async function inflate(bytes: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return bytes; // 안 눌러 담은 것
  if (method !== 8 || typeof DecompressionStream === 'undefined') {
    throw new Error('못 푸는 압축');
  }

  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** UTF-16LE 로 적힙니다. 혹시 모를 UTF-8 도 받아 둡니다 */
function decode(raw: Uint8Array): string {
  const utf16 = raw[0] === 0xff && raw[1] === 0xfe;
  const plain = raw[1] === 0x00; // '<' 다음이 0 이면 UTF-16LE
  const text = new TextDecoder(utf16 || plain ? 'utf-16le' : 'utf-8').decode(raw);
  return text.replace(/^﻿/, '');
}

/**
 * dxd 한 개에서 환자·차트·치식 읽기.
 *
 * 못 읽으면 빈 값입니다 — 던지지 않습니다.
 */
export async function readDxd(file: File): Promise<DxdCase> {
  const named = { ...EMPTY_CASE, teeth: [] as number[] };

  if (!file.name.toLowerCase().endsWith('.dxd')) return named;

  try {
    const entry = await findCaseXml(file);
    if (!entry) return readDentalCase('', file.name);

    // 지역 머리말에서 진짜 자료가 시작하는 자리를 잽니다
    const head = await slice(file, entry.offset, entry.offset + 30);
    const start = entry.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true);

    const raw = new Uint8Array(await file.slice(start, start + entry.compressed).arrayBuffer());
    return readDentalCase(decode(await inflate(raw, entry.method)), file.name);
  } catch {
    // 깨진 파일·못 푸는 압축 — 이름에서라도 읽어 봅니다
    return readDentalCase('', file.name);
  }
}
