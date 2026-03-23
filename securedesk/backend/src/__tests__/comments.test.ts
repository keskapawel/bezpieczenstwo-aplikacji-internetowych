import request from 'supertest';
import app from '../app';
import { seedTestDb } from './helpers/db';

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.accessToken as string;
}

async function createComment(token: string, ticketId: number, content: string): Promise<number> {
  const res = await request(app)
    .post(`/api/tickets/${ticketId}/comments`)
    .set('Authorization', `Bearer ${token}`)
    .send({ content });
  return (res.body.data as { id: number }).id;
}

beforeEach(async () => {
  await seedTestDb();
});

describe('Comments permission matrix', () => {
  describe('PATCH /api/tickets/:ticketId/comments/:commentId (edit)', () => {
    it('owner can edit own comment (200)', async () => {
      const token = await login('employee1@test.com', 'Employee123');
      const commentId = await createComment(token, 1, 'original content');

      const res = await request(app)
        .patch(`/api/tickets/1/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'updated content' });
      expect(res.status).toBe(200);
    });

    it('EMPLOYEE cannot edit another user\'s comment (403)', async () => {
      const ownerToken = await login('employee1@test.com', 'Employee123');
      const commentId = await createComment(ownerToken, 1, 'owner comment');

      const adminToken = await login('admin@test.com', 'Admin123');
      // Create another employee and try — use manager as "other non-admin"
      const managerToken = await login('manager@test.com', 'Manager123');

      // Manager in IT dept can access IT ticket — but is not owner — not ADMIN
      const res = await request(app)
        .patch(`/api/tickets/1/comments/${commentId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ content: 'should fail' });
      expect(res.status).toBe(403);

      // Clean up: admin deletes it
      await request(app)
        .delete(`/api/tickets/1/comments/${commentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('ADMIN can edit any comment (200)', async () => {
      const employeeToken = await login('employee1@test.com', 'Employee123');
      const commentId = await createComment(employeeToken, 1, 'employee comment');

      const adminToken = await login('admin@test.com', 'Admin123');
      const res = await request(app)
        .patch(`/api/tickets/1/comments/${commentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'admin edited' });
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/tickets/:ticketId/comments/:commentId', () => {
    it('owner can delete own comment (200)', async () => {
      const token = await login('employee1@test.com', 'Employee123');
      const commentId = await createComment(token, 1, 'to be deleted');

      const res = await request(app)
        .delete(`/api/tickets/1/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('EMPLOYEE cannot delete another user\'s comment (403)', async () => {
      const ownerToken = await login('employee1@test.com', 'Employee123');
      const commentId = await createComment(ownerToken, 1, 'protected comment');

      // employee2 is in HR dept and cannot even access IT ticket
      // Use a freshly seeded context: admin creates comment on ticket 2 (HR)
      const adminToken = await login('admin@test.com', 'Admin123');
      const hrCommentId = await createComment(adminToken, 2, 'admin comment on HR ticket');

      const employee2Token = await login('employee2@test.com', 'Employee456');
      // employee2 owns ticket 2 but did NOT create this comment
      const res = await request(app)
        .delete(`/api/tickets/2/comments/${hrCommentId}`)
        .set('Authorization', `Bearer ${employee2Token}`);
      expect(res.status).toBe(403);

      // Cleanup
      await request(app)
        .delete(`/api/tickets/2/comments/${hrCommentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .delete(`/api/tickets/1/comments/${commentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
    });

    it('MANAGER can delete any comment in their dept (200)', async () => {
      const employeeToken = await login('employee1@test.com', 'Employee123');
      const commentId = await createComment(employeeToken, 1, 'manager will delete');

      const managerToken = await login('manager@test.com', 'Manager123');
      const res = await request(app)
        .delete(`/api/tickets/1/comments/${commentId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
    });

    it('ADMIN can delete any comment (200)', async () => {
      const employeeToken = await login('employee1@test.com', 'Employee123');
      const commentId = await createComment(employeeToken, 1, 'admin will delete');

      const adminToken = await login('admin@test.com', 'Admin123');
      const res = await request(app)
        .delete(`/api/tickets/1/comments/${commentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
