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

| Email                           | Hasło        | Rola                  | Dział |
| ------------------------------- | ------------ | --------------------- | ----- |
| admin@securedesk.com            | Admin123!    | ADMIN                 | IT    |
| manager.it@securedesk.com       | Manager123!  | MANAGER               | IT    |
| manager.hr@securedesk.com       | Manager123!  | MANAGER               | HR    |
| jan.kowalski@securedesk.com     | Employee123! | EMPLOYEE              | IT    |
| anna.nowak@securedesk.com       | Employee123! | EMPLOYEE              | IT    |
| piotr.wisniewski@securedesk.com | Employee123! | EMPLOYEE              | HR    |
| maria.wojcik@securedesk.com     | Employee123! | EMPLOYEE              | HR    |
| test.inactive@securedesk.com    | Employee123! | EMPLOYEE (nieaktywny) | HR    |

---

## Endpointy API

| Metoda | Ścieżka                       | Wymagana rola                          | Opis                                                    |
| ------ | ----------------------------- | -------------------------------------- | ------------------------------------------------------- |
| POST   | /api/auth/login               | —                                      | Logowanie, zwraca access token + ustawia refresh cookie |
| POST   | /api/auth/refresh             | — (cookie)                             | Odświeża access token przez httpOnly cookie             |
| POST   | /api/auth/logout              | —                                      | Wylogowanie, usuwa refresh token                        |
| GET    | /api/auth/admin/locked-users  | ADMIN_SECRET (query)                   | Lista zablokowanych kont                                |
| POST   | /api/auth/admin/reset-lockout | ADMIN_SECRET (body)                    | Reset blokady dla emaila                                |
| GET    | /api/tickets                  | EMPLOYEE/MANAGER/ADMIN                 | Lista ticketów (filtrowana wg roli)                     |
| POST   | /api/tickets                  | EMPLOYEE/MANAGER/ADMIN                 | Utwórz ticket                                           |
| GET    | /api/tickets/stats            | EMPLOYEE/MANAGER/ADMIN                 | Statystyki wg statusu                                   |
| GET    | /api/tickets/:id              | właściciel lub MANAGER/ADMIN           | Szczegóły ticketu                                       |
| PATCH  | /api/tickets/:id              | właściciel (treść) / MANAGER+ (status) | Edytuj ticket                                           |
| DELETE | /api/tickets/:id              | ADMIN                                  | Usuń ticket                                             |
| GET    | /api/users                    | ADMIN                                  | Lista użytkowników                                      |
| PATCH  | /api/users/:id/role           | ADMIN                                  | Zmień rolę użytkownika                                  |
| GET    | /api/admin/logs               | ADMIN                                  | Logi bezpieczeństwa                                     |

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

## Deploy — Oracle Cloud (CI/CD)

### Architektura produkcyjna

```
git push main
    └── GitHub Actions (.github/workflows/deploy.yml)
          ├── Job 1: ci  — npm test + npm run build (backend + frontend)
          └── Job 2: deploy — SSH → Oracle VM
                    ├── git pull origin main
                    ├── npm run build (backend + frontend)
                    ├── sudo cp dist/ → /var/www/securedesk/
                    └── pm2 reload securedesk-backend

Oracle Cloud VM
    ├── nginx:80  →  /var/www/securedesk  (frontend, pliki statyczne)
    │              →  /api/*  proxy  →  Node.js:3001
    └── pm2         →  backend/dist/server.js
```

### Jednorazowy setup serwera

```bash
# 1. Zaloguj się na VM
ssh ubuntu@ORACLE_IP

# 2. Uruchom skrypt setup (instaluje Node.js, nginx, pm2, klonuje repo)
sudo bash scripts/server-setup.sh

# 3. Skopiuj pliki .env z lokalnego komputera
scp backend/.env ubuntu@ORACLE_IP:/opt/securedesk/backend/.env
cp frontend/.env.production.example frontend/.env.production
# Edytuj VITE_API_BASE_URL na adres VM, np.: https://securedesk.example.com
scp frontend/.env.production ubuntu@ORACLE_IP:/opt/securedesk/frontend/.env.production

# 4. Pierwsze uruchomienie na serwerze
cd /opt/securedesk
cd backend && npm ci && npm run build && npm run seed && cd ..
cd frontend && npm ci && npm run build && sudo cp -r dist/. /var/www/securedesk/ && cd ..
pm2 start pm2.config.cjs --env production && pm2 save
```

### GitHub Actions Secrets

Dodaj w repozytorium: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Wartość |
|--------|---------|
| `ORACLE_HOST` | Publiczne IP VM (np. `130.61.x.x`) |
| `ORACLE_USER` | Użytkownik SSH (`ubuntu` lub `opc` dla Oracle Linux) |
| `ORACLE_SSH_KEY` | Zawartość klucza prywatnego (`cat ~/.ssh/id_rsa`) |

### Generowanie klucza SSH dla GitHub Actions

```bash
# Na lokalnym komputerze — wygeneruj dedykowany klucz dla CI
ssh-keygen -t ed25519 -C "github-actions-securedesk" -f ~/.ssh/securedesk_deploy

# Klucz publiczny → dodaj na serwerze Oracle
cat ~/.ssh/securedesk_deploy.pub
# Wklej do: /home/ubuntu/.ssh/authorized_keys na VM

# Klucz prywatny → dodaj jako GitHub Secret ORACLE_SSH_KEY
cat ~/.ssh/securedesk_deploy
```

### Oracle Cloud — wymagane porty (Security List / NSG)

W konsoli OCI (Networking → Virtual Cloud Networks → Security Lists) otwórz ingress:

| Port | Protokół | Opis |
|------|---------|------|
| 22 | TCP | SSH (GitHub Actions + Twój dostęp) |
| 80 | TCP | HTTP (nginx) |
| 443 | TCP | HTTPS (po konfiguracji certbota) |

### HTTPS z Let's Encrypt (opcjonalnie)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d securedesk.example.com
# Certbot automatycznie zaktualizuje nginx.conf i doda redirect HTTP→HTTPS
```

---

## Znane ograniczenia i co można poprawić w produkcji

### Bezpieczeństwo

| #   | Punkt                                                                                                                                                                                                                                              | Status                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | **Sekrety JWT w kodzie** — placeholdery zastąpione silnymi losowymi sekretami w `.env` (openssl rand -hex 64). `.env.example` zaktualizowany.                                                                                                      | ✅ Zaimplementowane             |
| 2   | **Brak HTTPS** — httpOnly cookie bez flagi `Secure: true` może być przechwycone przez MITM. Produkcja: TLS wszędzie + `secure: true` w opcjach cookie.                                                                                             | ⚙️ Infrastruktura (nginx/Caddy) |
| 3   | **Brak limitowania per użytkownik** — `userApiRateLimiter` kluczowany po `userId` (po uwierzytelnieniu) jako drugi rate limiter obok globalnego IP-based.                                                                                          | ✅ Zaimplementowane             |
| 4   | **Token rotation / reuse detection** — rotacja przy każdym odświeżeniu (stary token usuwany). Detekcja reuse: gdy skradziony token zostaje użyty po rotacji, serwer usuwa **wszystkie** sesje użytkownika i loguje `REFRESH_TOKEN_REUSE_DETECTED`. | ✅ Zaimplementowane             |
| 5   | **Brak CSRF protection** — double-submit cookie pattern: login zwraca `csrfToken` (non-httpOnly cookie + ciało odpowiedzi). Middleware `validateCsrf` weryfikuje nagłówek `X-CSRF-Token` na `POST /auth/refresh` i `POST /auth/logout`.            | ✅ Zaimplementowane             |

### Architektura

| #   | Punkt                                                                                                                                             | Status                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 6   | **SQLite** — nie nadaje się do środowisk z wieloma instanceami. Produkcja: PostgreSQL lub MySQL z connection poolingiem.                          | ⚙️ Infrastruktura       |
| 7   | **Brak migracji** — schemat tworzony raz w `database.ts`. Produkcja: narzędzie migracji (Drizzle Migrate, Prisma Migrate, Flyway).                | ⚙️ Narzędzie zewnętrzne |
| 8   | **Testy E2E** — testy jednostkowe pokrywają JWT, auth, RBAC ticketów i uprawnień komentarzy (`npm test`). Brak testów E2E. Produkcja: Playwright. | ⚙️ Osobny task          |
| 9   | **Brak paginacji po stronie serwera** — `LIMIT/OFFSET` w SQL, parametry `page` i `limit` w query params, odpowiedź zawiera `total`, `totalPages`. | ✅ Zaimplementowane     |
| 10  | **Brak refresh token rotation** — rotacja tokenu przy każdym odświeżeniu + detekcja ponownego użycia (patrz pkt 4).                               | ✅ Zaimplementowane     |

### Frontend

| #   | Punkt                                                                                                                                                                                | Status              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 11  | **Brak persystencji sesji** — przy ładowaniu aplikacji (`App.tsx`) wysyłany jest `POST /api/auth/refresh`. Jeśli cookie istnieje, sesja zostaje przywrócona bez ponownego logowania. | ✅ Zaimplementowane |
| 12  | **Brak obsługi wygaśnięcia sesji podczas używania** — interceptor Axios obsługuje 401, wyświetla toast (sonner) „Sesja wygasła. Zaloguj się ponownie." i przekierowuje na `/login`.  | ✅ Zaimplementowane |

---

## TODO / Roadmap

### Bezpieczeństwo

- [x] CAPTCHA po X nieudanych próbach logowania _(matematyczne CAPTCHA zaimplementowane; dla produkcji: hCaptcha / reCAPTCHA v3 / Cloudflare Turnstile)_
- [ ] 2FA / TOTP (Google Authenticator)
- [ ] OAuth2 / SSO (Google / Microsoft)
- [x] Automatyczne wygasanie sesji po bezczynności _(5 min, hook useIdleTimer + licznik MM:SS w Navbar)_
- [ ] Skanowanie zależności (`npm audit` w CI)

### Monitoring

- [ ] Sentry (błędy frontend + backend)

### Testy

- [x] Testy jednostkowe (Jest) — pokrycie JWT, auth, RBAC, komentarze (`npm test`)
- [ ] Testy E2E (Playwright)

### Architektura

- [ ] Migracja z SQLite na PostgreSQL
- [ ] Docker + docker-compose
- [x] CI/CD pipeline — GitHub Actions → Oracle Cloud VM (SSH + pm2 + nginx)

### Frontend

- [ ] Powiadomienia real-time (WebSockets)
- [ ] Widok Kanban ticketów
a 