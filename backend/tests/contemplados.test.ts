import './environment.js';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { Database } from '../src/database/transaction.js';
import { createApp } from '../src/app.js';
import {
  ContempladosClient, CONTEMPLADOS_MAX_BYTES, CONTEMPLADOS_URL,
} from '../src/modules/contemplados/contemplados.client.js';
import { CONTEMPLADOS_MAX_ITEMS } from '../src/modules/contemplados/contemplados.schema.js';

const carta = {
  id: 42, categoria: 'Veículo', valor_credito_fmt: 'R$ 26.829,00', entrada_fmt: 'R$ 14.700,00',
  parcelas: 13, valor_parcela_fmt: 'R$ 960,00', administradora: 'Administradora de teste',
  administradora_img: 'https://images.example.test/logo.png', reserva: 'Reservar',
};
const json = (value: unknown, headers?: HeadersInit) => new Response(JSON.stringify(value), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
});

describe('Módulo 04: consulta pública com fornecedor totalmente simulado', () => {
  let server: Server;
  let base: string;
  let upstream: typeof fetch;
  const calls: Array<{ url: string; options: RequestInit | undefined }> = [];
  const mockFetch: typeof fetch = async (input, options) => {
    calls.push({ url: String(input), options });
    return upstream(input, options);
  };

  before(async () => {
    const database: Database = {
      async query() { throw new Error('Esta rota pública não deve consultar PostgreSQL.'); },
      async connect() { throw new Error('Esta rota pública não deve abrir transações.'); },
    };
    server = createApp(database, new ContempladosClient(mockFetch, 100)).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
  });
  beforeEach(() => { calls.length = 0; upstream = async () => json([carta]); });
  after(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

  async function request(path = '/api/contemplados', options?: RequestInit) {
    const response = await fetch(base + path, options);
    return { response, body: await response.json() as unknown };
  }
  async function failure(expected = 502) {
    const result = await request();
    assert.equal(result.response.status, expected);
    assert.deepEqual(Object.keys(result.body as object).sort(), ['message', 'status']);
    assert.equal((result.body as { status: string }).status, 'error');
    assert.equal(result.response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(JSON.stringify(result.body), /upstream-private|fragaebitello|senha_hash|stack|TypeError|ZodError/);
    return result;
  }

  it('retorna o contrato da vitrine e modal, sem sessão, CSRF ou acesso ao banco', async () => {
    const { response, body } = await request();
    assert.equal(response.status, 200);
    assert.deepEqual(body, [carta]);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, CONTEMPLADOS_URL);
    assert.equal(calls[0]?.options?.method, 'GET');
    assert.equal(calls[0]?.options?.redirect, 'error');
    assert.equal(calls[0]?.options?.cache, 'no-store');
    assert.equal(calls[0]?.options?.credentials, 'omit');
    assert.deepEqual(calls[0]?.options?.headers, { Accept: 'application/json' });
  });

  it('aceita lista vazia somente quando o fornecedor retorna um array JSON válido', async () => {
    upstream = async () => json([]);
    const { response, body } = await request();
    assert.equal(response.status, 200);
    assert.deepEqual(body, []);
  });

  it('remove campos excedentes e não repassa cookies, headers ou credenciais', async () => {
    upstream = async () => json([{
      ...carta, valor_credito: '26829.00', valor_parcela: '960.00',
      entrada: 14700, senha_hash: 'upstream-private', observacao_interna: 'upstream-private',
    }], { 'Set-Cookie': 'upstream-private=teste', 'X-Private': 'upstream-private' });
    const { response, body } = await request('/api/contemplados', {
      headers: { Cookie: 'sessao=upstream-private', Authorization: 'Bearer upstream-private' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(body, [carta]);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('x-private'), null);
    assert.deepEqual(calls[0]?.options?.headers, { Accept: 'application/json' });
  });

  it('normaliza categorias e status conhecidos sem inventar disponibilidade', async () => {
    upstream = async () => json([
      { ...carta, categoria: ' imovel ', reserva: ' RESERVADO ' },
      { ...carta, id: 43, categoria: ' VEICULO ', reserva: ' reservar ' },
    ]);
    const { response, body } = await request();
    assert.equal(response.status, 200);
    assert.deepEqual(body, [
      { ...carta, categoria: 'Imóvel', reserva: 'Reservado' },
      { ...carta, id: 43 },
    ]);
  });

  it('mantém precisão exata de centavos mesmo acima de Number.MAX_SAFE_INTEGER', async () => {
    const formatted = 'R$ 9.007.199.254.740.993,01';
    upstream = async () => json([{ ...carta, valor_credito: '9007199254740993.01', valor_credito_fmt: formatted }]);
    const { response, body } = await request();
    assert.equal(response.status, 200);
    assert.deepEqual(body, [{ ...carta, valor_credito_fmt: formatted }]);
    upstream = async () => json([{ ...carta, valor_credito: '9007199254740993.02', valor_credito_fmt: formatted }]);
    await failure();
  });

  it('aceita centavos decimais sem agrupamento e espaço não separável no formato BRL', async () => {
    upstream = async () => json([{ ...carta, valor_credito: '26829', valor_parcela: '960.0', entrada_fmt: 'R$\u00a014700,00' }]);
    const { response, body } = await request();
    assert.equal(response.status, 200);
    assert.deepEqual(body, [{ ...carta, entrada_fmt: 'R$ 14700,00' }]);
  });

  it('omite imagem ausente, nula ou vazia, preservando o fallback de administradora', async () => {
    for (const image of [undefined, null, '', '   ']) {
      upstream = async () => json([{ ...carta, administradora_img: image }]);
      const { response, body } = await request();
      const { administradora_img: _image, ...withoutImage } = carta;
      assert.equal(response.status, 200);
      assert.deepEqual(body, [withoutImage]);
    }
  });

  it('cancela fetch ao atingir timeout e devolve 504 seguro', async () => {
    let signal: AbortSignal | undefined;
    upstream = (_input, options) => new Promise((_resolve, reject) => {
      signal = options?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(new Error('upstream-private')), { once: true });
    });
    await failure(504);
    assert.equal(signal?.aborted, true);
  });

  it('o prazo também cobre corpo pendente e cancela seu stream', async () => {
    let cancelled = false;
    upstream = async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('[')); },
      cancel() { cancelled = true; },
    }), { headers: { 'Content-Type': 'application/json' } });
    await failure(504);
    assert.equal(cancelled, true);
  });

  it('timeout não depende de o transporte respeitar abort; descarta resposta tardia', async () => {
    let finish!: (response: Response) => void;
    let cancelled = false;
    upstream = () => new Promise(resolve => { finish = resolve; });
    await failure(504);
    finish(new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
      headers: { 'Content-Type': 'application/json' },
    }));
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(cancelled, true);
  });

  it('trata falha de conexão sem expor causa de rede', async () => {
    upstream = async () => { throw new TypeError('upstream-private'); };
    await failure();
  });

  it('trata falha durante leitura do corpo sem resposta parcial', async () => {
    upstream = async () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error('upstream-private')); },
    }), { headers: { 'Content-Type': 'application/json' } });
    await failure();
  });

  for (const status of [404, 429, 500, 503]) {
    it(`converte HTTP ${status} do fornecedor em 502, sem repassar corpo ou Retry-After`, async () => {
      upstream = async () => new Response('upstream-private', { status, headers: { 'Retry-After': '999' } });
      const { response } = await failure();
      assert.equal(response.headers.get('retry-after'), null);
    });
  }

  it('recusa redirecionamento, 204 e resposta parcial 206', async () => {
    for (const status of [302, 204, 206]) {
      upstream = async () => new Response(status === 204 ? null : '[]', {
        status, headers: { 'Content-Type': 'application/json', Location: 'https://other.example.test' },
      });
      await failure();
    }
  });

  it('recusa HTML e tipo de conteúdo ausente ou incorreto', async () => {
    for (const contentType of ['text/html', 'text/plain', '']) {
      upstream = async () => new Response('<html>upstream-private</html>', { headers: { 'Content-Type': contentType } });
      await failure();
    }
  });

  it('recusa JSON malformado, corpo vazio e UTF-8 inválido', async () => {
    for (const data of ['{upstream-private', '', new Uint8Array([0xc3, 0x28])]) {
      upstream = async () => new Response(data, { headers: { 'Content-Type': 'application/json' } });
      await failure();
    }
  });

  it('recusa envelope, objeto, null, string, número e array com itens inválidos', async () => {
    for (const value of [{ cartas: [carta] }, {}, null, '[]', 42, [null], [42]]) {
      upstream = async () => json(value);
      await failure();
    }
  });

  it('recusa cada campo obrigatório ausente e um único registro inválido no catálogo', async () => {
    for (const key of Object.keys(carta).filter(key => key !== 'administradora_img')) {
      const invalid: Record<string, unknown> = { ...carta };
      delete invalid[key];
      upstream = async () => json([carta, { ...invalid, ...(key !== 'id' ? { id: 43 } : {}) }]);
      await failure();
    }
  });

  it('recusa moeda inválida, negativa, numérica, notação exponencial e formatos ambíguos', async () => {
    for (const key of ['valor_credito_fmt', 'entrada_fmt', 'valor_parcela_fmt']) {
      for (const value of [26829, '26829.00', 'R$ -1,00', 'R$ NaN', 'R$ 1e3,00', 'R$ 26,829.00', 'R$ 2.68,00', 'R$ 1,000']) {
        upstream = async () => json([{ ...carta, [key]: value }]);
        await failure();
      }
    }
  });

  it('recusa strings decimais inválidas ou valores decimais divergentes', async () => {
    for (const key of ['valor_credito', 'valor_parcela']) {
      for (const value of [null, 26829, '', 'NaN', '1e4', '-1.00', '1,00', '1.001', '0.01']) {
        upstream = async () => json([{ ...carta, [key]: value }]);
        await failure();
      }
    }
  });

  it('recusa qualquer disponibilidade desconhecida em vez de anunciá-la como disponível', async () => {
    for (const reserva of ['Disponível', 'disponivel', 'Indisponível', 'Vendido', '', null, true]) {
      upstream = async () => json([carta, { ...carta, id: 43, reserva }]);
      await failure();
    }
  });

  it('recusa categoria desconhecida e nome de administradora vazio ou com controles', async () => {
    for (const fields of [{ categoria: 'Caminhão' }, { categoria: null }, { administradora: '' }, { administradora: 'A\u0000B' }]) {
      upstream = async () => json([{ ...carta, ...fields }]);
      await failure();
    }
  });

  it('recusa URLs relativas, HTTP, protocolos executáveis e credenciais em imagem', async () => {
    for (const administradora_img of ['/logo.png', 'http://images.example.test/logo.png', 'javascript:alert(1)', 'data:image/png;base64,a',
      'https://user:upstream-private@images.example.test/logo.png', 'não é URL', 'https:images.example.test/logo.png',
      'https://images.example.test/a\\b', 'https://images.example.test/a b', 'https://images.example.test/\nlogo']) {
      upstream = async () => json([{ ...carta, administradora_img }]);
      await failure();
    }
  });

  it('valida identificadores externos e parcelas como inteiros, sem coerção ou perda de precisão', async () => {
    for (const fields of [{ id: '42' }, { id: 0 }, { id: -1 }, { id: 1.2 }, { id: Number.MAX_SAFE_INTEGER + 1 },
      { parcelas: '13' }, { parcelas: -1 }, { parcelas: 1.2 }, { parcelas: Number.MAX_SAFE_INTEGER + 1 }]) {
      upstream = async () => json([{ ...carta, ...fields }]);
      await failure();
    }
  });

  it('recusa IDs repetidos, preservando chaves únicas na vitrine', async () => {
    upstream = async () => json([carta, carta]);
    await failure();
  });

  it('impõe limite de registros antes da validação de itens', async () => {
    upstream = async () => json(Array.from({ length: CONTEMPLADOS_MAX_ITEMS + 1 }, (_value, id) => ({ ...carta, id: id + 1 })));
    await failure();
  });

  it('recusa Content-Length acima do limite e cancela o corpo antes de lê-lo', async () => {
    let cancelled = false;
    upstream = async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(CONTEMPLADOS_MAX_BYTES + 1) },
    });
    await failure();
    assert.equal(cancelled, true);
  });

  it('limita bytes efetivamente recebidos, com Content-Length ausente ou adulterado', async () => {
    for (const length of [undefined, '1']) {
      let cancelled = false;
      upstream = async () => new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new TextEncoder().encode('á'.repeat(CONTEMPLADOS_MAX_BYTES / 2 + 1))); },
        cancel() { cancelled = true; },
      }), { headers: { 'Content-Type': 'application/json', ...(length ? { 'Content-Length': length } : {}) } });
      await failure();
      assert.equal(cancelled, true);
    }
  });

  it('não usa cache nem catálogo antigo quando a disponibilidade muda ou o fornecedor falha', async () => {
    assert.deepEqual((await request()).body, [carta]);
    upstream = async () => json([{ ...carta, reserva: 'Reservado' }]);
    assert.deepEqual((await request()).body, [{ ...carta, reserva: 'Reservado' }]);
    upstream = async () => { throw new Error('upstream-private'); };
    await failure();
    assert.equal(calls.length, 3);
  });

  it('reutiliza Origin/CORS existente: origem permitida lê sem sessão e origem estranha recebe 403', async () => {
    const allowed = await request('/api/contemplados', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.match(allowed.response.headers.get('vary')!, /Origin/);
    const forbidden = await request('/api/contemplados', { headers: { Origin: 'https://untrusted.example.test' } });
    assert.equal(forbidden.response.status, 403);
    assert.equal(forbidden.response.headers.get('access-control-allow-origin'), null);
    assert.equal(calls.length, 1);
  });

  it('recusa query parameters não suportados, sem encaminhá-los ao fornecedor', async () => {
    const { response } = await request('/api/contemplados?url=https://untrusted.example.test');
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });

  it('não oferece criação, edição ou exclusão e mantém o health e a autenticação existentes', async () => {
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const { response } = await request('/api/contemplados', { method });
      assert.equal(response.status, 404);
    }
    assert.equal((await request('/api/health')).response.status, 200);
    assert.equal((await request('/api/auth/me')).response.status, 401);
    assert.equal(calls.length, 0);
  });
});
