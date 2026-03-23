import crypto from 'crypto';

interface CaptchaEntry {
  answer: number;
  expires: number;
}

// In-memory store: token → {answer, expires}
const store = new Map<string, CaptchaEntry>();

// Clean up expired tokens periodically (skip in test to avoid open handles)
if (process.env['NODE_ENV'] !== 'test') {
  setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of store.entries()) {
      if (entry.expires < now) store.delete(token);
    }
  }, 60_000);
}

export interface CaptchaChallenge {
  token: string;
  question: string;
}

export function generateCaptcha(): CaptchaChallenge {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const token = crypto.randomBytes(16).toString('hex');
  store.set(token, { answer: a + b, expires: Date.now() + 5 * 60_000 });
  return { token, question: `What is ${a} + ${b}?` };
}

export function validateCaptcha(token: string, answer: string): boolean {
  const entry = store.get(token);
  if (!entry) return false;
  if (entry.expires < Date.now()) { store.delete(token); return false; }
  const correct = parseInt(answer, 10) === entry.answer;
  if (correct) store.delete(token); // single use
  return correct;
}
