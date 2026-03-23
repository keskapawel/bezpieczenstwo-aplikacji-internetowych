# SecureDesk — Internal Ticket System

System ticketów wewnętrznych z pełną autoryzacją dostępu do API. Projekt demonstracyjny z zakresu bezpieczeństwa aplikacji webowych.

## Opis projektu

SecureDesk to system zarządzania zgłoszeniami (ticketami) dla pracowników firmy. Serce projektu stanowią mechanizmy bezpieczeństwa: dwutokenowe JWT, hashowanie bcrypt, rate limiting, httpOnly cookies, RBAC (Role-Based Access Control) oraz logowanie zdarzeń bezpieczeństwa.

Trzy role: **EMPLOYEE** (własne tickety), **MANAGER** (tickety działu), **ADMIN** (pełny dostęp).

---

## Szybki start

```bash
# 1. Backend
cd backend
npm install
npm run seed      # tworzy bazę danych i wypełnia danymi testowymi
npm run dev       # uruchamia na http://localhost:3001

# 2. Frontend (nowe okno terminala)
cd frontend
npm install
npm run dev       # uruchamia na http://localhost:5173
```

Otwórz http://localhost:5173 i zaloguj się jednym z kont testowych.

### Konta testowe

| Email | Hasło | Rola | Dział |
|-------|-------|------|-------|
| admin@securedesk.com | Admin123! | ADMIN | IT |
| manager.it@securedesk.com | Manager123! | MANAGER | IT |
| manager.hr@securedesk.com | Manager123! | MANAGER | HR |
| jan.kowalski@securedesk.com | Employee123! | EMPLOYEE | IT |
| anna.nowak@securedesk.com | Employee123! | EMPLOYEE | IT |
| piotr.wisniewski@securedesk.com | Employee123! | EMPLOYEE | HR |
| maria.wojcik@securedesk.com | Employee123! | EMPLOYEE | HR |
| test.inactive@securedesk.com | Employee123! | EMPLOYEE (nieaktywny) | HR |

---

## Endpointy API

| Metoda | Ścieżka | Wymagana rola | Opis |
|--------|---------|---------------|------|
| POST | /api/auth/login | — | Logowanie, zwraca access token + ustawia refresh cookie |
| POST | /api/auth/refresh | — (cookie) | Odświeża access token przez httpOnly cookie |
| POST | /api/auth/logout | — | Wylogowanie, usuwa refresh token |
| GET | /api/auth/admin/locked-users | ADMIN_SECRET (query) | Lista zablokowanych kont |
| POST | /api/auth/admin/reset-lockout | ADMIN_SECRET (body) | Reset blokady dla emaila |
| GET | /api/tickets | EMPLOYEE/MANAGER/ADMIN | Lista ticketów (filtrowana wg roli) |
| POST | /api/tickets | EMPLOYEE/MANAGER/ADMIN | Utwórz ticket |
| GET | /api/tickets/stats | EMPLOYEE/MANAGER/ADMIN | Statystyki wg statusu |
| GET | /api/tickets/:id | właściciel lub MANAGER/ADMIN | Szczegóły ticketu |
| PATCH | /api/tickets/:id | właściciel (treść) / MANAGER+ (status) | Edytuj ticket |
| DELETE | /api/tickets/:id | ADMIN | Usuń ticket |
| GET | /api/users | ADMIN | Lista użytkowników |
| PATCH | /api/users/:id/role | ADMIN | Zmień rolę użytkownika |
| GET | /api/admin/logs | ADMIN | Logi bezpieczeństwa |

---

## Mechanizmy bezpieczeństwa

### 1. JWT Dual-Token (access + refresh)

**Co:** Dwa tokeny — krótkotrwały access token (15 min) i długotrwały refresh token (7 dni).

**Dlaczego:** Single token z długim czasem ważności to ryzyko — jeśli wycieknie, atakujący ma dostęp przez tygodnie. Krótki access token ogranicza okno ataku do 15 minut. Refresh token umożliwia automatyczne odnowienie bez ponownego logowania.

**Jak:** Access token zwracany w ciele odpowiedzi i przechowywany w pamięci Zustand (nie localStorage — niedostępny dla ataków XSS). Refresh token ustawiany jako **httpOnly cookie** — niedostępny dla JavaScript, automatycznie wysyłany przez przeglądarkę.

### 2. Hashowanie haseł bcrypt (salt rounds = 12)

**Co:** Hasła haszowane algorytmem bcrypt z 12 rundami solenia.

**Dlaczego:** Bcrypt jest celowo wolny (adaptacyjny). 12 rund oznacza ~250ms na hash — akceptowalne dla użytkownika, ale uniemożliwiające brute-force na dużą skalę. MD5/SHA bez soli to błąd — ataki rainbow table działają w sekundy.

**Jak:** `bcrypt.hash(password, 12)` przy rejestracji/seedzie. `bcrypt.compare(input, hash)` przy logowaniu. Pole `password_hash` nigdy nie wraca w odpowiedzi API.

### 3. Rate Limiting (express-rate-limit)

**Co:** Ograniczenie liczby żądań per IP — 5 prób logowania/15 min, 100 req/15 min dla pozostałych.

**Dlaczego:** Bez limitu atakujący może wysłać miliony żądań logowania (brute-force) lub spowodować DoS. Rate limit blokuje takie ataki na poziomie infrastruktury aplikacji.

**Jak:** Middleware `loginRateLimiter` na `/api/auth/login`, `apiRateLimiter` na pozostałych trasach.

### 4. Security Headers (helmet.js)

**Co:** Automatyczne ustawienie nagłówków HTTP: HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, CSP i innych.

**Dlaczego:** Nagłówki obronne to pierwsza linia obrony przed XSS, clickjacking, MIME sniffing i innymi atakami przeglądarkowymi. Ich brak to błąd konfiguracji — atakujący aktywnie skanują jego brak.

### 5. CORS (Cross-Origin Resource Sharing)

**Co:** Dozwolone tylko żądania z `http://localhost:5173`, `credentials: true`.

**Dlaczego:** Bez CORS lub z wildcard (`*`) złośliwa strona może wykonywać uwierzytelnione żądania do API w imieniu zalogowanego użytkownika (CSRF przez fetch). `credentials: true` + konkretny origin to jedyna bezpieczna konfiguracja dla plików cookie.

### 6. Walidacja inputów (express-validator)

**Co:** Walidacja wszystkich pól POST/PATCH — typy, formaty, wartości enum.

**Dlaczego:** Niestworzone dane wejściowe to wektor SQL injection, XSS, logic errors. Walidacja na poziomie aplikacji to obowiązkowa warstwa obrony nawet przy użyciu ORM/query builderów.

**Jak:** Parametryzowane zapytania SQL (`db.prepare('... WHERE id = ?').run(id)`) — nigdy konkatenacja stringów. Walidacja zwraca HTTP 422 z błędami per pole.

### 7. Logowanie zdarzeń bezpieczeństwa

**Co:** Każde logowanie (udane i nieudane), zmiana roli i usunięcie ticketu zapisywane w `security_logs` z IP, user-agent i znacznikiem czasu.

**Dlaczego:** Bez logów nie można wykryć ataków, przeprowadzić audytu ani odpowiedzieć na incydent bezpieczeństwa. RODO i ISO 27001 wymagają logowania dostępu.

### 8. Blokada konta i CAPTCHA po nieudanych próbach logowania

**Co:** Śledzenie liczby nieudanych prób logowania per email w tabeli `login_attempts`. Po **3 nieudanych próbach** wymagana jest weryfikacja CAPTCHA. Po **5 nieudanych próbach** konto jest blokowane na **15 minut**.

**Dlaczego:** Same rate limity IP nie wystarczą — atakujący może używać wielu adresów IP. Blokada per-email uniemożliwia brute-force hasła konkretnego konta nawet z różnych IP. CAPTCHA podnosi koszt ataku automatycznego po kilku próbach.

**Jak działa CAPTCHA:**

Obecna implementacja to **akademickie CAPTCHA matematyczne** (np. `"What is 4 + 7?"`):
1. Po 3 nieudanych próbach serwer zwraca `captchaRequired: true` wraz z `captchaToken` i `captchaQuestion`
2. Frontend wyświetla pytanie i pole odpowiedzi
3. Kolejne żądanie logowania musi zawierać `captchaToken` i `captchaAnswer`
4. Token jest jednorazowy i wygasa po 5 minutach
5. Błędna odpowiedź generuje nowe pytanie

**Produkcja — migracja do prawdziwego CAPTCHA:**

Dla środowiska produkcyjnego zalecane jest zastąpienie matematycznego CAPTCHA prawdziwą usługą:
- **hCaptcha** (GDPR-compliant): https://www.hcaptcha.com/
- **Google reCAPTCHA v3** (score-based, niewidoczne)
- **Cloudflare Turnstile** (prywatność pierwsza)

Migracja wymaga: klucza API (sekretu po stronie serwera + klucza publicznego po stronie klienta), weryfikacji tokenu po stronie serwera przez wywołanie API dostawcy CAPTCHA.

**Panel administratora `/cooldown`:**

Strona `/cooldown` dostępna **bez logowania** — przeznaczona dla administratorów do ręcznego odblokowania zablokowanych kont. Chroniona kluczem `ADMIN_SECRET` z `.env`.

```bash
# Lista zablokowanych kont
curl "http://localhost:3001/api/auth/admin/locked-users?adminSecret=twoj-sekret"

# Reset blokady dla konkretnego emaila
curl -X POST http://localhost:3001/api/auth/admin/reset-lockout \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","adminSecret":"twoj-sekret"}'
```

> **Bezpieczeństwo:** Klucz `ADMIN_SECRET` powinien być silny i przechowywany w zmiennych środowiskowych. W produkcji endpoint powinien być dostępny tylko z sieci wewnętrznej (IP whitelist/VPN), nie z publicznego internetu.

---

## Przykłady curl

### Logowanie

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@securedesk.com","password":"Admin123!"}' \
  -c cookies.txt

# Zwraca: { "success": true, "data": { "accessToken": "eyJ...", "user": {...} } }
# Cookie refreshToken ustawiony automatycznie
```

### Pobieranie ticketów (z access tokenem)

```bash
TOKEN="eyJ..."  # access token z logowania

curl http://localhost:3001/api/tickets \
  -H "Authorization: Bearer $TOKEN"

# Z filtrowaniem:
curl "http://localhost:3001/api/tickets?status=OPEN&priority=HIGH" \
  -H "Authorization: Bearer $TOKEN"
```

### Tworzenie ticketu

```bash
curl -X POST http://localhost:3001/api/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Problem z VPN","description":"VPN nie działa po aktualizacji","priority":"HIGH","category":"Technical Issue"}'
```

### Aktualizacja statusu (MANAGER/ADMIN)

```bash
curl -X PATCH http://localhost:3001/api/tickets/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS","assigned_to":2}'
```

### Usunięcie ticketu (tylko ADMIN)

```bash
curl -X DELETE http://localhost:3001/api/tickets/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Zmiana roli użytkownika (tylko ADMIN)

```bash
curl -X PATCH http://localhost:3001/api/users/4/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"MANAGER"}'
```

### Logi bezpieczeństwa (tylko ADMIN)

```bash
curl http://localhost:3001/api/admin/logs \
  -H "Authorization: Bearer $TOKEN"
```

### Odświeżenie tokenu (przez cookie)

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -b cookies.txt -c cookies.txt
# Zwraca nowy accessToken
```

### Wylogowanie

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt -c cookies.txt
```

---

## Znane ograniczenia i co można poprawić w produkcji

### Bezpieczeństwo

- **Sekrety JWT w kodzie** — `securedesk-access-secret-dev` to placeholder. Produkcja: silne losowe sekrety w zmiennych środowiskowych lub vault (HashiCorp Vault, AWS Secrets Manager).
- **Brak HTTPS** — httpOnly cookie bez flagi `Secure: true` może być przechwycone przez MITM. Produkcja: TLS wszędzie + `secure: true` w opcjach cookie.
- **Brak limitowania per użytkownik** — rate limit oparty tylko o IP. Atak z wielu IP (botnet) obejdzie limit. Produkcja: rate limit per user_id po uwierzytelnieniu.
- **Token rotation** — refresh token powinien być jednorazowy (rotation). Aktualnie stary token jest usuwany przy refresh, ale nie ma mechanizmu wykrywania reuse (tokenów wykradzionych przed odświeżeniem).
- **Brak CSRF protection** — mimo `SameSite: strict`, produkcja powinna rozważyć dodatkowy CSRF token dla endpointów mutujących dane.

### Architektura

- **SQLite** — nie nadaje się do środowisk z wieloma instanceami aplikacji. Produkcja: PostgreSQL lub MySQL z connection poolingiem.
- **Brak migracji** — schemat tworzony raz w `database.ts`. Produkcja: narzędzie migracji (Drizzle, Prisma Migrate, Flyway).
- **Testy jednostkowe** — pokrycie JWT, auth, RBAC ticketów i uprawnień komentarzy (`npm test`). Brak testów E2E. Produkcja: Playwright dla E2E.
- **Brak paginacji po stronie serwera** — tickety filtrowane w pamięci JS. Produkcja: `LIMIT/OFFSET` w SQL z parametrami strony w query params.
- **Brak refresh token rotation** — produkcja powinna implementować rotation i detekcję ponownego użycia.

### Frontend

- **Brak persystencji sesji** — access token w pamięci Zustand ginie przy odświeżeniu strony. Produkcja: przy ładowaniu aplikacji wywołaj `/api/auth/refresh` — jeśli cookie istnieje, użytkownik pozostaje zalogowany.
- **Brak obsługi wygaśnięcia sesji podczas używania** — interceptor obsługuje 401, ale brak toast notifications dla użytkownika.
