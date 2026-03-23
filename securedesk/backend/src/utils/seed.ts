import bcrypt from 'bcrypt';
import db from '../database';

const SALT_ROUNDS = 12;

interface UserRow {
  id: number;
  email: string;
}

function seedUsers(): void {
  const users = [
    { email: 'admin@securedesk.com', password: 'Admin123!', name: 'Admin User', role: 'ADMIN', department: 'IT', is_active: 1 },
    { email: 'manager.it@securedesk.com', password: 'Manager123!', name: 'IT Manager', role: 'MANAGER', department: 'IT', is_active: 1 },
    { email: 'manager.hr@securedesk.com', password: 'Manager123!', name: 'HR Manager', role: 'MANAGER', department: 'HR', is_active: 1 },
    { email: 'jan.kowalski@securedesk.com', password: 'Employee123!', name: 'Jan Kowalski', role: 'EMPLOYEE', department: 'IT', is_active: 1 },
    { email: 'anna.nowak@securedesk.com', password: 'Employee123!', name: 'Anna Nowak', role: 'EMPLOYEE', department: 'IT', is_active: 1 },
    { email: 'piotr.wisniewski@securedesk.com', password: 'Employee123!', name: 'Piotr Wiśniewski', role: 'EMPLOYEE', department: 'HR', is_active: 1 },
    { email: 'maria.wojcik@securedesk.com', password: 'Employee123!', name: 'Maria Wójcik', role: 'EMPLOYEE', department: 'HR', is_active: 1 },
    { email: 'test.inactive@securedesk.com', password: 'Employee123!', name: 'Test Inactive', role: 'EMPLOYEE', department: 'HR', is_active: 0 },
  ];

  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users (email, password_hash, name, role, department, is_active) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const user of users) {
    const hash = bcrypt.hashSync(user.password, SALT_ROUNDS);
    const info = insertUser.run(user.email, hash, user.name, user.role, user.department, user.is_active);
    if (info.changes > 0) {
      console.log(`  ✓ Created: ${user.email}`);
    } else {
      console.log(`  ℹ Exists:  ${user.email}`);
    }
  }
}

function seedTickets(): void {
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number }).count;
  if (existingCount > 0) {
    console.log(`  ℹ Tickets already exist (${existingCount}), skipping...`);
    return;
  }

  const users = db.prepare('SELECT id, email FROM users').all() as UserRow[];
  const findUser = (email: string): number => users.find((u) => u.email === email)?.id ?? 1;

  const adminId = findUser('admin@securedesk.com');
  const managerItId = findUser('manager.it@securedesk.com');
  const managerHrId = findUser('manager.hr@securedesk.com');
  const janId = findUser('jan.kowalski@securedesk.com');
  const annaId = findUser('anna.nowak@securedesk.com');
  const piotrId = findUser('piotr.wisniewski@securedesk.com');
  const mariaId = findUser('maria.wojcik@securedesk.com');

  const tickets = [
    {
      title: 'VPN nie działa po aktualizacji systemu',
      description: 'Po aktualizacji systemu operacyjnego VPN przestał działać. Błąd: "Connection to server failed". Próbowałem reinstalacji klienta – bez efektu.',
      status: 'OPEN', priority: 'HIGH', category: 'Technical Issue',
      created_by: janId, assigned_to: managerItId, department: 'IT',
    },
    {
      title: 'Prośba o dostęp do systemu HR',
      description: 'W związku z nowym projektem potrzebuję dostępu do modułu raportowania w systemie HR. Proszę o przyznanie uprawnień read-only.',
      status: 'IN_PROGRESS', priority: 'MEDIUM', category: 'Access Request',
      created_by: annaId, assigned_to: adminId, department: 'IT',
    },
    {
      title: 'Awaria drukarki w sali konferencyjnej B204',
      description: 'Drukarka HP LaserJet na 2. piętrze (sala B204) nie drukuje. Wyświetla błąd "Paper Jam" mimo że papier jest prawidłowo załadowany.',
      status: 'RESOLVED', priority: 'LOW', category: 'Hardware',
      created_by: janId, assigned_to: null, department: 'IT',
    },
    {
      title: 'Instalacja oprogramowania AutoCAD 2024',
      description: 'Proszę o instalację AutoCAD 2024 na stacji roboczej. Licencja jest dostępna w puli firmowej. Potrzebuję do nowego projektu architektonicznego.',
      status: 'CLOSED', priority: 'MEDIUM', category: 'Software',
      created_by: annaId, assigned_to: managerItId, department: 'IT',
    },
    {
      title: 'KRYTYCZNY: Serwer produkcyjny niedostępny',
      description: 'Serwer główny prod-01 jest niedostępny od 08:00. Wszystkie usługi są wstrzymane. Błąd: "Connection refused" na porcie 443. Potrzebna natychmiastowa interwencja!',
      status: 'RESOLVED', priority: 'CRITICAL', category: 'Technical Issue',
      created_by: managerItId, assigned_to: adminId, department: 'IT',
    },
    {
      title: 'Problem z logowaniem do poczty firmowej',
      description: 'Po resecie hasła przez dział IT nie mogę zalogować się do poczty Outlook. Hasło było zmienione wczoraj, ale logowanie nadal nie działa.',
      status: 'OPEN', priority: 'HIGH', category: 'Technical Issue',
      created_by: janId, assigned_to: null, department: 'IT',
    },
    {
      title: 'Aktualizacja polityki urlopowej Q2 2026',
      description: 'Proszę o aktualizację dokumentu "Polityka Urlopowa" zgodnie z nowym regulaminem pracy obowiązującym od 1 kwietnia 2026. Zmiany dotyczą urlopów na żądanie.',
      status: 'IN_PROGRESS', priority: 'MEDIUM', category: 'HR Request',
      created_by: piotrId, assigned_to: managerHrId, department: 'HR',
    },
    {
      title: 'Onboarding nowego pracownika - Tomasz Zielony',
      description: 'Proszę o przygotowanie stanowiska pracy i dostępów systemowych dla nowego pracownika Tomasza Zielonego. Start pracy: 01.04.2026, dział Marketing.',
      status: 'OPEN', priority: 'HIGH', category: 'HR Request',
      created_by: mariaId, assigned_to: null, department: 'HR',
    },
    {
      title: 'Błąd w naliczaniu nadgodzin w systemie payroll',
      description: 'System kadrowy Sage HR pokazuje błędne stawki dla pracowników z nadgodzinami. Stawka powinna wynosić 150%, a nalicza 100%. Dotyczy 12 pracowników za marzec.',
      status: 'IN_PROGRESS', priority: 'CRITICAL', category: 'Software',
      created_by: mariaId, assigned_to: adminId, department: 'HR',
    },
    {
      title: 'Zaświadczenie o zatrudnieniu dla banku',
      description: 'Potrzebuję zaświadczenia o zatrudnieniu i dochodach do banku PKO BP w związku z wnioskiem o kredyt. Termin złożenia dokumentów: piątek 28.03.2026.',
      status: 'RESOLVED', priority: 'HIGH', category: 'HR Request',
      created_by: piotrId, assigned_to: managerHrId, department: 'HR',
    },
    {
      title: 'Wymiana uszkodzonej klawiatury i myszy',
      description: 'Klawiatura Logitech - uszkodzone klawisze F5, F6 i Backspace. Mysz bezprzewodowa nie reaguje mimo wymiany baterii. Proszę o wymianę sprzętu.',
      status: 'CLOSED', priority: 'LOW', category: 'Hardware',
      created_by: annaId, assigned_to: null, department: 'IT',
    },
    {
      title: 'Konfiguracja uwierzytelniania dwuskładnikowego (2FA)',
      description: 'Proszę o pomoc w konfiguracji 2FA dla konta firmowego. Aplikacja Microsoft Authenticator jest zainstalowana, ale kod weryfikacyjny nie jest akceptowany.',
      status: 'OPEN', priority: 'MEDIUM', category: 'Access Request',
      created_by: piotrId, assigned_to: null, department: 'HR',
    },
    {
      title: 'Weryfikacja backup danych z 20.03.2026',
      description: 'Proszę o potwierdzenie, czy backup serwerów z dnia 20.03.2026 zakończył się pomyślnie. Potrzebujemy dokumentacji do audytu ISO 27001 zaplanowanego na 25.03.',
      status: 'RESOLVED', priority: 'HIGH', category: 'Technical Issue',
      created_by: managerItId, assigned_to: adminId, department: 'IT',
    },
    {
      title: 'Wolne działanie modułu raportowania ERP',
      description: 'Od tygodnia system ERP (SAP S/4HANA) działa bardzo wolno, szczególnie moduł raportowania finansowego. Generowanie raportu miesięcznego zajmuje 45 min zamiast 5.',
      status: 'IN_PROGRESS', priority: 'HIGH', category: 'Software',
      created_by: mariaId, assigned_to: managerItId, department: 'HR',
    },
    {
      title: 'Organizacja szkolenia z cyberbezpieczeństwa',
      description: 'Czy planowane jest szkolenie z cyberbezpieczeństwa dla działu HR w Q2 2026? Wiele osób w dziale klikało podejrzane linki. Potrzebne szkolenie awareness.',
      status: 'OPEN', priority: 'LOW', category: 'HR Request',
      created_by: mariaId, assigned_to: null, department: 'HR',
    },
  ];

  const insertTicket = db.prepare(
    'INSERT INTO tickets (title, description, status, priority, category, created_by, assigned_to, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const ticket of tickets) {
    insertTicket.run(
      ticket.title,
      ticket.description,
      ticket.status,
      ticket.priority,
      ticket.category,
      ticket.created_by,
      ticket.assigned_to,
      ticket.department
    );
    console.log(`  ✓ Ticket: ${ticket.title.substring(0, 50)}`);
  }
}

console.log('\n🌱 SecureDesk Seed Script');
console.log('══════════════════════════════');
console.log('\n👤 Seeding users...');
seedUsers();
console.log('\n🎫 Seeding tickets...');
seedTickets();
console.log('\n✅ Seed completed successfully!');
console.log('\nTest accounts:');
console.log('  admin@securedesk.com        / Admin123!    (ADMIN)');
console.log('  manager.it@securedesk.com   / Manager123!  (MANAGER, IT)');
console.log('  jan.kowalski@securedesk.com / Employee123! (EMPLOYEE, IT)\n');
process.exit(0);
