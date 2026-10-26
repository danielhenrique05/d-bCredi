import dotenv from 'dotenv';
import { validateEnv } from './env-validation.js';

// Carrega somente o .env do backend, inclusive ao executar a partir de outra pasta.
dotenv.config({ path: new URL('../../.env', import.meta.url), quiet: true });

export const env = validateEnv(process.env);
