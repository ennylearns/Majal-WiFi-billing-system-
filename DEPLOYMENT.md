# COLLOSPOT Deployment Guide

This guide covers different deployment options for the COLLOSPOT WiFi Billing System.

## 🚀 Quick Deployment with Docker

### Prerequisites
- Docker and Docker Compose installed
- Domain name (for production)
- SSL certificates (for HTTPS)

### 1. Clone and Configure
```bash
git clone <repository-url>
cd wifi-billing-system
cp backend/.env.example backend/.env
```

### 2. Update Environment Variables
Edit `backend/.env` with your actual credentials:
```env
# Paystack API
# Obtain test or live API keys from Paystack Dashboard -> Settings -> API Keys & Webhooks
PAYSTACK_SECRET_KEY="your-paystack-secret-key"
PAYSTACK_PUBLIC_KEY="your-paystack-public-key"

# Captive Portal Domain
PORTAL_DOMAIN="wifi.majal.example.com"

# WireGuard Server Tunnel (CGNAT Traversal for Remote MikroTik Routers)
WIREGUARD_INTERFACE="wg0"
WIREGUARD_SERVER_ENDPOINT="vpn.example.com:51820"
WIREGUARD_SERVER_PUBLIC_KEY="your-wireguard-server-public-key"
WIREGUARD_SUBNET="10.250.0.0/24"

# Legacy MikroTik Startup Seed (Optional)
# NOTE: Only used for a one-time database seed on first run if no routers exist.
# Active routers and credentials are managed directly in the Admin UI (/admin -> Routers).
MIKROTIK_HOST="192.168.1.1"
MIKROTIK_USERNAME="admin"
MIKROTIK_PASSWORD="your-router-password"
MIKROTIK_PORT="8728"

# SMS Service
AFRICASTALKING_API_KEY="your-api-key"
```

### 3. Deploy
```bash
docker-compose up -d
```

### 4. Initialize Database
```bash
docker-compose exec backend npm run db:seed
```

## 🌐 Production Deployment (AWS/DigitalOcean)

### Server Requirements
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 50GB SSD
- **OS**: Ubuntu 20.04 LTS or newer

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
sudo apt install nginx -y

# Install WireGuard
sudo apt install wireguard -y

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Database Setup
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE collospot_db;
CREATE USER collospot WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE collospot_db TO collospot;
\q
```

### 3. WireGuard Server Setup (CGNAT Traversal)

WireGuard enables the backend to communicate with remote MikroTik routers over private CGNAT or mobile LTE/5G connections using an internal VPN subnet (`10.250.0.0/24`).

#### a. Enable IPv4 Forwarding
```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.d/99-wireguard.conf
```

#### b. Generate Server WireGuard Keypair
```bash
sudo mkdir -p /etc/wireguard
cd /etc/wireguard
umask 077
wg genkey | sudo tee server.key | wg pubkey | sudo tee server.pub
```

#### c. Create WireGuard Interface Configuration (`/etc/wireguard/wg0.conf`)
Create `/etc/wireguard/wg0.conf`:
```ini
[Interface]
Address = 10.250.0.1/24
ListenPort = 51820
PrivateKey = <INSERT_CONTENTS_OF_/etc/wireguard/server.key>
SaveConfig = false
```

#### d. Start and Enable WireGuard Service
```bash
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

#### e. Firewall Rule
Allow incoming WireGuard UDP traffic:
```bash
sudo ufw allow 51820/udp
sudo ufw reload
```

#### f. Note Server WireGuard Parameters for Backend `.env`
- **Server Public Key**: `sudo cat /etc/wireguard/server.pub`
- **Server Endpoint**: `<your-server-domain-or-public-ip>:51820`

When routers are added in the Admin Dashboard, the backend dynamically registers WireGuard peers into `wg0` via `wg set` commands.

### 4. Application Deployment
```bash
# Clone repository
git clone <repository-url> /var/www/collospot
cd /var/www/collospot

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with production values
npm run build
npm run db:generate
npm run db:push
npm run db:seed

# Frontend setup
cd ../frontend
npm install
npm run build
```

### 5. PM2 Configuration
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'collospot-backend',
    script: 'dist/server.js',
    cwd: '/var/www/collospot/backend',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
}
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Nginx Configuration
Create `/etc/nginx/sites-available/collospot`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/collospot/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/collospot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 🔧 MikroTik Multi-Router Provisioning & Operator Guide

The system supports managing arbitrary numbers of physical MikroTik routers (RouterOS v7) located across different branches, buildings, or ISP connections. 

### Why WireGuard CGNAT Traversal?
Physical routers deployed on subscriber premises or LTE/5G SIMs often sit behind Carrier-Grade NAT (CGNAT) without public IP addresses. When a router is created in the Admin Dashboard, the backend:
1. Automatically generates an X25519 WireGuard keypair for the router.
2. Allocates a dedicated private IP on the tunnel subnet (e.g., `10.250.0.2/24`).
3. Registers the peer with the server's `wg0` interface.
4. With `persistent-keepalive=25s`, the router initiates and maintains an outbound UDP connection back to the Majal server, keeping stateful NAT firewalls open indefinitely.

---

### Step 1: Register Router in Admin UI
1. Navigate to the **Admin Dashboard** (`https://yourdomain.com/admin`) and select **Routers** in the sidebar.
2. Click **Add Router**.
3. Fill in:
   - **Router Name**: Friendly name (e.g. `Downtown Cafe`, `Plaza Floor 2`)
   - **Location**: Physical location description
   - **Host / IP**: Leave as default allocated tunnel IP or internal hostname
   - **Port**: `8728` (RouterOS API port)
   - **API Username**: Dedicated API username (e.g. `billing-api`)
   - **API Password**: Strong unique password
4. Click **Save Router**.

---

### Step 2: Generate the Provisioning Script
1. On the Routers table, click the **Setup Script** button on the newly created router.
2. The modal generates an idempotent, customized RouterOS v7 script that configures:
   - System identity name
   - WireGuard client interface (`wg-majal`) with assigned private key and tunnel IP
   - Server peer configuration with keepalive (`25s`) and endpoint
   - API service enabled and locked strictly to `10.250.0.1/32`
   - Dedicated `billing-api` user group and user credentials
   - Hotspot walled garden entries for the portal domain and Paystack checkout
   - Captive portal `hotspot/login.html` redirect passing `?routerId=<ID>&router=$(identity)`
3. Click **Copy Script**.

---

### Step 3: Operator Guide — Pasting Script into Winbox Terminal

Follow these steps on each physical MikroTik router to apply the provisioning configuration:

1. **Connect with Winbox**:
   - Download the official MikroTik **Winbox** utility from [mikrotik.com](https://mikrotik.com/download).
   - Launch Winbox on a computer connected to the router's local network (LAN or Wi-Fi).
   - In the **Neighbors** tab, locate your router and click on its MAC Address or IP.
   - Enter your administrator credentials and click **Connect**.

2. **Open New Terminal**:
   - In the left sidebar navigation menu, click **New Terminal**.
   - A command terminal window will open inside Winbox.

3. **Paste Provisioning Script**:
   - Right-click anywhere inside the terminal window and select **Paste** (or press `Ctrl + V` / right-click menu depending on Winbox version).
   - Winbox will stream the commands line-by-line.
   - **Press Enter** on your keyboard after pasting to execute the final block.

4. **Verify Applied Configuration**:
   Run the following verification commands in the Winbox Terminal:
   ```routeros
   # Check WireGuard interface state
   /interface/wireguard print
   
   # Check tunnel IP assignment
   /ip/address print where interface="wg-majal"
   
   # Check peer connection and handshake
   /interface/wireguard/peers print
   
   # Check API service lockdown (should show address=10.250.0.1/32)
   /ip/service print where name="api"
   
   # Check API user
   /user print where name="billing-api"
   
   # Check Walled Garden domains
   /ip/hotspot/walled-garden print
   
   # Check captive portal login redirect
   /file print where name="hotspot/login.html"
   ```

5. **Test Connection in Admin UI**:
   - Return to the **Admin Dashboard** (`/admin -> Routers`).
   - Click **Test Connection** next to the router.
   - A green notification confirming successful connection to the MikroTik API will be displayed.

---

### Step 4: Bind Plans to the Router
1. Navigate to **Plans** in the Admin Dashboard.
2. When creating new packages or editing existing packages, select the appropriate router from the **Router** dropdown.
3. When customers at that physical location connect to the WiFi captive portal, the portal will automatically detect the router and display only the plans valid for that location.

## 📱 Paystack Integration Setup

### 1. Paystack Account & API Keys
1. Create or log in to your account at [Paystack Dashboard](https://dashboard.paystack.com/)
2. Navigate to **Settings → API Keys & Webhooks**
3. Retrieve your **Secret Key** (`PAYSTACK_SECRET_KEY`) and **Public Key** (`PAYSTACK_PUBLIC_KEY`)
4. Configure these values in `backend/.env`

### 2. Webhook Registration
> [!IMPORTANT]
> You must register your webhook URL in the Paystack dashboard under **Settings → API Keys & Webhooks**.
> Set the Webhook URL to: `https://yourdomain.com/api/public/payment/paystack/webhook`

- **Local/Development**: Use a tunneling tool like ngrok (`https://<subdomain>.ngrok-free.app/api/public/payment/paystack/webhook`)
- **Production**: Use your domain with HTTPS (`https://yourdomain.com/api/public/payment/paystack/webhook`)

### 3. Testing Payment Flow
```bash
# Initialize payment transaction
curl -X POST https://yourdomain.com/api/public/payment \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plan-id",
    "email": "customer@example.com",
    "phone": "+254712345678"
  }'
```

## 📊 Monitoring & Maintenance

### 1. Log Management
```bash
# View backend logs
pm2 logs collospot-backend

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. Database Backup
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U collospot -h localhost collospot_db > /backups/collospot_$DATE.sql
```

### 3. System Updates
```bash
# Update application
cd /var/www/collospot
git pull origin main
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
pm2 restart collospot-backend
```

## 🔒 Security Checklist

- [ ] SSL certificate installed and configured
- [ ] Database password is strong and unique
- [ ] JWT secret is cryptographically secure
- [ ] API keys are kept secret and not in version control
- [ ] Firewall configured (UFW recommended)
- [ ] Regular security updates scheduled
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting set up

## 🆘 Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check if backend is running: `pm2 status`
   - Check backend logs: `pm2 logs collospot-backend`
   - Verify port 5000 is not blocked

2. **Database Connection Error**
   - Check PostgreSQL status: `sudo systemctl status postgresql`
   - Verify DATABASE_URL in .env
   - Check database credentials

3. **Paystack Payments Failing**
   - Verify `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` in `backend/.env`
   - Verify webhook URL (`/api/public/payment/paystack/webhook`) is registered in Paystack dashboard
   - Review backend logs for webhook signature verification errors

4. **Router Connection Issues**
   - Test MikroTik API connectivity
   - Verify router credentials
   - Check network connectivity

### Performance Optimization

1. **Database Optimization**
   ```sql
   -- Add indexes for better performance
   CREATE INDEX idx_sessions_user_id ON sessions(user_id);
   CREATE INDEX idx_payments_status ON payments(status);
   CREATE INDEX idx_sessions_status ON sessions(status);
   ```

2. **Nginx Caching**
   ```nginx
   # Add to server block
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

3. **PM2 Cluster Mode**
   ```javascript
   // In ecosystem.config.js
   instances: 'max',
   exec_mode: 'cluster'
   ```

## 📞 Support

For deployment assistance:
- **Email**: support@collospot.com
- **Documentation**: Check README.md
- **Issues**: Create GitHub issue

---

**Happy Deploying!** 🚀