import { useEffect, useState } from 'react';
import { api } from '../services/api.service';
import { User, SecurityLog, UserRole, ApiResponse } from '../types';
import { Navbar } from '../components/Navbar';
import { RoleBadge } from '../components/RoleBadge';

const ROLES = Object.values(UserRole);

interface UsersResponse {
  users: User[];
}

interface LogsResponse {
  logs: SecurityLog[];
}

export function AdminPanel(): JSX.Element {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const [usersRes, logsRes] = await Promise.all([
          api.get<ApiResponse<UsersResponse>>('/api/users'),
          api.get<ApiResponse<LogsResponse>>('/api/admin/logs'),
        ]);
        setUsers(usersRes.data.data?.users ?? []);
        setLogs(logsRes.data.data?.logs ?? []);
      } catch {
        // error handled silently
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleRoleChange = async (userId: number, role: UserRole): Promise<void> => {
    setRoleError(null);
    try {
      await api.patch<ApiResponse<unknown>>(`/api/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
      // Refresh logs to show the role change event
      const logsRes = await api.get<ApiResponse<LogsResponse>>('/api/admin/logs');
      setLogs(logsRes.data.data?.logs ?? []);
    } catch {
      setRoleError('Failed to update role. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-20 text-gray-400">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-400 text-sm mt-1">Manage users, roles, and view security logs</p>
        </div>

        {roleError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {roleError}
          </div>
        )}

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">
            Users
            <span className="ml-2 text-sm font-normal text-gray-400">({users.length} total)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dept</th>
                  <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Change Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-60' : ''}`}>
                    <td className="py-3 pr-4 font-medium text-gray-900">{u.name}</td>
                    <td className="py-3 pr-4 text-gray-500 text-xs font-mono">{u.email}</td>
                    <td className="py-3 pr-4 text-gray-600">{u.department}</td>
                    <td className="py-3 pr-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3">
                      <select
                        value={u.role}
                        onChange={(e) => { void handleRoleChange(u.id, e.target.value as UserRole); }}
                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">
            Security Logs
            <span className="ml-2 text-sm font-normal text-gray-400">(last 50 events)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="pb-3 pr-4 font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
                  <th className="pb-3 pr-4 font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="pb-3 pr-4 font-semibold text-gray-500 uppercase tracking-wide">User ID</th>
                  <th className="pb-3 pr-4 font-semibold text-gray-500 uppercase tracking-wide">IP Address</th>
                  <th className="pb-3 font-semibold text-gray-500 uppercase tracking-wide">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      No security events yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className={log.success ? 'hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'}>
                      <td className="py-2 pr-4 text-gray-400 font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('pl-PL')}
                      </td>
                      <td className="py-2 pr-4 font-mono text-gray-700">{log.action}</td>
                      <td className="py-2 pr-4 text-gray-400">{log.user_id ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-400 font-mono">{log.ip_address ?? '—'}</td>
                      <td className="py-2">
                        <span className={`font-bold text-base ${log.success ? 'text-green-600' : 'text-red-600'}`}>
                          {log.success ? '✓' : '✗'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
