import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { RouterOSAPI } from 'node-routeros';
import adminRoutes from './admin';
import wireguardService from '../services/wireguardService';

const prisma = new PrismaClient();

describe('Admin Router Endpoints - Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let customerToken: string;
  let adminUserId: string;
  let customerUserId: string;
  const originalEnv = { ...process.env };
  const JWT_SECRET = 'test_jwt_secret_for_admin_tests';

  before(async () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = JWT_SECRET;

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/admin', adminRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}/api/admin`;

    const adminUser = await prisma.user.create({
      data: {
        phone: `+254700${Math.floor(100000 + Math.random() * 900000)}`,
        role: 'ADMIN',
        isActive: true
      }
    });
    adminUserId = adminUser.id;
    adminToken = jwt.sign({ userId: adminUser.id }, JWT_SECRET);

    const customerUser = await prisma.user.create({
      data: {
        phone: `+254711${Math.floor(100000 + Math.random() * 900000)}`,
        role: 'CUSTOMER',
        isActive: true
      }
    });
    customerUserId = customerUser.id;
    customerToken = jwt.sign({ userId: customerUser.id }, JWT_SECRET);
  });

  after(async () => {
    process.env = originalEnv;
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserId, customerUserId] } }
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  // Slice 1: Authentication and GET /api/admin/routers
  test('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/routers`);
    assert.equal(res.status, 401);
  });

  test('rejects non-admin requests with 403', async () => {
    const res = await fetch(`${baseUrl}/routers`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('GET /api/admin/routers returns list of all router records', async () => {
    const routerA = await prisma.router.create({
      data: {
        name: 'Test Router 1',
        location: 'Branch A',
        host: '192.168.10.1',
        port: 8728,
        username: 'admin',
        password: 'password'
      }
    });

    try {
      const res = await fetch(`${baseUrl}/routers`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.ok(Array.isArray(json.data));
      const found = json.data.find((r: any) => r.id === routerA.id);
      assert.ok(found);
      assert.equal(found.name, 'Test Router 1');
    } finally {
      await prisma.router.delete({ where: { id: routerA.id } });
    }
  });

  // Slice 2: POST /api/admin/routers
  test('POST /api/admin/routers returns 400 when required fields are missing', async () => {
    const res = await fetch(`${baseUrl}/routers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ location: 'Missing name field' })
    });
    assert.equal(res.status, 400);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.ok(json.errors && json.errors.length > 0);
  });

  test('POST /api/admin/routers auto-generates WireGuard keys, tunnel IP, host, and credentials', async () => {
    // Track addPeer calls
    const addPeerCalls: Array<{ publicKey: string; tunnelIp: string }> = [];
    const origAddPeer = wireguardService.addPeer.bind(wireguardService);
    (wireguardService as any).addPeer = async (publicKey: string, tunnelIp: string) => {
      addPeerCalls.push({ publicKey, tunnelIp });
    };

    try {
      const res = await fetch(`${baseUrl}/routers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name: 'Branch New Router', location: 'Downtown Office' })
      });

      assert.equal(res.status, 201);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.equal(json.data.name, 'Branch New Router');
      assert.equal(json.data.location, 'Downtown Office');
      assert.equal(json.data.isActive, true);
      assert.ok(json.data.id);

      // Auto-generated WireGuard fields
      assert.ok(json.data.wgPublicKey, 'wgPublicKey should be set');
      assert.ok(json.data.wgPrivateKey, 'wgPrivateKey should be set');
      assert.ok(json.data.wgTunnelIp, 'wgTunnelIp should be set');
      assert.equal(json.data.host, json.data.wgTunnelIp, 'host should equal tunnelIp');

      // Auto-generated credentials
      assert.ok(json.data.username, 'username should be auto-generated');
      assert.ok(json.data.password, 'password should be auto-generated');

      // addPeer was called with the router's public key and tunnel IP
      assert.equal(addPeerCalls.length, 1);
      assert.equal(addPeerCalls[0].publicKey, json.data.wgPublicKey);
      assert.equal(addPeerCalls[0].tunnelIp, json.data.wgTunnelIp);

      // Clean up
      await prisma.router.delete({ where: { id: json.data.id } });
    } finally {
      (wireguardService as any).addPeer = origAddPeer;
    }
  });

  test('POST /api/admin/routers uses supplied username and password when provided', async () => {
    const origAddPeer = wireguardService.addPeer.bind(wireguardService);
    (wireguardService as any).addPeer = async () => {};

    try {
      const res = await fetch(`${baseUrl}/routers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Custom Creds Router',
          location: 'HQ',
          username: 'my_admin',
          password: 'my_secret'
        })
      });

      assert.equal(res.status, 201);
      const json = await res.json() as any;
      assert.equal(json.data.username, 'my_admin');
      assert.equal(json.data.password, 'my_secret');

      await prisma.router.delete({ where: { id: json.data.id } });
    } finally {
      (wireguardService as any).addPeer = origAddPeer;
    }
  });

  // Slice 3: PUT /api/admin/routers/:id
  test('PUT /api/admin/routers/:id returns 404 when router not found', async () => {
    const res = await fetch(`${baseUrl}/routers/non-existent-router-id`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: 'Updated Name' })
    });

    assert.equal(res.status, 404);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.equal(json.error, 'Router not found');
  });

  test('PUT /api/admin/routers/:id updates any subset of router fields and returns updated record', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Initial Name',
        location: 'Initial Loc',
        host: '10.10.10.1',
        port: 8728,
        username: 'admin',
        password: 'pass'
      }
    });

    try {
      const updates = {
        name: 'Renamed Router',
        port: 9000,
        isActive: false
      };

      const res = await fetch(`${baseUrl}/routers/${router.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(updates)
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.equal(json.data.id, router.id);
      assert.equal(json.data.name, 'Renamed Router');
      assert.equal(json.data.port, 9000);
      assert.equal(json.data.isActive, false);
      assert.equal(json.data.location, 'Initial Loc'); // Unchanged
    } finally {
      await prisma.router.delete({ where: { id: router.id } }).catch(() => {});
    }
  });

  // Slice 4: DELETE /api/admin/routers/:id
  test('DELETE /api/admin/routers/:id returns 404 when router not found', async () => {
    const res = await fetch(`${baseUrl}/routers/non-existent-router-id`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 404);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.equal(json.error, 'Router not found');
  });

  test('DELETE /api/admin/routers/:id hard-deletes the router and unregisters WireGuard peer when no active sessions reference it', async () => {
    // Track removePeer calls
    const removePeerCalls: string[] = [];
    const origRemovePeer = wireguardService.removePeer.bind(wireguardService);
    (wireguardService as any).removePeer = async (publicKey: string) => {
      removePeerCalls.push(publicKey);
    };
    const origAddPeer = wireguardService.addPeer.bind(wireguardService);
    (wireguardService as any).addPeer = async () => {};

    try {
      // Create router via API so it has WG fields
      const createRes = await fetch(`${baseUrl}/routers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: 'Deletable Router', location: 'Branch C' })
      });
      const createJson = await createRes.json() as any;
      const routerId = createJson.data.id;
      const routerPubKey = createJson.data.wgPublicKey;

      const res = await fetch(`${baseUrl}/routers/${routerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.equal(json.message, 'Router deleted successfully');

      // Confirm it is deleted from DB
      const found = await prisma.router.findUnique({ where: { id: routerId } });
      assert.equal(found, null);

      // WireGuard peer was unregistered
      assert.equal(removePeerCalls.length, 1);
      assert.equal(removePeerCalls[0], routerPubKey);
    } finally {
      (wireguardService as any).removePeer = origRemovePeer;
      (wireguardService as any).addPeer = origAddPeer;
    }
  });

  test('DELETE /api/admin/routers/:id soft-deletes the router when active sessions reference it', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Router with Active Session',
        location: 'Branch D',
        host: '10.30.40.1',
        port: 8728,
        username: 'admin',
        password: 'password',
        isActive: true
      }
    });

    // Create a plan and an active session referencing this routerId
    const plan = await prisma.plan.findFirst({ where: { isActive: true } });
    if (!plan) throw new Error('Plan not found for test');

    const session = await prisma.session.create({
      data: {
        userId: customerUserId,
        planId: plan.id,
        routerId: router.id,
        sessionToken: 'test_token_' + Date.now(),
        status: 'ACTIVE'
      }
    });

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);

      // Confirm router still exists in DB but isActive is false
      const found = await prisma.router.findUnique({ where: { id: router.id } });
      assert.ok(found);
      assert.equal(found.isActive, false);
    } finally {
      await prisma.session.delete({ where: { id: session.id } });
      await prisma.router.delete({ where: { id: router.id } });
    }
  });

  // Slice 5: POST /api/admin/routers/:id/test-connection
  test('POST /api/admin/routers/:id/test-connection returns 404 when router not found', async () => {
    const res = await fetch(`${baseUrl}/routers/non-existent-router-id/test-connection`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assert.equal(res.status, 404);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.equal(json.error, 'Router not found');
  });

  test('POST /api/admin/routers/:id/test-connection returns { success: true } on successful connection', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Reachable Router',
        location: 'HQ',
        host: '10.0.0.100',
        port: 8728,
        username: 'admin',
        password: 'password'
      }
    });

    const origConnect = RouterOSAPI.prototype.connect;
    const origClose = RouterOSAPI.prototype.close;
    let connectCalled = false;
    let closeCalled = false;

    (RouterOSAPI.prototype as any).connect = async function () {
      connectCalled = true;
      return this;
    };
    (RouterOSAPI.prototype as any).close = async function () {
      closeCalled = true;
      return this;
    };

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}/test-connection`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.equal(connectCalled, true);
      assert.equal(closeCalled, true);
    } finally {
      RouterOSAPI.prototype.connect = origConnect;
      RouterOSAPI.prototype.close = origClose;
      await prisma.router.delete({ where: { id: router.id } });
    }
  });

  test('POST /api/admin/routers/:id/test-connection returns { success: false, error: ... } on connection failure', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Unreachable Router',
        location: 'Remote Site',
        host: '10.0.0.200',
        port: 8728,
        username: 'admin',
        password: 'wrongpassword'
      }
    });

    const origConnect = RouterOSAPI.prototype.connect;
    const origClose = RouterOSAPI.prototype.close;

    (RouterOSAPI.prototype as any).connect = async function () {
      throw new Error('Connection refused / timeout');
    };
    (RouterOSAPI.prototype as any).close = async function () {
      return this;
    };

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}/test-connection`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, false);
      assert.ok(json.error && json.error.includes('Connection refused'));
    } finally {
      RouterOSAPI.prototype.connect = origConnect;
      RouterOSAPI.prototype.close = origClose;
      await prisma.router.delete({ where: { id: router.id } });
    }
  });

  // Slice 6: GET /api/admin/routers/:id/provision-script
  test('GET /api/admin/routers/:id/provision-script returns 404 when router not found', async () => {
    const res = await fetch(`${baseUrl}/routers/non-existent-id/provision-script`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 404);
    const json = await res.json() as any;
    assert.equal(json.success, false);
    assert.equal(json.error, 'Router not found');
  });

  test('GET /api/admin/routers/:id/provision-script returns generated RouterOS script', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Provisioned Router',
        location: 'West Branch',
        host: '10.250.0.8',
        port: 8728,
        username: 'router_west',
        password: 'password_west',
        wgPrivateKey: 'test_priv_key==',
        wgPublicKey: 'test_pub_key==',
        wgTunnelIp: '10.250.0.8'
      }
    });

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}/provision-script`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, true);
      assert.ok(json.data && json.data.script);
      assert.ok(json.data.script.includes('/system/identity set name="Provisioned Router"'));
      assert.ok(json.data.script.includes('10.250.0.8/24'));
      assert.ok(json.data.script.includes('router_west'));
    } finally {
      await prisma.router.delete({ where: { id: router.id } });
    }
  });

  // Slice 7: Granular test-connection diagnostics
  test('POST /api/admin/routers/:id/test-connection returns status tunnel_offline when WireGuard handshake is missing', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Offline WG Router',
        location: 'Remote',
        host: '10.250.0.15',
        port: 8728,
        username: 'admin',
        password: 'password',
        wgPublicKey: 'offline_pub_key_123'
      }
    });

    // Ensure mock handshake returns disconnected
    wireguardService.setMockHandshake('offline_pub_key_123', null);

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}/test-connection`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, false);
      assert.equal(json.status, 'tunnel_offline');
      assert.ok(json.error.includes('tunnel'));
    } finally {
      await prisma.router.delete({ where: { id: router.id } });
    }
  });

  test('POST /api/admin/routers/:id/test-connection returns status auth_failed when API reports authentication error', async () => {
    const router = await prisma.router.create({
      data: {
        name: 'Bad Auth Router',
        location: 'HQ',
        host: '10.250.0.16',
        port: 8728,
        username: 'admin',
        password: 'badpassword',
        wgPublicKey: 'bad_auth_pub_key'
      }
    });

    // Handshake is active
    wireguardService.setMockHandshake('bad_auth_pub_key', new Date());

    const origConnect = RouterOSAPI.prototype.connect;
    (RouterOSAPI.prototype as any).connect = async function () {
      throw new Error('cannot log in: invalid user name or password');
    };

    try {
      const res = await fetch(`${baseUrl}/routers/${router.id}/test-connection`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json() as any;
      assert.equal(json.success, false);
      assert.equal(json.status, 'auth_failed');
    } finally {
      RouterOSAPI.prototype.connect = origConnect;
      await prisma.router.delete({ where: { id: router.id } });
    }
  });
});


