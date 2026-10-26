// Processo exclusivo de teste: nenhum acesso ao PostgreSQL real.
import '../environment.js';
import { Server } from 'node:http';
import { pool } from '../../src/database/pool.js';

const mode = process.env.HTTP_TEST_MODE;
const originalEnd = pool.end.bind(pool);
const originalListen = Server.prototype.listen;
let poolEndCalls = 0, poolEnded = false, closeCalls = 0, queryFinished = false;
let server: Server | undefined;
const signalsBefore = { int: process.listenerCount('SIGINT'), term: process.listenerCount('SIGTERM') };

pool.end = (async () => {
  poolEndCalls++;
  process.send?.({ type: 'pool-closing', queryFinished });
  if (mode === 'slow-pool') await new Promise(resolve => setTimeout(resolve, 150));
  if (mode === 'hung-pool') await new Promise(() => {});
  await originalEnd();
  poolEnded = true;
  if (mode === 'pool-error') throw new Error('Detalhe privado do teste de fechamento.');
}) as typeof pool.end;

pool.query = (async () => {
  if (mode !== 'drain') throw new Error('Teste não deve consultar o banco.');
  process.send?.({ type: 'query-started' });
  await new Promise(resolve => setTimeout(resolve, 200));
  queryFinished = true;
  return { rows: [{ banco: 'isolado_simulado' }], rowCount: 1 };
}) as unknown as typeof pool.query;

Server.prototype.listen = function (this: Server, ...args: Parameters<Server['listen']>) {
  server = this;
  const originalClose = this.close.bind(this);
  this.close = ((...closeArgs: Parameters<Server['close']>) => {
    closeCalls++;
    if (mode === 'http-close-error') {
      process.nextTick(() => closeArgs[0]?.(new Error('Detalhe privado ao fechar HTTP.')));
      return this;
    }
    return originalClose(...closeArgs);
  }) as Server['close'];
  if (mode === 'EACCES' || mode === 'EIO' || mode === 'sync-error') {
    const error = Object.assign(new Error('Detalhe privado de inicialização.'), { code: mode === 'sync-error' ? 'EIO' : mode });
    if (mode === 'sync-error') throw error;
    process.nextTick(() => this.emit('error', error));
    return this;
  }
  const result = originalListen.apply(this, args);
  if (mode === 'early-signal') process.emit('SIGTERM');
  return result;
} as Server['listen'];

process.on('message', message => {
  if (message === 'stop') process.emit('SIGTERM');
  if (message === 'interrupt') process.emit('SIGINT');
  if (message === 'repeat') { process.emit('SIGTERM'); process.emit('SIGINT'); process.emit('SIGTERM'); }
});
process.channel?.unref();

process.on('exit', () => {
  console.log('HTTP_TEST_REPORT=' + JSON.stringify({
    poolEndCalls, poolEnded, closeCalls, listening: server?.listening ?? false,
    listenersRestored: process.listenerCount('SIGINT') === signalsBefore.int && process.listenerCount('SIGTERM') === signalsBefore.term,
  }));
});

await import('../../src/server.js');
const ready = () => process.send?.({ type: 'ready', listening: server!.listening });
if (server?.listening) ready(); else server?.once('listening', ready);
