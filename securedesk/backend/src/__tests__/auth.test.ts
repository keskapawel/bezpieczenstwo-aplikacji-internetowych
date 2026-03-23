import request from 'supertest';
import app from '../app';
import { seedTestDb } from './helpers/db';

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
  let refreshCookie: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: 'Manager123' });
    const raw = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(raw) ? raw : [raw ?? ''];
    refreshCookie = cookies.find(c => c.startsWith('refreshToken=')) ?? '';
  });

  it('returns 200 with valid refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);
    expect(res.status).toBe(200);
  });

  it('response contains new accessToken', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee1@test.com', password: 'Employee123' });
    const raw = loginRes.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(raw) ? raw : [raw ?? ''];
    const cookie = cookies.find(c => c.startsWith('refreshToken=')) ?? '';

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('returns 401 without refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });
});
