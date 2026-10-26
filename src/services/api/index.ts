import { createApiClient, type ApiClientOptions } from '../../lib/api/client.ts';
import { createAuthService } from './auth.ts';
import { createUsuariosService } from './usuarios.ts';

/** Uma instância compartilhada mantém o mesmo ciclo CSRF para ambos os serviços. */
export function createBackendServices(options: ApiClientOptions = {}) {
  const api = createApiClient(options);
  return { auth: createAuthService(api), usuarios: createUsuariosService(api) };
}

export type BackendServices = ReturnType<typeof createBackendServices>;
