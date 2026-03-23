#!/usr/bin/env bash
# scripts/server-setup.sh
#
# Jednorazowy setup Oracle Cloud VM (Ubuntu 22.04 / OL9).
# Uruchom raz po pierwszym zalogowaniu na serwer.
#
# Użycie:
#   chmod +x scripts/server-setup.sh
#   sudo bash scripts/server-setup.sh
#
# Po zakończeniu:
#   1. Umieść klucz SSH GitHub Actions w ~/.ssh/authorized_keys (jeśli nie ma)
#   2. Skopiuj backend/.env na serwer do /opt/securedesk/backend/.env
#   3. Skopiuj frontend/.env.production na serwer (VITE_API_BASE_URL)
#   4. Uruchom: cd /opt/securedesk && npm run seed (tylko raz)

set -e

APP_DIR=/opt/securedesk
APP_USER=${SUDO_USER:-ubuntu}   # Oracle Linux: zmień na "opc"

echo "=== [1/8] System update ==="
apt-get update -qq && apt-get upgrade -y -qq

echo "=== [2/8] Install Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "=== [3/8] Install nginx & git ==="
apt-get install -y nginx git

echo "=== [4/8] Install pm2 ==="
npm install -g pm2
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash

echo "=== [5/8] Clone repo ==="
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# Zmień URL na swoje repozytorium
sudo -u "$APP_USER" git clone https://github.com/TWOJ_USER/TWOJE_REPO.git "$APP_DIR" || \
  echo "Repo już istnieje, pomijam clone."

echo "=== [6/8] Setup nginx ==="
cp "$APP_DIR/nginx/securedesk.conf" /etc/nginx/sites-available/securedesk
ln -sf /etc/nginx/sites-available/securedesk /etc/nginx/sites-enabled/securedesk
rm -f /etc/nginx/sites-enabled/default

mkdir -p /var/www/securedesk
chown -R "$APP_USER:$APP_USER" /var/www/securedesk

nginx -t && systemctl reload nginx
systemctl enable nginx

echo "=== [7/8] Create pm2 log dir ==="
mkdir -p /var/log/pm2
chown "$APP_USER:$APP_USER" /var/log/pm2

echo "=== [8/8] Open firewall ports ==="
# Oracle Cloud: otwórz też porty w konsoli OCI (Security List / Network Security Group)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "======================================================"
echo " Setup zakończony! Kolejne kroki:"
echo "======================================================"
echo ""
echo " 1. Skopiuj plik .env na serwer:"
echo "    scp backend/.env $APP_USER@SERWER_IP:$APP_DIR/backend/.env"
echo ""
echo " 2. Skopiuj .env.production frontendu:"
echo "    scp frontend/.env.production.example $APP_USER@SERWER_IP:$APP_DIR/frontend/.env.production"
echo "    # Edytuj VITE_API_BASE_URL na serwerze"
echo ""
echo " 3. Pierwsze uruchomienie (raz):"
echo "    cd $APP_DIR"
echo "    cd backend && npm ci && npm run build && npm run seed && cd .."
echo "    cd frontend && npm ci && npm run build && sudo cp -r dist/. /var/www/securedesk/ && cd .."
echo "    pm2 start pm2.config.cjs --env production"
echo "    pm2 save"
echo ""
echo " 4. Dodaj sekrety do GitHub Actions (Settings > Secrets):"
echo "    ORACLE_HOST  = $(curl -s ifconfig.me)"
echo "    ORACLE_USER  = $APP_USER"
echo "    ORACLE_SSH_KEY = (zawartość klucza prywatnego)"
echo ""
echo " 5. Następny git push do main → auto-deploy!"
