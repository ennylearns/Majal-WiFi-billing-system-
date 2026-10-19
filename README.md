# DenisTec - Smart WiFi Billing System

**"Connect. Pay. Browse — Seamlessly."**

This is a comprehensive WiFi billing system featuring Paystack payment integration (supporting card and bank transfer), MikroTik router control, and a modern web-based admin dashboard.

## 🌟 Features

### 🧍♂️ Customer Features
- **Captive Portal**: Custom-branded login page with mobile-first design
- **Paystack Integration**: Online payments supporting card and bank transfer channels
- **Multiple Plans**: Time-based, data-based, and subscription packages
- **Auto-Connect**: Automatic internet access after payment
- **Real-time Status**: Connection status and usage monitoring
- **Multi-language**: English and Swahili support

### 💼 Admin Features
- **Dashboard**: Real-time analytics and system monitoring
- **Multi-Router Management**: Register, monitor, test, and manage multiple MikroTik routers across physical sites
- **Plan-to-Router Binding**: Associate internet plans with designated physical routers
- **Automated Provisioning**: Generate 1-click RouterOS v7 setup scripts with API lockdown and captive portal redirects
- **WireGuard CGNAT Traversal**: Secure tunnel networking for routers on private/CGNAT networks
- **User Management**: Customer account management and activity tracking
- **Plan Management**: Create and manage internet packages per router
- **Session Control**: Monitor and terminate active user sessions across routers
- **Payment Tracking**: Complete payment history and reporting

### 🔧 Technical Features
- **Modern Stack**: React 18 + TypeScript + Node.js + PostgreSQL + Prisma ORM
- **Router Integration**: Dynamic per-router MikroTik API client instances with connection pooling
- **VPN Tunneling**: Built-in WireGuard keypair generation and peer management (`10.250.0.0/24`)
- **Security**: JWT authentication, HTTPS, rate limiting, and restricted API access
- **Scalable**: Cloud-ready with Docker support
- **Notifications**: SMS alerts via Africa's Talking
- **API-First**: RESTful API with comprehensive documentation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Customer      │    │   Admin         │
│   Portal        │    │   Dashboard     │
│   (React)       │    │   (React)       │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
            ┌─────────────────┐
            │   Backend API   │
            │   (Node.js)     │
            └────────┬────────┘
                     │
       ┌─────────────┴─────────────┐
       │                           │
┌──────────────┐         ┌───────────────────────────────┐
│  PostgreSQL  │         │   WireGuard Server (wg0)      │
│  Database    │         │      (10.250.0.1/24)          │
└──────────────┘         └───────────────┬───────────────┘
                                         │ WireGuard VPN
                        ┌────────────────┴────────────────┐
                        │                                 │
             ┌─────────────────────┐           ┌─────────────────────┐
             │  MikroTik Router A  │           │  MikroTik Router B  │
             │   (Location 1)      │           │   (Location 2)      │
             │   10.250.0.2/32     │           │   10.250.0.3/32     │
             └─────────────────────┘           └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- MikroTik router with API access
- Paystack API credentials (`PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`)
- Africa's Talking SMS API (optional)

### 1. Clone Repository
```bash
git clone <repository-url>
cd wifi-billing-system
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Access Applications
- **Customer Portal**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin
- **API Documentation**: http://localhost:5000/health

## 📱 Responsive Design

The admin dashboard is fully responsive and optimized for:
- **Mobile devices** (< 640px): Card-based layouts, touch-friendly interfaces
- **Tablets** (640px - 1024px): Adaptive grids and navigation
- **Desktop** (> 1024px): Full table views and multi-column layouts

### Mobile Features
- Collapsible sidebar navigation
- Card-based data display replacing tables
- Touch-optimized buttons and controls
- Responsive pagination and filters
- Optimized spacing and typography

## 📋 Configuration

### Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/collospot_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"

# Paystack API
PAYSTACK_SECRET_KEY="your-paystack-secret-key"
PAYSTACK_PUBLIC_KEY="your-paystack-public-key"

# Captive Portal Domain
PORTAL_DOMAIN="wifi.majal.example.com"

# WireGuard Tunnel Configuration (CGNAT Traversal)
WIREGUARD_INTERFACE="wg0"
WIREGUARD_SERVER_ENDPOINT="vpn.example.com:51820"
WIREGUARD_SERVER_PUBLIC_KEY="your-wireguard-server-public-key"
WIREGUARD_SUBNET="10.250.0.0/24"

# Legacy MikroTik Startup Seed (Optional)
# NOTE: Only used for a one-time database seed on first run if no routers exist.
# Active routers and credentials are managed directly in the Admin UI.
MIKROTIK_HOST="192.168.1.1"
MIKROTIK_USERNAME="admin"
MIKROTIK_PASSWORD="your-router-password"
MIKROTIK_PORT="8728"

# SMS (Africa's Talking)
AFRICASTALKING_USERNAME="sandbox"
AFRICASTALKING_API_KEY="your-africastalking-api-key"
```

### Default Admin Credentials
- **Email**: admin@collospot.com
- **Password**: admin123

## 💰 Payment Plans

The system comes with pre-configured plans:

| Plan | Duration | Price | Data Limit | Speed |
|------|----------|-------|------------|-------|
| Basic 1 Hour | 1 hour | KES 20 | 500MB | 5Mbps |
| Standard 6 Hours | 6 hours | KES 100 | 2GB | 10Mbps |
| Premium 24 Hours | 24 hours | KES 300 | 10GB | 20Mbps |
| Weekly Package | 7 days | KES 1,500 | 50GB | 25Mbps |
| Monthly Unlimited | 30 days | KES 5,000 | Unlimited | 50Mbps |

## 🔌 API Endpoints

### Public API (Customer Portal)
- `GET /api/public/plans` - Get available plans (supports `?routerId=<id>` filtering)
- `POST /api/public/register` - Register new user
- `POST /api/public/login` - User login
- `POST /api/public/payment` - Initialize Paystack transaction
- `POST /api/public/payment/paystack/webhook` - Paystack webhook handler
- `GET /api/public/payment/status/:id` - Check payment status
- `POST /api/public/connect` - Connect to internet

### Admin API
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/routers` - List all routers with active session metrics
- `POST /api/admin/routers` - Register a new router & provision WireGuard peer
- `PUT /api/admin/routers/:id` - Update router metadata or credentials
- `DELETE /api/admin/routers/:id` - Decommission router and release WireGuard peer
- `POST /api/admin/routers/:id/test-connection` - Test live MikroTik API reachability
- `GET /api/admin/routers/:id/provision-script` - Generate idempotent RouterOS v7 provisioning script
- `GET /api/admin/users` - Get all users
- `GET /api/admin/plans` - Manage plans (with router binding)
- `GET /api/admin/sessions` - Monitor sessions across routers
- `GET /api/admin/payments` - Payment history

## 🛠️ Development

### Database Schema
The system uses Prisma ORM with the following core models:
- **Router**: MikroTik devices, credentials, WireGuard tunnel configuration (`wgPublicKey`, `wgTunnelIp`)
- **User**: Customer and admin accounts
- **Plan**: Internet packages bound to a specific router (`routerId`)
- **Session**: Active user connections tracked per router (`routerId`)
- **Payment**: Paystack transactions
- **Voucher**: Prepaid codes (optional)

### Responsive Breakpoints
- **Mobile**: `< 640px` - Card layouts, stacked navigation
- **Small**: `sm: ≥ 640px` - Improved spacing, inline elements
- **Large**: `lg: ≥ 1024px` - Table views, sidebar navigation
- **Extra Large**: `xl: ≥ 1280px` - Multi-column layouts

### Adding New Features
1. Update Prisma schema in `backend/prisma/schema.prisma`
2. Run `npm run db:generate` and `npm run db:push`
3. Add API endpoints in `backend/src/routes/`
4. Update frontend components in `frontend/src/`
5. Ensure responsive design using Tailwind CSS breakpoints

## 🚀 Deployment

### Using Docker
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Manual Deployment
1. Set up PostgreSQL database
2. Configure environment variables
3. Build frontend: `npm run build`
4. Start backend: `npm start`
5. Serve frontend with Nginx

### Cloud Deployment (AWS/DigitalOcean)
1. Set up EC2 instance or Droplet
2. Install Node.js, PostgreSQL, Nginx
3. Configure SSL certificates
4. Set up domain and DNS
5. Configure Paystack webhook URL (`/api/public/payment/paystack/webhook`)

## 📡 MikroTik Multi-Router & WireGuard Setup

The system manages multiple MikroTik routers dynamically through the Admin UI. Each physical router connects over a dedicated WireGuard tunnel, ensuring reliable API communication even when routers are installed behind CGNAT or mobile LTE/5G connections.

### How It Works
1. **Dynamic Router Registration**: When you add a router in the Admin UI (`/admin` -> Routers), the backend generates a dedicated WireGuard keypair and allocates an internal tunnel IP (e.g. `10.250.0.2`).
2. **WireGuard CGNAT Traversal**: The router initiates a WireGuard connection to the backend server with `persistent-keepalive=25s`, bypassing firewalls and carrier-grade NAT.
3. **Automated Provisioning Script**: The Admin UI produces a ready-to-run RouterOS v7 script that configures:
   - System identity name
   - WireGuard client interface (`wg-majal`) and peer endpoint
   - Dedicated `billing-api` user and permissions
   - API service enabled and locked strictly to `10.250.0.1/32`
   - Hotspot Walled Garden for the portal domain and Paystack checkout
   - Captive portal `login.html` redirect passing `routerId` and identity parameters
4. **Per-Router Session Isolation**: User hotspot accounts are created and cleared exclusively on the router assigned to their purchased plan.

### Adding a New Router
1. Navigate to **Admin Dashboard -> Routers** and click **Add Router**.
2. Enter the friendly name, location description, and API credentials.
3. Click **Setup Script** on the router card/row and copy the generated RouterOS v7 script.
4. Open **Winbox**, connect to your MikroTik router, open **New Terminal**, and paste the script.
5. In the Admin Dashboard, click **Test Connection** to confirm connectivity.

## 📱 Mobile App (Optional)

The system is designed to support a mobile app using the same API:
- React Native or Flutter
- QR code WiFi login
- Push notifications
- Offline voucher support

## 🔒 Security Features

- **HTTPS Enforcement**: SSL/TLS encryption
- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: API request throttling
- **Input Validation**: Comprehensive data validation
- **SQL Injection Protection**: Prisma ORM safety
- **CORS Configuration**: Cross-origin request control
- **API Lockdown**: MikroTik API restricted strictly to the WireGuard server tunnel IP (`10.250.0.1/32`)

## 📊 Monitoring & Analytics

- Real-time dashboard with key metrics
- Multi-router monitoring with active session counts per device
- WireGuard peer status and handshake tracking
- User activity tracking and session expiration cleanup
- Revenue reporting and Paystack transaction logs

## 🆘 Support & Troubleshooting

### Common Issues

1. **Paystack payments failing**
   - Check Paystack API keys (`PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`)
   - Verify webhook URL (`/api/public/payment/paystack/webhook`) is registered in Paystack dashboard
   - Check backend logs for signature verification or transaction initialization errors

2. **Router connection issues / Test Connection fails**
   - **WireGuard Tunnel**: Check if WireGuard peer has an active handshake on the server (`wg show wg0`) and on the router (`/interface/wireguard/peers print`).
   - **Endpoint Reachability**: Ensure UDP port 51820 is open on the server firewall (`sudo ufw allow 51820/udp`).
   - **API Service**: Verify API service is running on the router (`/ip/service print`) and allows `10.250.0.1/32`.
   - **Credentials**: Ensure the API user username and password match the credentials entered in the Admin UI.
   - **CGNAT Keepalive**: Ensure `persistent-keepalive=25s` is set on the router WireGuard peer.

3. **Database connection errors**
   - Check PostgreSQL is running
   - Verify DATABASE_URL format
   - Ensure database exists

### Getting Help
- Check the logs in `backend/logs/`
- Review API responses for error details
- Test individual components separately

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Contact

For support or inquiries:
- **Email**: support@mwakidenice.md@gmail.com
- **Phone**: +254 798 750 585
- **Website**: https://mwakidenis.pages.dev/

---

- Empowering Kenya's digital connectivity, one WiFi connection at a time. 🇰🇪

---
Made with ❤️ by **Mwaki Denis**
