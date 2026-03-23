import { UserRole } from '../types';

interface RoleBadgeProps {
  role: UserRole;
}

const roleColors: Record<UserRole, string> = {
  [UserRole.EMPLOYEE]: 'bg-green-100 text-green-800',
  [UserRole.MANAGER]: 'bg-blue-100 text-blue-800',
  [UserRole.ADMIN]: 'bg-red-100 text-red-800',
};

export function RoleBadge({ role }: RoleBadgeProps): JSX.Element {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[role]}`}>
      {role}
    </span>
  );
}
