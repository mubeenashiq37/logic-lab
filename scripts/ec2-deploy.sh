#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ec2-user/logic-lab"
REPO_URL="https://github.com/mubeenashiq37/logic-lab.git"
BRANCH="dev"

sudo yum update -y
sudo yum install -y git nginx postgresql15

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo yum install -y nodejs
fi

if ! command -v pnpm >/dev/null 2>&1; then
  sudo npm install -g pnpm
fi

if [ ! -d "$APP_DIR" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

cd "$APP_DIR/backend"
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm db:deploy
pnpm build

cd "$APP_DIR/frontend"
pnpm install --frozen-lockfile
pnpm build

sudo tee /etc/systemd/system/logiclab-backend.service > /dev/null <<'SERVICE'
[Unit]
Description=LogicLab backend
After=network.target

[Service]
WorkingDirectory=/home/ec2-user/logic-lab/backend
EnvironmentFile=/home/ec2-user/logic-lab/.env.production
ExecStart=/usr/bin/pnpm start:prod
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

sudo tee /etc/systemd/system/logiclab-frontend.service > /dev/null <<'SERVICE'
[Unit]
Description=LogicLab frontend
After=network.target

[Service]
WorkingDirectory=/home/ec2-user/logic-lab/frontend
EnvironmentFile=/home/ec2-user/logic-lab/.env.production
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable logiclab-backend.service logiclab-frontend.service
sudo systemctl restart logiclab-backend.service logiclab-frontend.service

sudo tee /etc/nginx/conf.d/logiclab.conf > /dev/null <<'CONF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
CONF

sudo systemctl enable nginx
sudo systemctl restart nginx

echo "Deployment script completed. Update .env.production before running this again."
