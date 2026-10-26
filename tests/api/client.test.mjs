import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../../src/lib/api/client.ts';
import { resolveApiBaseUrl } from '../../src/lib/api/config.ts';
import { ApiError } from '../../src/lib/api/errors.ts';

const beforeLogin = 'a'.repeat(43);
const afterLogin = 'b'.repeat(43);
const freshToken = 'c'.repeat(43);
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});
const csrf = token => json({ csrfToken: token });
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(...responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: new URL(url), options });
    assert.ok(responses.length, 'Toda chamada deve ter resposta simulada; rede real é proibida.');
    const response = responses.shift();
    return typeof response === 'function' ? response(url, options) : response;
  };
  return { api: createApiClient({ baseUrl: 'http://127.0.0.1:3000', production: false, fetchImpl }), calls };
}
const errorIs = (kind, status) => error => {
  assert.ok(error instanceof ApiError);
  assert.equal(error.kind, kind);
  assert.equal(error.status, status);
  assert.doesNotMatch(error.message + JSON.stringify(error), /never-expose|password=|senha_hash|stack trace/);
  return true;
};

describe('Configuração explícita da API independente', () => {
  it('normaliza a origem e permite loopback apenas fora de produção', () => {
    assert.equal(resolveApiBaseUrl({ baseUrl: 'http://127.0.0.1:3000/', production: false }), 'http://127.0.0.1:3000');
    assert.equal(resolveApiBaseUrl({ baseUrl: 'https://API.example.test:443/', production: true }), 'https://api.example.test');
  });

  it('não escolhe automaticamente origem atual, proxy de cartas ou endereço local', () => {
    for (const baseUrl of ['', '/api', '/api/contemplados', '//api.example.test']) {
      assert.throws(() => createApiClient({ baseUrl, production: false }), errorIs('configuration'));
    }
    assert.throws(() => createApiClient(), errorIs('configuration'));
  });

  it('recusa configurações com credenciais, caminhos, query, fragmentos e protocolos inesperados', () => {
    for (const baseUrl of ['https://user:never-expose@api.example.test', 'https://api.example.test/api',
      'https://api.example.test?password=never-expose', 'https://api.example.test/#never-expose',
      'file:///api', 'javascript:never-expose', 'https:api.example.test', 'https://api.example.test/a\\b', ' https://api.example.test']) {
      assert.throws(() => resolveApiBaseUrl({ baseUrl, production: false }), errorIs('configuration'));
    }
  });

  it('produção exige HTTPS e recusa as representações de loopback', () => {
    for (const baseUrl of ['http://api.example.test', 'https://localhost', 'https://localhost.', 'https://api.localhost',
      'https://127.0.0.1', 'https://127.1', 'https://127.9.8.7', 'https://0.0.0.0', 'https://[::1]',
      'https://[0:0:0:0:0:0:0:1]', 'https://[::]', 'https://[::ffff:127.0.0.1]']) {
      assert.throws(() => resolveApiBaseUrl({ baseUrl, production: true }), errorIs('configuration'));
    }
  });

  it('criar o cliente não realiza chamadas nem altera o site ativo', () => {
    const { calls } = setup();
    assert.equal(calls.length, 0);
  });
});

describe('Transporte JSON com fetch simulado', () => {
  it('GET usa a origem configurada, query codificada e credenciais, sem corpo ou CSRF', async () => {
    const { api, calls } = setup(json({ imoveis: [], limit: 20, offset: 0 }));
    const result = await api.get('/api/imoveis', { query: { cidade: 'São Paulo&x=1', offset: 0, destaque: false, vazio: null, ausente: undefined } });
    assert.deepEqual(result, { imoveis: [], limit: 20, offset: 0 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin, 'http://127.0.0.1:3000');
    assert.equal(calls[0].url.pathname, '/api/imoveis');
    assert.deepEqual([...calls[0].url.searchParams], [['cidade', 'São Paulo&x=1'], ['offset', '0'], ['destaque', 'false']]);
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.credentials, 'include');
    assert.equal(calls[0].options.redirect, 'error');
    assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(calls[0].options.body, undefined);
    assert.deepEqual(calls[0].options.headers, { Accept: 'application/json' });
  });

  it('POST obtém CSRF antes da escrita e serializa JSON sem converter decimais', async () => {
    const { api, calls } = setup(csrf(beforeLogin), json({ usuario: { nome: 'Pessoa' } }, 201));
    const input = { nome: 'Pessoa', valor: '9007199254740993.01' };
    await api.post('/api/usuarios', input);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.pathname, '/api/auth/csrf');
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.headers['X-CSRF-Token'], undefined);
    assert.equal(calls[1].options.method, 'POST');
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(calls[1].options.headers['X-CSRF-Token'], beforeLogin);
    assert.equal(calls[1].options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(calls[1].options.body), input);
  });

  it('PATCH reutiliza CSRF e DELETE envia {} e aceita 204 sem tentar ler JSON', async () => {
    const noContent = new Response(null, { status: 204 });
    noContent.text = () => { assert.fail('204 não possui corpo para leitura.'); };
    const { api, calls } = setup(csrf(beforeLogin), json({ imovel: { destaque: true } }), noContent);
    await api.patch('/api/imoveis/42', { destaque: true });
    assert.equal(await api.delete('/api/imoveis/42'), undefined);
    assert.equal(calls.length, 3);
    assert.equal(calls[1].options.method, 'PATCH');
    assert.equal(calls[2].options.method, 'DELETE');
    assert.equal(calls[2].options.body, '{}');
    assert.equal(calls[2].options.headers['X-CSRF-Token'], beforeLogin);
  });

  it('o catálogo de cartas usa o backend explícito, sem passar pelo caminho relativo do Vite', async () => {
    const { api, calls } = setup(json([]));
    assert.deepEqual(await api.get('/api/contemplados'), []);
    assert.equal(calls[0].url.href, 'http://127.0.0.1:3000/api/contemplados');
  });

  it('recusa destinos externos e caminhos fora de /api antes de qualquer fetch', async () => {
    const { api, calls } = setup();
    for (const path of ['https://other.example.test/api/auth/login', '//other.example.test/api/auth/login',
      '/admin', '/api/../admin', '/api/%2e%2e/admin', '/api/auth/login#never-expose', '/api/imoveis?limit=1', '/api/\\other']) {
      await assert.rejects(api.post(path, {}), errorIs('invalid_request'));
    }
    assert.equal(calls.length, 0);
  });

  it('recusa query inválida e corpo não serializável sem enviar CSRF ou mutação', async () => {
    const { api, calls } = setup();
    const circular = {}; circular.self = circular;
    for (const body of [circular, 1n, { valor: NaN }, { valor: Infinity }, () => {}, { callback() {} }]) {
      await assert.rejects(api.post('/api/usuarios', body), errorIs('invalid_request'));
    }
    await assert.rejects(api.get('/api/imoveis', { query: { limit: Infinity } }), errorIs('invalid_request'));
    assert.equal(calls.length, 0);
  });

  it('aceita application/json com charset e tipos application/*+json', async () => {
    const { api } = setup(json({ ok: true }), json({ ok: true }, 200, { 'Content-Type': 'application/vnd.test+json' }));
    assert.deepEqual(await api.get('/api/health'), { ok: true });
    assert.deepEqual(await api.get('/api/health'), { ok: true });
  });

  it('identifica JSON inválido ou vazio sem expor o corpo nem SyntaxError', async () => {
    for (const text of ['{never-expose', '']) {
      const { api } = setup(new Response(text, { headers: { 'Content-Type': 'application/json' } }));
      await assert.rejects(api.get('/api/health'), errorIs('invalid_response', 200));
    }
  });

  it('recusa HTML de fallback SPA, mesmo com status 200', async () => {
    const { api } = setup(new Response('<html>never-expose</html>', { headers: { 'Content-Type': 'text/html' } }));
    await assert.rejects(api.get('/api/health'), errorIs('invalid_response', 200));
  });

  for (const status of [400, 401, 403, 404, 409, 429, 500, 502, 504]) {
    it(`HTTP ${status} produz erro tipado e seguro, sem redirecionar nem repetir a chamada`, async () => {
      const { api, calls } = setup(json({ status: 'error', message: 'never-expose password=never-expose' }, status));
      await assert.rejects(api.get('/api/auth/me'), errorIs('http', status));
      assert.equal(calls.length, 1);
    });
  }

  it('429 informa Retry-After numérico, sem reagendar ou aceitar texto externo como mensagem', async () => {
    const { api, calls } = setup(json({}, 429, { 'Retry-After': '900' }));
    await assert.rejects(api.get('/api/auth/me'), error => {
      assert.equal(error.retryAfterSeconds, 900);
      return errorIs('http', 429)(error);
    });
    assert.equal(calls.length, 1);
  });

  it('erros HTTP não dependem de corpo JSON e descartam a resposta sem ler mensagens externas', async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 503 });
    const { api } = setup(response);
    await assert.rejects(api.get('/api/health'), errorIs('http', 503));
    assert.equal(cancelled, true);
  });

  it('falha de rede retorna erro seguro e não vaza a exceção original', async () => {
    const { api, calls } = setup(() => { throw new TypeError('never-expose'); });
    await assert.rejects(api.get('/api/health'), errorIs('network'));
    assert.equal(calls.length, 1);
  });

  it('não repete mutação após falha ambígua, 403, 429 ou 5xx', async () => {
    for (const response of [() => { throw new TypeError('never-expose'); }, json({}, 403), json({}, 429), json({}, 500)]) {
      const { api, calls } = setup(csrf(beforeLogin), response);
      await assert.rejects(api.post('/api/usuarios', { nome: 'Pessoa' }), error => error instanceof ApiError);
      assert.equal(calls.length, 2);
      assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
    }
  });
});

describe('Cookies e ciclo CSRF em memória', () => {
  it('login troca o CSRF usado pela mutação seguinte; leituras continuam sem o header', async () => {
    const { api, calls } = setup(csrf(beforeLogin), json({ usuario: {}, csrfToken: afterLogin }), json({ usuario: {} }), json({ usuario: {} }));
    await api.post('/api/auth/login', {});
    await api.get('/api/auth/me');
    await api.patch('/api/auth/me', { nome: 'Pessoa' });
    assert.equal(calls.length, 4);
    assert.equal(calls[1].options.headers['X-CSRF-Token'], beforeLogin);
    assert.equal(calls[2].options.headers['X-CSRF-Token'], undefined);
    assert.equal(calls[3].options.headers['X-CSRF-Token'], afterLogin);
    assert.ok(calls.every(call => call.options.credentials === 'include'));
    assert.ok(calls.every(call => !('Cookie' in call.options.headers) && !('Authorization' in call.options.headers)));
  });

  it('mutações concorrentes aguardam um único GET CSRF', async () => {
    const loading = deferred();
    const { api, calls } = setup(loading.promise, json({ ok: true }), json({ ok: true }));
    const first = api.post('/api/usuarios', {});
    const second = api.patch('/api/auth/me', { nome: 'Pessoa' });
    assert.equal(calls.length, 1);
    loading.resolve(csrf(beforeLogin));
    await Promise.all([first, second]);
    assert.equal(calls.length, 3);
    assert.ok(calls.slice(1).every(call => call.options.headers['X-CSRF-Token'] === beforeLogin));
  });

  it('mantém rotação CSRF nas variantes de login aceitas pelo Express', async () => {
    for (const path of ['/api/auth/login/', '/api/Auth/Login']) {
      const { api, calls } = setup(csrf(beforeLogin), json({ usuario: {}, csrfToken: afterLogin }), json({ ok: true }));
      await api.post(path, {});
      await api.patch('/api/auth/me', {});
      assert.equal(calls.length, 3);
      assert.equal(calls[2].options.headers['X-CSRF-Token'], afterLogin);
    }
  });

  it('refresh explícito também é compartilhado e não reenvia operações anteriores', async () => {
    const loading = deferred();
    const { api, calls } = setup(csrf(beforeLogin), loading.promise, json({ ok: true }));
    await api.refreshCsrf();
    const first = api.refreshCsrf();
    const second = api.refreshCsrf();
    loading.resolve(csrf(freshToken));
    assert.deepEqual(await Promise.all([first, second]), [freshToken, freshToken]);
    await api.patch('/api/auth/me', {});
    assert.equal(calls.length, 3);
    assert.equal(calls[2].options.headers['X-CSRF-Token'], freshToken);
  });

  it('um novo cliente após recarga obtém CSRF de novo sem acessar storage do navegador', async () => {
    const first = setup(csrf(beforeLogin), json({ ok: true }));
    const second = setup(csrf(freshToken), json({ ok: true }));
    await first.api.post('/api/usuarios', {});
    await second.api.post('/api/usuarios', {});
    assert.equal(second.calls[0].url.pathname, '/api/auth/csrf');
    assert.equal(second.calls[1].options.headers['X-CSRF-Token'], freshToken);
  });

  it('renova o cache antes de vencer o cookie CSRF anônimo de dez minutos', async () => {
    let now = 1_000_000;
    const clock = mock.method(Date, 'now', () => now);
    try {
      const { api, calls } = setup(csrf(beforeLogin), json({ ok: true }), csrf(freshToken), json({ ok: true }));
      await api.post('/api/usuarios', {});
      now += 10 * 60 * 1000;
      await api.post('/api/usuarios', {});
      assert.equal(calls.length, 4);
      assert.equal(calls[3].options.headers['X-CSRF-Token'], freshToken);
    } finally { clock.mock.restore(); }
  });

  it('falha na obtenção de CSRF bloqueia a escrita; nova tentativa explícita pode obter outro token', async () => {
    const { api, calls } = setup(json({}, 503), csrf(freshToken), json({ ok: true }));
    await assert.rejects(api.post('/api/usuarios', {}), errorIs('http', 503));
    assert.equal(calls.length, 1);
    await api.post('/api/usuarios', {});
    assert.equal(calls.length, 3);
  });

  it('CSRF inválido impede o POST; login com token ausente também invalida o cache anterior', async () => {
    for (const payload of [{}, { csrfToken: '' }, { csrfToken: 'never-expose' }, { csrfToken: null }]) {
      const { api, calls } = setup(json(payload));
      await assert.rejects(api.post('/api/usuarios', {}), errorIs('invalid_response'));
      assert.equal(calls.length, 1);
    }
    const { api, calls } = setup(csrf(beforeLogin), json({ usuario: {} }), csrf(freshToken), json({ ok: true }));
    await assert.rejects(api.post('/api/auth/login', {}), errorIs('invalid_response'));
    await api.patch('/api/auth/me', {});
    assert.equal(calls[3].options.headers['X-CSRF-Token'], freshToken);
  });

  for (const path of ['/api/auth/logout', '/api/auth/change-password']) {
    it(`${path} limpa CSRF após sucesso, e a próxima escrita obtém um novo token`, async () => {
      const { api, calls } = setup(csrf(beforeLogin), json({ message: 'OK' }), csrf(freshToken), json({ usuario: {}, csrfToken: afterLogin }));
      await api.post(path, {});
      await api.post('/api/auth/login', {});
      assert.equal(calls.length, 4);
      assert.equal(calls[2].url.pathname, '/api/auth/csrf');
      assert.equal(calls[3].options.headers['X-CSRF-Token'], freshToken);
    });
  }

  it('401 de senha atual não redireciona nem inicia login; apenas invalida CSRF por segurança', async () => {
    const { api, calls } = setup(csrf(beforeLogin), json({ message: 'never-expose' }, 401));
    await assert.rejects(api.post('/api/auth/change-password', {}), errorIs('http', 401));
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url.pathname, '/api/auth/change-password');
  });

  it('falha ambígua de login invalida CSRF sem repetir a autenticação', async () => {
    const { api, calls } = setup(csrf(beforeLogin), () => { throw new TypeError('never-expose'); }, csrf(freshToken), json({ ok: true }));
    await assert.rejects(api.post('/api/auth/login', {}), errorIs('network'));
    await api.patch('/api/auth/me', {});
    assert.equal(calls.length, 4);
    assert.equal(calls[3].options.headers['X-CSRF-Token'], freshToken);
  });
});

describe('Cancelamento sem reenvio nem interferência entre consumidores', () => {
  it('sinal já cancelado impede GET, inicialização CSRF e POST', async () => {
    const { api, calls } = setup();
    const controller = new AbortController(); controller.abort('never-expose');
    await assert.rejects(api.get('/api/health', { signal: controller.signal }), errorIs('cancelled'));
    await assert.rejects(api.post('/api/usuarios', {}, { signal: controller.signal }), errorIs('cancelled'));
    assert.equal(calls.length, 0);
  });

  it('cancela a requisição em andamento com erro seguro, mesmo se o mock ignorar abort', async () => {
    const loading = deferred();
    const { api, calls } = setup(loading.promise);
    const controller = new AbortController();
    const pending = api.get('/api/health', { signal: controller.signal });
    const rejected = assert.rejects(pending, errorIs('cancelled'));
    assert.equal(calls[0].options.signal, controller.signal);
    controller.abort('never-expose');
    await rejected;
    loading.resolve(json({ ok: true }));
    assert.equal(calls.length, 1);
  });

  it('cancelar um POST enquanto aguarda CSRF não cancela os demais consumidores', async () => {
    const loading = deferred();
    const { api, calls } = setup(loading.promise, json({ ok: true }));
    const controller = new AbortController();
    const first = api.post('/api/usuarios', {}, { signal: controller.signal });
    const rejected = assert.rejects(first, errorIs('cancelled'));
    const second = api.patch('/api/auth/me', {});
    controller.abort();
    await rejected;
    assert.equal(calls[0].options.signal.aborted, false);
    loading.resolve(csrf(beforeLogin));
    await second;
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.method, 'PATCH');
  });

  it('encaminha o sinal ao POST em andamento, sem reenviar a operação', async () => {
    const loading = deferred();
    const started = deferred();
    const { api, calls } = setup(csrf(beforeLogin), (_url, options) => {
      started.resolve(options);
      return loading.promise;
    });
    const controller = new AbortController();
    const pending = api.post('/api/usuarios', {}, { signal: controller.signal });
    const rejected = assert.rejects(pending, errorIs('cancelled'));
    assert.equal((await started.promise).signal, controller.signal);
    controller.abort();
    await rejected;
    loading.resolve(json({ ok: true }));
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
  });

  it('cancela também enquanto o corpo JSON está sendo recebido', async () => {
    const started = deferred();
    const { api, calls } = setup((_url, options) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{'));
        options.signal.addEventListener('abort', () => controller.error(new DOMException('never-expose', 'AbortError')), { once: true });
        started.resolve();
      },
    }), { headers: { 'Content-Type': 'application/json' } }));
    const controller = new AbortController();
    const pending = api.get('/api/health', { signal: controller.signal });
    const rejected = assert.rejects(pending, errorIs('cancelled'));
    await started.promise;
    controller.abort();
    await rejected;
    assert.equal(calls.length, 1);
  });

  it('limpar CSRF cancela sua obtenção pendente e impede reaproveitamento da resposta antiga', async () => {
    const loading = deferred();
    const { api, calls } = setup(loading.promise, csrf(freshToken), json({ ok: true }));
    const pending = api.refreshCsrf();
    const rejected = assert.rejects(pending, errorIs('cancelled'));
    api.clearCsrf();
    await rejected;
    loading.resolve(csrf(beforeLogin));
    await api.patch('/api/auth/me', {});
    assert.equal(calls.length, 3);
    assert.equal(calls[2].options.headers['X-CSRF-Token'], freshToken);
  });
});
