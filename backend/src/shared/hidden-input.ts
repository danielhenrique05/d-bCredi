import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';

export function hiddenPassword(prompt: string): Promise<string> {
  if (!stdin.isTTY) throw new Error('Terminal interativo necessário. Para fonte segura, use --password-stdin.');
  stdout.write(prompt);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error?: Error): void => {
      stdin.off('keypress', onKey);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onKey = (text: string | undefined, key: { name?: string; ctrl?: boolean; meta?: boolean }): void => {
      if (key.ctrl && key.name === 'c') { finish(new Error('Operação cancelada.')); return; }
      if (key.name === 'return' || key.name === 'enter') { finish(); return; }
      if (key.name === 'backspace') { value = Array.from(value).slice(0, -1).join(''); return; }
      if (text && !key.ctrl && !key.meta && !/[\p{Cc}\p{Cf}]/u.test(text)) {
        if (value.length + text.length > 128) { finish(new Error('Senha excede o limite permitido.')); return; }
        value += text;
      }
    };
    stdin.on('keypress', onKey);
  });
}
