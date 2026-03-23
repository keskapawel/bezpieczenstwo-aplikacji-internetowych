import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';
import { RoleBadge } from './RoleBadge';

export function Navbar(): JSX.Element {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="text-xl font-bold text-blue-400 hover:text-blue-300 transition-colors">
          SecureDesk
        </Link>
        <Link to="/tickets" className="text-gray-300 hover:text-white transition-colors text-sm">
          Tickets
        </Link>
        {user?.role === 'ADMIN' && (
          <Link to="/admin" className="text-gray-300 hover:text-white transition-colors text-sm">
            Admin
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-gray-300 text-sm hidden sm:block">{user.name}</span>
            <span className="text-gray-400 text-xs hidden sm:block">{user.department}</span>
            <RoleBadge role={user.role} />
            <button
              onClick={() => { void handleLogout(); }}
              className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm transition-colors font-medium"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
