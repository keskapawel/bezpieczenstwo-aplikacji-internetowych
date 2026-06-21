import { FormEvent, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { TwoFactorSetupResponse } from '../types';

export function TwoFactorSettings(): JSX.Element {
  const { user, setUser } = useAuthStore();
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const twoFactorEnabled = user?.two_factor_enabled === 1;

  const resetFeedback = (): void => {
    setMessage(null);
    setError(null);
  };

  const normalizeCode = (value: string): string => value.replace(/\D/g, '').slice(0, 6);

  const startSetup = async (): Promise<void> => {
    resetFeedback();
    setLoading(true);
    try {
      const data = await authService.startTwoFactorSetup();
      setSetup(data);
      setCode('');
    } catch {
      setError('Could not start 2FA setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const enableTwoFactor = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const updatedUser = await authService.enableTwoFactor(code);
      setUser(updatedUser);
      setSetup(null);
      setCode('');
      setMessage('2FA is now enabled for your account.');
    } catch {
      setError('Invalid authenticator code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const disableTwoFactor = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const updatedUser = await authService.disableTwoFactor(code);
      setUser(updatedUser);
      setCode('');
      setMessage('2FA has been disabled.');
    } catch {
      setError('Invalid authenticator code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Two-factor authentication</h1>
          <p className="text-gray-500 text-sm mt-1">
            Use Microsoft Authenticator, Google Authenticator, or any TOTP-compatible app.
          </p>
        </div>

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Account status</h2>
              <p className="text-sm text-gray-500">
                {twoFactorEnabled
                  ? '2FA is enabled. Login requires your password and authenticator code.'
                  : '2FA is not enabled yet.'}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              twoFactorEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {!twoFactorEnabled && !setup && (
            <button
              type="button"
              onClick={() => { void startSetup(); }}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {loading ? 'Preparing...' : 'Set up 2FA'}
            </button>
          )}

          {!twoFactorEnabled && setup && (
            <form onSubmit={(event) => { void enableTwoFactor(event); }} className="space-y-5">
              <div className="grid md:grid-cols-[180px,1fr] gap-5">
                <div className="border border-gray-200 rounded-xl p-3 bg-white">
                  <img src={setup.qrCodeDataUrl} alt="2FA QR code" className="w-full h-auto" />
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Scan the QR code with Microsoft Authenticator. If scanning is unavailable,
                    enter this key manually:
                  </p>
                  <code className="block break-all bg-gray-100 border border-gray-200 rounded-lg p-3 text-xs text-gray-700">
                    {setup.manualEntryKey}
                  </code>
                  <div>
                    <label htmlFor="enableTwoFactorCode" className="block text-sm font-medium text-gray-700 mb-1">
                      First 6-digit code
                    </label>
                    <input
                      id="enableTwoFactorCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(normalizeCode(event.target.value))}
                      required
                      autoComplete="one-time-code"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="000000"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {loading ? 'Verifying...' : 'Enable 2FA'}
              </button>
            </form>
          )}

          {twoFactorEnabled && (
            <form onSubmit={(event) => { void disableTwoFactor(event); }} className="space-y-4">
              <div>
                <label htmlFor="disableTwoFactorCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Current authenticator code
                </label>
                <input
                  id="disableTwoFactorCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(normalizeCode(event.target.value))}
                  required
                  autoComplete="one-time-code"
                  className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {loading ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
