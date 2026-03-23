import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import ticketRoutes from './routes/tickets.routes';
import userRoutes from './routes/users.routes';
import adminRoutes from './routes/admin.routes';
import { apiRateLimiter } from './middleware/rateLimiter.middleware';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/tickets', apiRateLimiter, ticketRoutes);
app.use('/api/users', apiRateLimiter, userRoutes);
app.use('/api/admin', apiRateLimiter, adminRoutes);

export default app;
