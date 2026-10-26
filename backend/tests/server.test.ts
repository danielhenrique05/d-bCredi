import './environment.js';
import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once, EventEmitter } from 'node:events';
import type { AddressInfo } from 'node:net';

function launch(t: TestContext, port: string, mode = '', watch = false) {
  const child = spawn(process.execPath, ['--import', 'tsx', `tests/fixtures/${watch ? 'http-watch-worker' : 'http-server-worker'}.ts`], {
    cwd: new URL('..', import.meta.url), windowsHide: true,
    env: { ...process.env, PORT: port, HTTP_TEST_MODE: mode },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });
  let stdout = '', stderr = '';
  const messages: { type: string; [key: string]: unknown }[] = [];
  const changes = new EventEmitter();
  child.stdout!.on('data', chunk => { stdout += String(chunk); changes.emit('change'); });
  child.stderr!.on('data', chunk => { stderr += String(chunk); changes.emit('change'); });
  child.on('message', message => { messages.push(message as typeof messages[number]); changes.emit('change'); });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => { resolve({ code, signal }); changes.emit('change'); });
  });
  async function until(predicate: () => boolean): Promise<void> {
    if (predicate()) return;
    await new Promise<void>((resolve, reject) => {
      const check = () => { if (predicate()) { cleanup(); resolve(); } };
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Tempo limite do processo de teste. ${stderr}`)); }, 9000);
      const cleanup = () => { clearTimeout(timer); changes.off('change', check); };
      changes.on('change', check); check();
    });
  }
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null && child.connected) child.send('stop');
    await closed;
  });
  return {
    child, closed, messages, until,
    get stdout() { return stdout; }, get stderr() { return stderr; },
    async ready() { await until(() => messages.some(message => message.type === 'ready')); },
    report() { return JSON.parse(stdout.split(/\r?\n/).find(line => line.startsWith('HTTP_TEST_REPORT='))!.slice('HTTP_TEST_REPORT='.length)) as {
      poolEndCalls: number; poolEnded: boolean; closeCalls: number; listening: boolean; listenersRestored: boolean;
    }; },
  };
}

async function freePort(): Promise<number> {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

describe('Inicialização e encerramento HTTP em subprocessos isolados', { concurrency: false, timeout: 60000 }, () => {
  it('porta ocupada termina com código 1, fecha pool e nunca anuncia disponibilidade', async t => {
    const held = createServer((_request, response) => response.end('servidor de teste preservado'));
    held.listen(0, '127.0.0.1'); await once(held, 'listening');
    t.after(() => new Promise<void>(resolve => held.close(() => resolve())));
    const port = (held.address() as AddressInfo).port;
    const app = launch(t, String(port));
    assert.equal((await app.closed).code, 1);
    assert.equal(app.stdout.includes('API disponível'), false);
    assert.match(app.stderr, new RegExp(`porta ${port}.*ocupada.*EADDRINUSE`));
    assert.equal(app.report().poolEndCalls, 1); assert.equal(app.report().poolEnded, true);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'servidor de teste preservado');
  });

  for (const signal of ['interrupt', 'stop'] as const) it(`inicializa na PORT configurada e encerra HTTP/pool com ${signal === 'interrupt' ? 'SIGINT' : 'SIGTERM'}`, async t => {
    const port = await freePort(); const app = launch(t, String(port)); await app.ready();
    assert.equal(app.messages.find(message => message.type === 'ready')!.listening, true);
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200); assert.equal((await response.json() as { status: string }).status, 'ok');
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/auth/me`)).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/imoveis/gestao`)).status, 401);
    app.child.send(signal);
    assert.equal((await app.closed).code, 0);
    assert.equal(app.stdout.split('API disponível').length - 1, 1);
    assert.ok(app.stdout.includes(`http://127.0.0.1:${port}`));
    assert.deepEqual(app.report(), { poolEndCalls: 1, poolEnded: true, closeCalls: 1, listening: false, listenersRestored: true });
    const rebound = createServer(); rebound.listen(port, '127.0.0.1'); await once(rebound, 'listening');
    await new Promise<void>(resolve => rebound.close(() => resolve()));
  });

  for (const mode of ['EACCES', 'EIO', 'sync-error']) it(`falha ${mode} simulada não anuncia sucesso e libera recursos`, async t => {
    const port = await freePort(); const app = launch(t, String(port), mode);
    assert.equal((await app.closed).code, 1); assert.equal(app.stdout.includes('API disponível'), false);
    assert.ok(app.stderr.includes(String(port)));
    if (mode === 'EACCES') assert.match(app.stderr, /Sem permissão.*EACCES/);
    else assert.match(app.stderr, /Não foi possível iniciar/);
    assert.equal(app.stderr.includes('Detalhe privado'), false);
    assert.equal(app.report().poolEndCalls, 1); assert.equal(app.report().poolEnded, true);
    assert.equal(app.report().listenersRestored, true);
  });

  it('sinal durante o bind cancela a escuta sem mensagem falsa nem listeners restantes', async t => {
    const app = launch(t, String(await freePort()), 'early-signal');
    assert.equal((await app.closed).code, 0); assert.equal(app.stdout.includes('API disponível'), false);
    assert.deepEqual(app.report(), { poolEndCalls: 1, poolEnded: true, closeCalls: 1, listening: false, listenersRestored: true });
  });

  it('sinais repetidos compartilham encerramento e fecham o pool somente uma vez', async t => {
    const app = launch(t, String(await freePort()), 'slow-pool'); await app.ready();
    app.child.send('repeat'); assert.equal((await app.closed).code, 0);
    assert.equal(app.stdout.split('Encerrando recursos').length - 1, 1);
    assert.deepEqual(app.report(), { poolEndCalls: 1, poolEnded: true, closeCalls: 1, listening: false, listenersRestored: true });
  });

  it('encerra requisição em andamento antes de encerrar o pool', async t => {
    const port = await freePort(); const app = launch(t, String(port), 'drain'); await app.ready();
    const pending = fetch(`http://127.0.0.1:${port}/api/health/db`, { headers: { Connection: 'close' } });
    await app.until(() => app.messages.some(message => message.type === 'query-started'));
    app.child.send('stop');
    const response = await pending; assert.equal(response.status, 200); await response.arrayBuffer();
    assert.equal((await app.closed).code, 0);
    assert.equal(app.messages.find(message => message.type === 'pool-closing')!.queryFinished, true);
    assert.equal(app.report().poolEndCalls, 1);
  });

  it('falha ao encerrar pool resulta em saída 1 sem rejeição não tratada ou detalhes privados', async t => {
    const app = launch(t, String(await freePort()), 'pool-error'); await app.ready(); app.child.send('stop');
    assert.equal((await app.closed).code, 1); assert.match(app.stderr, /Não foi possível encerrar o pool/);
    assert.equal(app.stderr.includes('Detalhe privado'), false); assert.equal(app.stderr.includes('Unhandled'), false);
    assert.equal(app.report().poolEndCalls, 1); assert.equal(app.report().listenersRestored, true);
  });

  it('pool que não termina é limitado pelo prazo de quatro segundos', async t => {
    const app = launch(t, String(await freePort()), 'hung-pool'); await app.ready(); app.child.send('stop');
    assert.equal((await app.closed).code, 1); assert.match(app.stderr, /Tempo limite ao encerrar/);
    assert.equal(app.report().poolEndCalls, 1);
  });

  it('falha ao fechar HTTP não deixa servidor prendendo o processo', async t => {
    const port = await freePort(); const app = launch(t, String(port), 'http-close-error');
    await app.ready(); app.child.send('stop');
    assert.equal((await app.closed).code, 1); assert.match(app.stderr, /Não foi possível encerrar o servidor HTTP/);
    assert.equal(app.stderr.includes('Detalhe privado'), false);
    assert.equal(app.report().poolEndCalls, 1); assert.equal(app.report().poolEnded, true);
    const rebound = createServer(); rebound.listen(port, '127.0.0.1'); await once(rebound, 'listening');
    await new Promise<void>(resolve => rebound.close(() => resolve()));
  });

  it('PORT inválida é recusada antes de criar HTTP ou acessar o banco', async t => {
    for (const value of ['0', '65536', '3000.5', '', 'invalida']) {
      const app = launch(t, value);
      assert.equal((await app.closed).code, 1); assert.equal(app.stdout.includes('API disponível'), false);
      assert.match(app.stderr, /porta inteira entre 1 e 65535/);
    }
  });

  it('tsx watch reinicia na mesma porta sem EADDRINUSE nem mensagem falsa', async t => {
    const port = await freePort(); const app = launch(t, String(port), '', true);
    await app.until(() => app.stdout.includes('API disponível'));
    app.child.stdin!.write('\n');
    await app.until(() => app.stdout.split('API disponível').length - 1 >= 2);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
    app.child.send('stop'); await app.closed;
    assert.equal(app.stderr.includes('EADDRINUSE'), false); assert.equal(app.stdout.includes('Force killing'), false);
    const rebound = createServer(); rebound.listen(port, '127.0.0.1'); await once(rebound, 'listening');
    await new Promise<void>(resolve => rebound.close(() => resolve()));
  });
});
