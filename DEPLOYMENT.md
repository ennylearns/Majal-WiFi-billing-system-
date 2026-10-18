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

# MikroTik Router
MIKROTIK_HOST="192.168.1.1"
MIKROTIK_USERNAME="admin"
MIKROTIK_PASSWORD="your-router-password"

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

### 3. Application Deployment
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

### 4. PM2 Configuration
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

### 5. Nginx Configuration
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

### 6. SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 🔧 MikroTik Router Configuration

### 1. Enable API
```bash
/ip service enable api
/ip service set api port=8728
```

### 2. Create API User
```bash
/user add name=collospot password=secure-password group=full
```

### 3. Hotspot Setup
```bash
# Create hotspot interface
/interface bridge add name=hotspot-bridge
/ip hotspot add name=collospot interface=hotspot-bridge

# Configure hotspot
/ip hotspot profile add name=collospot-profile
/ip hotspot user profile add name=default rate-limit=1M/5M session-timeout=1h
```

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