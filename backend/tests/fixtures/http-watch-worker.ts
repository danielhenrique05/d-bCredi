// Driver apenas para o watcher criado pelo teste. Não sinaliza processos externos.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const cli = createRequire(import.meta.url).resolve('tsx/cli');
process.on('message', message => { if (message === 'stop') process.emit('SIGINT'); });
process.channel?.unref();
process.argv = [process.execPath, cli, 'watch', '--clear-screen=false', fileURLToPath(new URL('./http-server-worker.ts', import.meta.url))];
await import(pathToFileURL(cli).href);
