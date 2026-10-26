import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const options = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const hashPassword = (password: string): Promise<string> => argon2.hash(password, options);

// Mesmo trabalho Argon2 quando a conta não existe, está inativa ou tem hash inválido.
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(hash: string | undefined, password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(32).toString('base64url'));
  const dummy = await dummyHash;
  if (!hash?.startsWith('$argon2id$')) {
    await argon2.verify(dummy, password);
    return false;
  }
  try { return await argon2.verify(hash, password); }
  catch {
    await argon2.verify(dummy, password);
    return false;
  }
}
