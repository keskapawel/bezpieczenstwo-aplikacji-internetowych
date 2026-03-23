import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../services/auth.service';

// Czas bezczynności po którym następuje wylogowanie.
// Musi być krótszy niż TTL access tokenu (15 min), żeby inactivity logout
// zadziałał zanim token wygaśnie naturalnie i interceptor zacznie refreshować.
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minut

// Zdarzenia przeglądarki traktowane jako "aktywność użytkownika".
// Każde z nich resetuje odliczanie do zera.
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'keydown',
  'mousedown',
  'touchstart',
  'scroll',
];

/**
 * Wywołaj raz w App.tsx (globalnie).
 * Nasłuchuje aktywności użytkownika i wylogowuje po IDLE_TIMEOUT_MS bezczynności.
 * Aktualizuje store.secondsLeft co sekundę (potrzebne dla licznika w Navbar).
 */
export function useIdleTimer(): void {
  const { isAuthenticated, logout, setSecondsLeft } = useAuthStore();
  const navigate = useNavigate();

  // Ref zamiast state — zmiana lastActivity NIE powoduje re-renderu
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isAuthenticated) {
      // Wyczyść licznik gdy nie ma sesji
      setSecondsLeft(null);
      return;
    }

    // Resetuj lastActivity przy każdym zdarzeniu aktywności
    const handleActivity = (): void => {
      lastActivityRef.current = Date.now();
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Ustaw od razu pełną wartość — bez tego licznik pojawia się z 1s opóźnieniem
    // powodując skok layoutu w Navbar.
    setSecondsLeft(Math.ceil(IDLE_TIMEOUT_MS / 1000));

    // Tick co sekundę: oblicz ile czasu zostało, wyloguj jeśli czas minął
    const intervalId = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - idleMs) / 1000));

      setSecondsLeft(remaining);

      if (remaining === 0) {
        clearInterval(intervalId);
        void authService.logout().catch(() => {}).finally(() => {
          logout();
          toast.warning('Sesja wygasła z powodu braku aktywności. Zaloguj się ponownie.');
          navigate('/login');
        });
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      setSecondsLeft(null);
    };
  }, [isAuthenticated, logout, navigate, setSecondsLeft]);
}
