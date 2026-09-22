import { describe, it, expect } from 'vitest';
import { withDownloadName } from '@/server/domain/storage-url';

describe('withDownloadName — 이름을 한 번만 인코딩 (2026-09-22)', () => {
  it('한글·쉼표·공백', () => {
    const url = withDownloadName('https://x.supabase.co/storage/v1/object/sign/b/p.stl?token=abc', '23,24 지그.stl');
    expect(url).toBe('https://x.supabase.co/storage/v1/object/sign/b/p.stl?token=abc&download=23%2C24%20%EC%A7%80%EA%B7%B8.stl');
    expect(url).not.toContain('%25');
  });
  it('물음표 없는 주소', () => {
    expect(withDownloadName('https://x/y', 'a b')).toBe('https://x/y?download=a%20b');
  });
});
