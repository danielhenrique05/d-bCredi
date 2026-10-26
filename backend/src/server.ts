import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './database/pool.js';
import { logDevelopmentError } from './shared/logger.js';

const server = createServer(app);
let started = false;
let shuttingDown: Promise<void> | undefined;
let closingPool: Promise<boolean> | undefined;

function closePool(): Promise<boolean> {
  return closingPool ??= (async () => {
    try { await pool.end(); return true; }
    catch (error: unknown) {
      process.exitCode = 1;
      console.error('Não foi possível encerrar o pool PostgreSQL.');
      logDevelopmentError('Erro ao encerrar conexões do PostgreSQL.', error);
      return false;
    }
  })();
}

function shutdown(failed = false): Promise<void> {
  if (failed) process.exitCode = 1;
  else process.exitCode ??= 0;
  if (shuttingDown) return shuttingDown;
  server.off('listening', onListening);
  console.info('Encerrando recursos da API...');
  // tsx watch instalado aguarda 5 s; a API deve terminar antes desse limite.
  const timeout = setTimeout(() => {
    console.error('Tempo limite ao encerrar a API.');
    server.closeAllConnections();
    void closePool();
    process.exit(1);
  }, 4000);

  shuttingDown = (async () => {
    let httpClosed = true;
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
          else resolve();
        });
      });
    } catch (error: unknown) {
      httpClosed = false;
      process.exitCode = 1;
      console.error('Não foi possível encerrar o servidor HTTP.');
      logDevelopmentError('Erro ao encerrar o servidor.', error);
    } finally {
      // Deixa requisições em andamento terminarem antes de fechar o banco.
      const poolClosed = await closePool();
      clearTimeout(timeout);
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      // Uma falha de close não pode deixar handles abertos prendendo o processo.
      if (!httpClosed || !poolClosed) process.exit(1);
    }
  })();
  return shuttingDown;
}

function onSignal(): void { void shutdown(); }

function onListening(): void {
  if (shuttingDown) return;
  started = true;
  console.info(`D&B Credi API disponível em http://127.0.0.1:${env.port}`);
}

function onServerError(error: unknown): void {
  process.exitCode = 1;
  if (shuttingDown) return;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === 'EADDRINUSE') console.error(`A porta ${env.port} já está ocupada (EADDRINUSE). O servidor HTTP não foi iniciado.`);
  else if (code === 'EACCES') console.error(`Sem permissão para usar a porta ${env.port} (EACCES). O servidor HTTP não foi iniciado.`);
  else console.error(started ? 'Falha no servidor HTTP.' : `Não foi possível iniciar o servidor HTTP na porta ${env.port}.`);
  logDevelopmentError(started ? 'Erro no servidor HTTP.' : 'Erro ao iniciar o servidor.', error);
  void shutdown(true);
}

// Express 5 também chama o callback de app.listen em erros. O evento nativo
// listening confirma exclusivamente o bind bem-sucedido, sem mensagem falsa.
server.once('listening', onListening);
server.on('error', onServerError);
process.on('SIGINT', onSignal);
process.on('SIGTERM', onSignal);
try { server.listen(env.port, '127.0.0.1'); }
catch (error: unknown) { onServerError(error); }
