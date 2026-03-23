import { Link } from 'react-router-dom';
import { Ticket, TicketPriority, TicketStatus } from '../types';

interface TicketCardProps {
  ticket: Ticket;
}

const priorityColors: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const statusColors: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

export function TicketCard({ ticket }: TicketCardProps): JSX.Element {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 font-mono">#{ticket.id}</span>
            <h3 className="font-medium text-gray-900 truncate">{ticket.title}</h3>
          </div>
          <p className="text-gray-500 text-sm truncate">{ticket.description}</p>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
            {ticket.status.replace('_', ' ')}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[ticket.priority]}`}>
            {ticket.priority}
          </span>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
        <span>{ticket.department}</span>
        <span>·</span>
        <span>{ticket.category}</span>
        <span>·</span>
        <span>{new Date(ticket.created_at).toLocaleDateString('pl-PL')}</span>
      </div>
    </Link>
  );
}
