import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { ticketsService } from '../services/tickets.service';
import { Ticket, TicketStatus } from '../types';
import { TicketCard } from '../components/TicketCard';
import { Navbar } from '../components/Navbar';

const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Open',
  [TicketStatus.IN_PROGRESS]: 'In Progress',
  [TicketStatus.RESOLVED]: 'Resolved',
  [TicketStatus.CLOSED]: 'Closed',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'border-blue-500 bg-blue-50 text-blue-700',
  [TicketStatus.IN_PROGRESS]: 'border-yellow-500 bg-yellow-50 text-yellow-700',
  [TicketStatus.RESOLVED]: 'border-green-500 bg-green-50 text-green-700',
  [TicketStatus.CLOSED]: 'border-gray-400 bg-gray-50 text-gray-600',
};

const ALL_STATUSES = Object.values(TicketStatus);

export function Dashboard(): JSX.Element {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Partial<Record<TicketStatus, number>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      try {
        const data = await ticketsService.getTickets();
        setTickets(data.tickets);
        const statMap: Record<TicketStatus, number> = {
          [TicketStatus.OPEN]: 0,
          [TicketStatus.IN_PROGRESS]: 0,
          [TicketStatus.RESOLVED]: 0,
          [TicketStatus.CLOSED]: 0,
        };
        data.tickets.forEach((t) => {
          statMap[t.status] = (statMap[t.status] ?? 0) + 1;
        });
        setStats(statMap);
      } catch {
        // silently fail for dashboard
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, []);

  const recentTickets = tickets.slice(0, 5);
  const totalTickets = tickets.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.department} department · {user?.role}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">⏳</div>
            Loading your dashboard...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {ALL_STATUSES.map((status) => (
                <div
                  key={status}
                  className={`border-l-4 rounded-xl p-5 ${STATUS_COLORS[status]}`}
                >
                  <div className="text-3xl font-bold">{stats[status] ?? 0}</div>
                  <div className="text-sm font-medium mt-1">{STATUS_LABELS[status]}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Recent Tickets</h2>
                  <p className="text-gray-400 text-sm">{totalTickets} total tickets</p>
                </div>
                <Link
                  to="/tickets"
                  className="text-blue-600 text-sm hover:underline font-medium"
                >
                  View all →
                </Link>
              </div>

              {recentTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-3xl mb-2">🎫</div>
                  <p>No tickets yet.</p>
                  <Link to="/tickets/new" className="text-blue-600 text-sm hover:underline mt-2 block">
                    Create your first ticket →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
