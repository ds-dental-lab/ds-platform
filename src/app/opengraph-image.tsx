// =========================================================
// 놓을 위치: src/app/opengraph-image.tsx  (Next 규약)
//
// 주소를 붙였을 때 뜨는 미리보기 그림. (사용자 요청 2026-08-15 —
// 네이버 검색 준비 중에 og:image 가 없는 것을 찾았습니다)
//
// ★ 없으면 카카오톡·블로그·검색 결과에 **글자만** 나갑니다.
//   치과 원장님들 사이에 주소가 오가는 통로가 대부분 카톡입니다.
//   그림 한 장이 붙고 안 붙고가 눌리느냐 마느냐를 가릅니다.
//
// ★ 사진이 아니라 **그려서** 만듭니다. 우리 장비 사진이 아직 없고,
//   남의 사진을 쓸 수는 없습니다. 로고와 글씨만으로도 충분합니다 —
//   미리보기는 작게 뜨므로 사진보다 글자가 잘 읽힙니다.
//
// ★ 1200x630 은 카카오톡·네이버·페이스북이 공통으로 기대하는 크기입니다.
//   다른 비율로 두면 각자 제멋대로 잘라서, 로고가 잘린 채 나갑니다.
//
// ★ 글꼴을 안 부릅니다. 여기서 웹폰트를 받으면 그림 만드는 데
//   시간이 걸리고, 실패하면 미리보기가 통째로 안 나옵니다.
//   기본 글꼴로도 읽는 데 지장이 없습니다.
// =========================================================

import { ImageResponse } from 'next/og';
import { SITE_TITLE } from '@/server/domain/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_TITLE;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 92px',
          background: '#16324F',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 마크 — DenFlowMark 와 같은 길, 미리보기 크기에 맞춰 굵게 */}
        <svg width="196" height="104" viewBox="3.5 27 113 60" fill="none">
          <g strokeLinecap="round" strokeLinejoin="round" strokeWidth="9">
            <path
              d="M8 82 H 24
                 C 33 82, 27 44, 44 34
                 C 51 30, 55 40, 60 40
                 C 65 40, 69 30, 76 34
                 C 93 44, 87 82, 96 82"
              stroke="#FFFFFF"
            />
            <path d="M96 82 H 112" stroke="#14B8A6" />
          </g>
        </svg>

        {/* 상호가 길어져 글자를 줄였습니다 — 1200 폭에서 한 줄로 들어갑니다 */}
        <div style={{ marginTop: 44, fontSize: 60, fontWeight: 800, letterSpacing: -2 }}>
          덴플로우 치과기공소
        </div>

        <div style={{ marginTop: 14, fontSize: 40, fontWeight: 700, color: '#7FB6D9' }}>
          모델리스 전문 기공소
        </div>

        <div style={{ marginTop: 30, fontSize: 30, color: '#B8C6D6', lineHeight: 1.45 }}>
          스캔 데이터에서 최종 보철까지, 하나의 디지털 프로세스로
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 26,
            color: '#14B8A6',
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          denflow.kr
        </div>
      </div>
    ),
    size,
  );
}
