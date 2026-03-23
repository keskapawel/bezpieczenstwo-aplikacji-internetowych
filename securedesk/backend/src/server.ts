import 'dotenv/config';
import app from './app';
import './database'; // ensure DB is initialized on startup

const PORT = process.env['PORT'] ?? 3001;

app.listen(PORT, () => {
  console.log(`SecureDesk backend running on http://localhost:${PORT}`);
});
