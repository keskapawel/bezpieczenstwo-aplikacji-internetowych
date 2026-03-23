import { useState } from 'react';
import { api } from '../services/api.service';
import { ApiResponse } from '../types';

interface LockedUser {
  email: string;
  attempts: number;
  locked_until: string | null;
}

interface LockedUsersData {
  locked: LockedUser[];
}

export default function Cooldown() {
  const [secret, setSecret] = useState('');
  const [lockedUsers, setLockedUsers] = useState<LockedUser[] | null>(null);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchLockedUsers() {
    setError('');
    setResetMessage('');
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<LockedUsersData>>(
        `/api/auth/admin/locked-users?adminSecret=${encodeURIComponent(secret)}`
      );
      setLockedUsers(res.data.data?.locked ?? []);
    } catch {
      setError('Invalid admin secret or server error.');
      setLockedUsers(null);
    } finally {
      setLoading(false);
    }
  }

  async function resetLockout(email: string) {
    setResetMessage('');
    setError('');
    try {
      await api.post('/api/auth/admin/reset-lockout', { email, adminSecret: secret });
      setResetMessage(`Lockout cleared for ${email}`);
      await fetchLockedUsers();
    } catch {
      setError(`Failed to reset lockout for ${email}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Cooldown Admin Panel</h1>
          <p className="text-sm text-gray-500 mb-6">Reset login lockouts for locked-out users.</p>

          <div className="flex gap-2 mb-4">
            <input
              type="password"
              placeholder="Admin secret"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLockedUsers()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchLockedUsers}
              disabled={loading || !secret}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load'}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {resetMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {resetMessage}
            </div>
          )}

          {lockedUsers !== null && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                Currently locked accounts ({lockedUsers.length})
              </h2>
              {lockedUsers.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No locked accounts.</p>
              ) : (
                <ul className="space-y-2">
                  {lockedUsers.map(u => (
                    <li key={u.email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.email}</p>
                        <p className="text-xs text-gray-500">
                          {u.attempts} attempts · locked until {u.locked_until
                            ? new Date(u.locked_until).toLocaleTimeString()
                            : '—'}
                        </p>
                      </div>
                      <button
                        onClick={() => resetLockout(u.email)}
                        className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                      >
                        Reset
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          SecureDesk · <a href="/login" className="underline hover:text-gray-600">Back to Login</a>
        </p>
      </div>
    </div>
  );
}
