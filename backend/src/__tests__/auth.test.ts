import request from 'supertest';
import app from '../app';
import { seedTestDb } from './helpers/db';

/** Złożenie nagłówka Cookie z wielu Set-Cookie (pierwszy segment name=value). */
function cookieHeaderFromLogin(res: request.Response): string {
  const raw = res.headers['set-cookie'] as string[] | string | undefined;
  const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return lines
    .map((line) => line.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

beforeAll(async () => {
  await seedTestDb();
});

describe('POST /api/auth/login', () => {
  it('returns 200 with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('response contains accessToken', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin123' });
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('response user object has no password_hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin123' });
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('sets httpOnly refreshToken cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin123' });
    const cookie = res.headers['set-cookie'] as string[] | string | undefined;
    const cookieStr = Array.isArray(cookie) ? cookie.join('; ') : (cookie ?? '');
    expect(cookieStr).toContain('refreshToken=');
    expect(cookieStr).toContain('HttpOnly');
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'anything' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for inactive user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@test.com', password: 'Inactive123' });
    expect(res.status).toBe(403);
  });

  it('returns 422 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Admin123' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/refresh', () => {
  let cookieHeader: string;
  let csrfToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'Manager123' });
    cookieHeader = cookieHeaderFromLogin(res);
    csrfToken = res.body.data.csrfToken as string;
  });

  it('returns 200 with valid refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
  });

  it('response contains new accessToken', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee1@test.com', password: 'Employee123' });
    const cookies = cookieHeaderFromLogin(loginRes);
    const token = loginRes.body.data.csrfToken as string;

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', token);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('returns 401 without refresh cookie (CSRF OK)', async () => {
    const csrf = 'test-csrf-no-refresh';
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `csrfToken=${csrf}`)
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200', async () => {
    const csrf = 'test-csrf-logout';
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `csrfToken=${csrf}`)
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(200);
  });
});
