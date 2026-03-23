import { useNavigate } from 'react-router-dom';

export function Unauthorized(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-red-200 mb-4 select-none">403</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          You don't have permission to access this page.
          Contact your administrator if you believe this is a mistake.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            ← Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
