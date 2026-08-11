// =========================================================
// 놓을 위치: src/app/(dev)/playground/implant/page.tsx
// 임플란트 선택 시연 화면. 내부 확인용입니다.
// 마스터를 DB 에서 읽어 클라이언트 컴포넌트에 넘깁니다.
// =========================================================

import { getImplantCatalog } from '@/server/repositories/implant';
import ImplantPlayground from './ImplantPlayground';

export const dynamic = 'force-dynamic';

export default async function ImplantPlaygroundPage() {
  const catalog = await getImplantCatalog();
  return <ImplantPlayground catalog={catalog} />;
}
