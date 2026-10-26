import './environment.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function run(code: string, settings: Record<string, string | undefined>) {
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, ...settings },
    encoding: 'utf8', windowsHide: true, timeout: 10000,
  });
}

describe('Configuração de segurança e cookies de produção', () => {
  it('HTTPS, HttpOnly, SameSite=None e prefixo __Host são aplicados em produção', () => {
    const result = run(`
      import {createApp} from './src/app.ts';
      const db={query(){throw new Error('Banco não deve ser usado');},connect(){throw new Error('Banco não deve ser usado');}};
      const server=createApp(db).listen(0,'127.0.0.1');
      await new Promise(resolve=>server.once('listening',resolve));
      const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/auth/csrf',{headers:{Origin:'https://app.example.test'}});
      const cookie=response.headers.getSetCookie()[0];
      console.log(JSON.stringify({status:response.status,host:cookie.startsWith('__Host-dnb_csrf='),httpOnly:cookie.includes('HttpOnly'),secure:cookie.includes('Secure'),sameSite:cookie.includes('SameSite=None'),noDomain:!cookie.includes('Domain='),noStore:response.headers.get('cache-control')==='no-store'}));
      await new Promise(resolve=>server.close(resolve));
    `, { NODE_ENV: 'production', AUTH_ALLOWED_ORIGINS: 'https://app.example.test', AUTH_COOKIE_SAME_SITE: 'none' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { status: 200, host: true, httpOnly: true, secure: true, sameSite: true, noDomain: true, noStore: true });
  });

  it('recusa origem wildcard, HTTP em produção e SameSite=None sem HTTPS', () => {
    for (const settings of [
      { AUTH_ALLOWED_ORIGINS: '*' },
      { NODE_ENV: 'production', AUTH_ALLOWED_ORIGINS: 'http://app.example.test' },
      { NODE_ENV: 'development', AUTH_COOKIE_SAME_SITE: 'none' },
      { TRUST_PROXY_HOPS: '-1' },
    ]) {
      const result = run("await import('./src/config/auth.ts');", settings);
      assert.notEqual(result.status, 0);
    }
  });
});
