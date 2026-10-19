# 🚀 COLLOSPOT Quick Start Guide

## ✅ Dependencies Installed Successfully!

All project dependencies have been installed:
- ✅ Backend: Node.js + Express + TypeScript + Prisma
- ✅ Frontend: React 18 + TypeScript + Tailwind CSS
- ✅ Root project scripts

## 🎯 Quick Test (No Database Required)

Test the frontend only:
```bash
cd frontend
npm run dev
```
Visit: http://localhost:3000

## 🗄️ Full Setup (Requires PostgreSQL)

### 1. Install PostgreSQL
- Download from: https://www.postgresql.org/download/
- Create database: `collospot_db`
- Update `backend/.env` with your database credentials

### 2. Setup Database
```bash
cd backend
npm run db:push
npm run db:seed
```
> **Note:** If `MIKROTIK_HOST` is set in your `backend/.env`, the system automatically seeds a "Default Router" in the database during startup and binds existing seed plans to it. Additional routers can be added at any time via the Admin Dashboard.

### 3. Start Both Servers
```bash
# From root directory
node start-dev.js
```

## 🌐 Access Points

- **Customer Portal**: http://localhost:3000 (shows plans filtered by connected router)
- **Admin Dashboard**: http://localhost:3000/admin (manage routers, plans, sessions, payments)
- **Backend API**: http://localhost:5000/health

## 🔑 Default Admin Login

- **Email**: admin@collospot.com
- **Password**: admin123

## 📡 Router Management

1. Log into the **Admin Dashboard** (`/admin`).
2. Navigate to **Routers** in the sidebar.
3. Click **Add Router** to register physical MikroTik devices with friendly names, locations, and API credentials.
4. Use **Test Connection** to verify API reachability.
5. Click **Setup Script** to generate and copy the automated RouterOS v7 provisioning script into your router's Winbox Terminal.
6. When creating or editing Plans under **Plans**, assign each plan to its designated router.

## 📋 Current Status

- ✅ All dependencies installed
- ✅ Environment configured
- ✅ Prisma client generated
- ⚠️ Minor TypeScript issues (non-blocking)
- ❌ Database setup required for full functionality

## 🛠️ Development Commands

```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev

# Build for production
npm run build

# Database operations
cd backend
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:seed      # Seed with sample data
```

## 🎉 Ready to Test!

The project is ready for testing. Start with the frontend-only test, then set up PostgreSQL for full functionality.