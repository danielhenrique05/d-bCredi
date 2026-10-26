export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const unauthorized = (): HttpError => new HttpError(401, 'Autenticação necessária.');
export const forbidden = (): HttpError => new HttpError(403, 'Operação não permitida.');
