import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { UserRole } from '../types';

interface ApiErrorData {
  error?: string;
  captchaRequired?: boolean;
  captchaToken?: string;
  captchaQuestion?: string;
  lockedUntil?: string;
}

export function Login(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [pendingTwoFactorToken, setPendingTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const { login, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === UserRole.ADMIN ? '/admin' : '/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (pendingTwoFactorToken) {
        const data = await authService.verifyTwoFactorLogin(pendingTwoFactorToken, twoFactorCode);
        setPendingTwoFactorToken(null);
        setTwoFactorCode('');
        login(data.accessToken, data.user, data.csrfToken);
        navigate(data.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');
        return;
      }

      const data = await authService.login(email, password, captchaRequired ? { captchaToken, captchaAnswer } : undefined);
      setCaptchaRequired(false);
      setCaptchaToken('');
      setCaptchaQuestion('');
      setCaptchaAnswer('');

      if ('twoFactorRequired' in data) {
        setPendingTwoFactorToken(data.pendingToken);
        setPassword('');
        setTwoFactorCode('');
        return;
      }

      login(data.accessToken, data.user, data.csrfToken);
      navigate(data.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const body = err.response?.data as ApiErrorData | undefined;

        // Update captcha state if returned by server
        if (body?.captchaRequired) {
          setCaptchaRequired(true);
          setCaptchaToken(body.captchaToken ?? '');
          setCaptchaQuestion(body.captchaQuestion ?? '');
          setCaptchaAnswer('');
        }

        if (status === 423 && body?.lockedUntil) {
          const until = new Date(body.lockedUntil).toLocaleTimeString();
          setError(`Account locked until ${until} due to too many failed attempts. Visit /cooldown to reset.`);
        } else if (status === 429) {
          setError('Too many login attempts. Please wait 15 minutes before trying again.');
        } else if (status === 403) {
          setError('Your account has been deactivated. Please contact your administrator.');
        } else if (status === 401 && body?.captchaRequired) {
          setError(body.error === 'Incorrect CAPTCHA answer'
            ? 'Incorrect CAPTCHA answer. Please try again.'
            : 'Invalid credentials. Please solve the CAPTCHA below.');
        } else if (status === 401 && pendingTwoFactorToken) {
          setError('Invalid authenticator code. Please try again.');
        } else if (status === 401) {
          setError('Invalid email or password. Please check your credentials.');
        } else if (status === 422) {
          setError('Please enter a valid email address and password.');
        } else {
          setError(body?.error ?? 'Login failed. Please try again.');
        }
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">SecureDesk</h1>
          <p className="text-gray-400 mt-2">Internal Ticket Management System</p>
        </div>

        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="bg-white rounded-2xl shadow-2xl p-8 space-y-5"
        >
          <h2 className="text-xl font-semibold text-gray-900">
            {pendingTwoFactorToken ? 'Enter authenticator code' : 'Sign in to your account'}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {pendingTwoFactorToken ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Open Microsoft Authenticator or another TOTP app and enter the 6-digit code.
              </p>
              <div>
                <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Authenticator code
                </label>
                <input
                  id="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoComplete="one-time-code"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm tracking-[0.4em] font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="000000"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingTwoFactorToken(null);
                  setTwoFactorCode('');
                  setError(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Use a different account
              </button>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              {captchaRequired && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                    Security verification required
                  </p>
                  <p className="text-sm text-amber-900 font-medium">{captchaQuestion}</p>
                  <input
                    type="number"
                    value={captchaAnswer}
                    onChange={e => setCaptchaAnswer(e.target.value)}
                    required
                    placeholder="Your answer"
                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading || (Boolean(pendingTwoFactorToken) && twoFactorCode.length !== 6)}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition-colors text-sm"
          >
            {loading
              ? pendingTwoFactorToken ? 'Verifying...' : 'Signing in...'
              : pendingTwoFactorToken ? 'Verify code' : 'Sign in'}
          </button>

          {!pendingTwoFactorToken && (
            <p className="text-center text-xs text-gray-400">
              Account locked?{' '}
              <Link to="/cooldown" className="text-blue-600 hover:underline">
                Reset cooldown
              </Link>
            </p>
          )}
        </form>

        <div className="mt-4 bg-gray-800 bg-opacity-50 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-400 mb-2">Test accounts:</p>
          <div className="space-y-1 text-xs text-gray-500 font-mono">
            <div>admin@securedesk.com / Admin123!</div>
            <div>manager.it@securedesk.com / Manager123!</div>
            <div>jan.kowalski@securedesk.com / Employee123!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
