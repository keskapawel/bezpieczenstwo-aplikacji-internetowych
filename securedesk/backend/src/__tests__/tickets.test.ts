import request from 'supertest';
import app from '../app';
import { seedTestDb } from './helpers/db';

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.accessToken as string;
}

beforeAll(async () => {
  await seedTestDb();
});

describe('GET /api/tickets (RBAC)', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  it('EMPLOYEE sees only their own tickets', async () => {
    const token = await login('employee1@test.com', 'Employee123');
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const tickets = res.body.data.tickets as Array<{ created_by: number }>;
    expect(tickets.every(t => t.created_by === 3)).toBe(true);
  });

  it('MANAGER sees only tickets in their department', async () => {
    const token = await login('manager@test.com', 'Manager123');
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const tickets = res.body.data.tickets as Array<{ department: string }>;
    expect(tickets.every(t => t.department === 'IT')).toBe(true);
  });

  it('ADMIN sees all tickets', async () => {
    const token = await login('admin@test.com', 'Admin123');
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const tickets = res.body.data.tickets as Array<unknown>;
    expect(tickets.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/tickets/:id', () => {
  it('EMPLOYEE can GET their own ticket by ID', async () => {
    const token = await login('employee1@test.com', 'Employee123');
    const res = await request(app)
      .get('/api/tickets/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/tickets/:id', () => {
  it('EMPLOYEE cannot delete a ticket (403)', async () => {
    const token = await login('employee1@test.com', 'Employee123');
    const res = await request(app)
      .delete('/api/tickets/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('ADMIN can delete a ticket (200)', async () => {
    const token = await login('admin@test.com', 'Admin123');
    // Create a disposable ticket first
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Delete me', description: 'test', priority: 'LOW', category: 'Test' });
    const ticketId = (createRes.body.data as { id: number }).id;

    const res = await request(app)
      .delete(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
