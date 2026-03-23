import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { ticketsService } from '../services/tickets.service';
import { Ticket, TicketStatus, TicketPriority, UserRole, Department } from '../types';
import { Navbar } from '../components/Navbar';
import { TicketCard } from '../components/TicketCard';

const STATUSES = Object.values(TicketStatus);
const PRIORITIES = Object.values(TicketPriority);
const DEPARTMENTS = Object.values(Department);
const PAGE_SIZE = 10;

export function TicketList(): JSX.Element {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await ticketsService.getTickets({
          status: filterStatus || undefined,
          priority: filterPriority || undefined,
          department: filterDepartment || undefined,
          page,
          limit: PAGE_SIZE,
        });
        setTickets(data.tickets);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch {
        setTickets([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [filterStatus, filterPriority, filterDepartment, page]);

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const canShowDeptFilter = user?.role === UserRole.MANAGER || user?.role === UserRole.ADMIN;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
            <p className="text-gray-400 text-sm mt-0.5">{total} tickets</p>
          </div>
          <Link
            to="/tickets/new"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + New Ticket
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={filterStatus}
            onChange={handleFilterChange(setFilterStatus)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={handleFilterChange(setFilterPriority)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {canShowDeptFilter && (
            <select
              value={filterDepartment}
              onChange={handleFilterChange(setFilterDepartment)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {(filterStatus || filterPriority || filterDepartment) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterDepartment(''); setPage(1); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-3xl mb-2">🔍</div>
            No tickets found.
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {tickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-100 transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-sm text-gray-600 font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-100 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
