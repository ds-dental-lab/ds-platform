import { afterEach, describe, expect, it, vi } from 'vitest';
import { steadyFetch } from '@/lib/supabase/steady-fetch';

const URL_READ = 'https://x.supabase.co/rest/v1/production_option_groups?select=id&name=eq.secret';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stub(...answers: (Response | Error)[]) {
  const calls = vi.fn(async () => {
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return next as Response;
  });
  vi.stubGlobal('fetch', calls);
  return calls;
}

describe('steadyFetch', () => {
  it('읽기가 503 이면 한 번 더 물어 그 답을 돌려줍니다', async () => {
    const calls = stub(new Response('', { status: 503 }), new Response('[]', { status: 200 }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await steadyFetch(URL_READ);

    expect(response.status).toBe(200);
    expect(calls).toHaveBeenCalledTimes(2);
    expect(log).not.toHaveBeenCalled();
  });

  it('두 번 다 안 되면 그 답을 그대로 주고 경로만 남깁니다', async () => {
    stub(new Response('', { status: 503 }), new Response('', { status: 503 }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await steadyFetch(URL_READ);

    expect(response.status).toBe(503);
    expect(log).toHaveBeenCalledWith('[db] GET /rest/v1/production_option_groups → 503 (한 번 더 물은 뒤)');
  });

  it('못 닿았다가 닿으면 조용히 돌려줍니다', async () => {
    const calls = stub(new TypeError('fetch failed'), new Response('[]', { status: 200 }));

    expect((await steadyFetch(URL_READ)).status).toBe(200);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('쓰기는 다시 보내지 않고, 못 닿으면 던집니다', async () => {
    const calls = stub(new TypeError('fetch failed'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(steadyFetch('https://x.supabase.co/rest/v1/order_options', { method: 'POST' })).rejects.toThrow('fetch failed');
    expect(calls).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[db] POST /rest/v1/order_options → 닿지 못함');
  });

  it('문지기에 막힌 쓰기는 남깁니다', async () => {
    stub(new Response('', { status: 403 }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await steadyFetch('https://x.supabase.co/rest/v1/order_options', { method: 'POST' })).status).toBe(403);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
