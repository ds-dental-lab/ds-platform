// =========================================================
// 놓을 위치: src/lib/compress-image.ts
//
// 사진을 브라우저에서 줄여서 올립니다. (사용자 요청 2026-08-14)
//
// ★ **올리기 전에** 줄입니다. 서버에서 줄이면 큰 것을 이미 한 번
//   보낸 뒤라, 아끼려던 전송량은 그대로 나갑니다.
//
// ★ **어떤 일이 있어도 원본을 돌려줍니다.** 줄이다 실패하면 그냥
//   원본을 올립니다. 사진 한 장 아끼려다 주문이 못 올라가면 안 됩니다.
//   그래서 이 파일에는 던지는 곳이 하나도 없습니다.
//
// ★ 판단(무엇을 줄일지·바꿀 값어치가 있는지)은 domain/upload 에 있습니다.
//   여기는 캔버스를 다루는 손일 뿐입니다.
// =========================================================

import {
  shouldCompress,
  webpName,
  fitEdge,
  worthReplacing,
  IMAGE_QUALITY,
} from '@/server/domain/upload';

/**
 * 줄일 수 있으면 줄인 파일을, 아니면 받은 그대로 돌려줍니다.
 */
export async function compressImage(file: File): Promise<File> {
  if (!shouldCompress(file.name, file.size)) return file;

  try {
    /*
      ★ `imageOrientation: 'from-image'` 가 있어야 휴대폰으로 찍은
        사진이 눕지 않습니다. EXIF 에만 적혀 있는 회전을 캔버스는
        그냥 무시하기 때문입니다.
    */
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitEdge(bitmap.width, bitmap.height);

    if (width === 0 || height === 0) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', IMAGE_QUALITY);
    });

    if (!blob) return file;

    /*
      ★ 브라우저가 webp 를 못 만들면 조용히 png 를 돌려줍니다.
        그건 대개 원본보다 커서 아래 검사에 걸립니다 — 따로 안 봐도
        됩니다. 값어치가 없으면 원본이 그대로 갑니다.
    */
    if (!worthReplacing(file.size, blob.size)) return file;

    return new File([blob], webpName(file.name), {
      type: blob.type || 'image/webp',
      lastModified: file.lastModified,
    });
  } catch {
    // 못 줄였을 뿐입니다. 원본을 올립니다
    return file;
  }
}

/** 여러 장을 한꺼번에. 사진이 아닌 것은 그대로 지나갑니다 */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}
