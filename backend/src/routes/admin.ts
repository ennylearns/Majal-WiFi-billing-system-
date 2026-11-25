import express, { Response } from 'express';
import { prisma } from '../database/db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import sessionService from '../services/sessionService';
import routerService from '../services/routerService';
import paymentService from '../services/paymentService';
import healthService from '../services/healthService';


const router = express.Router();

// Apply authentication to all admin routes
router.use(authenticateToken);
router.use(requireRole(['ADMIN', 'SUPER_ADMIN']));

// Infrastructure health check
router.get('/health', async (req: AuthRequest, res: Response) => {
  try {
    const health = await healthService.checkHealth();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({
      postgres: { status: 'error', message: error?.message || 'Database check failed' },
      bachs: { status: 'error', message: error?.message || 'Bachs check failed' },
      wireguard: { status: 'error', message: error?.message || 'WireGuard check failed' }
    });
  }
});

// Dashboard stats
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalRevenue,
      todayRevenue,
      activeSessions,
      totalSessions
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'CUSTOMER', isActive: true } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        },
        _sum: { amount: true }
      }),
      prisma.session.count({ where: { status: 'ACTIVE' } }),
      prisma.session.count()
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalRevenue: totalRevenue._sum.amount || 0,
        todayRevenue: todayRevenue._sum.amount || 0,
        activeSessions,
        totalSessions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
  }
});

// Get all users
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = search ? {
      OR: [
        { phone: { contains: search as string } },
        { email: { contains: search as string } },
        { firstName: { contains: search as string } },
        { lastName: { contains: search as string } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          sessions: {
            where: { status: 'ACTIVE' },
            take: 1
          },
          _count: {
            select: {
              sessions: true,
              payments: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    const formattedUsers = users.map(user => ({
      ...user,
      sessions: user.sessions.map(session => ({
        ...session,
        dataUsed: Number(session.dataUsed)
      }))
    }));

    res.json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Failed to get users:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

// Get user session history
router.get('/users/:id/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const sessions = await prisma.session.findMany({
      where: { userId: id },
      orderBy: { startTime: 'desc' },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
            speedLimit: true,
            dataLimit: true
          }
        },
        router: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    });

    const formattedSessions = sessions.map(session => ({
      ...session,
      dataUsed: Number(session.dataUsed)
    }));

    res.json({ success: true, data: formattedSessions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user sessions' });
  }
});

// Terminate active sessions for a user
router.post('/users/:id/terminate-sessions', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const activeSessions = await prisma.session.findMany({
      where: { userId: id, status: 'ACTIVE' }
    });

    for (const session of activeSessions) {
      try {
        await sessionService.terminateSession(session.id);
      } catch (err) {
        await prisma.session.update({
          where: { id: session.id },
          data: { status: 'TERMINATED', endTime: new Date() }
        });
      }
    }

    res.json({
      success: true,
      terminatedCount: activeSessions.length,
      message: `${activeSessions.length} active session(s) terminated successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to terminate user sessions' });
  }
});

// Toggle user active/inactive status
router.post('/users/:id/toggle-active', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive }
    });

    res.json({
      success: true,
      isActive: updatedUser.isActive,
      data: updatedUser,
      message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to toggle user status' });
  }
});

// Get user MAC bindings
router.get('/users/:id/mac-bindings', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const [sessions, payments] = await Promise.all([
      prisma.session.findMany({
        where: { userId: id, macAddress: { not: null } },
        orderBy: { startTime: 'desc' },
        select: {
          macAddress: true,
          startTime: true,
          ipAddress: true,
          routerId: true
        }
      }),
      prisma.payment.findMany({
        where: { userId: id, macAddress: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: {
          macAddress: true,
          createdAt: true
        }
      })
    ]);

    const macMap = new Map<string, { macAddress: string; lastSeen: Date; ipAddress?: string | null; routerId?: string | null }>();

    for (const s of sessions) {
      if (!s.macAddress) continue;
      const mac = s.macAddress.toLowerCase();
      if (!macMap.has(mac)) {
        macMap.set(mac, {
          macAddress: mac,
          lastSeen: s.startTime,
          ipAddress: s.ipAddress,
          routerId: s.routerId
        });
      } else {
        const existing = macMap.get(mac)!;
        if (s.startTime > existing.lastSeen) {
          existing.lastSeen = s.startTime;
        }
      }
    }

    for (const p of payments) {
      if (!p.macAddress) continue;
      const mac = p.macAddress.toLowerCase();
      if (!macMap.has(mac)) {
        macMap.set(mac, {
          macAddress: mac,
          lastSeen: p.createdAt
        });
      } else {
        const existing = macMap.get(mac)!;
        if (p.createdAt > existing.lastSeen) {
          existing.lastSeen = p.createdAt;
        }
      }
    }

    const bindings = Array.from(macMap.values());
    res.json({ success: true, data: bindings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user MAC bindings' });
  }
});

// Get all plans
router.get('/plans', async (req: AuthRequest, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        router: {
          select: {
            id: true,
            name: true,
            location: true
          }
        },
        _count: {
          select: {
            sessions: true,
            payments: true
          }
        }
      }
    });

    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get plans' });
  }
});

// Create plan
router.post('/plans', [
  body('name').notEmpty().withMessage('Plan name required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('duration').isInt({ min: 1 }).withMessage('Valid duration required'),
  body('dataLimit').notEmpty().withMessage('Data limit required'),
  body('speedLimit').notEmpty().withMessage('Speed limit required'),
  body('routerId').notEmpty().withMessage('Router ID required')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, description, price, duration, dataLimit, speedLimit, routerId } = req.body;

    const router = await prisma.router.findUnique({
      where: { id: routerId }
    });

    if (!router) {
      return res.status(400).json({ success: false, error: 'Router not found' });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        price,
        duration,
        dataLimit,
        speedLimit,
        routerId
      }
    });

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create plan' });
  }
});

// Update plan
router.put('/plans/:id', [
  body('name').optional().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('duration').optional().isInt({ min: 1 }),
  body('routerId').optional().notEmpty().withMessage('Router ID cannot be empty')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    const existingPlan = await prisma.plan.findUnique({
      where: { id }
    });

    if (!existingPlan) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    if (updates.routerId !== undefined) {
      const router = await prisma.router.findUnique({
        where: { id: updates.routerId }
      });

      if (!router) {
        return res.status(400).json({ success: false, error: 'Router not found' });
      }
    }

    const plan = await prisma.plan.update({
      where: { id },
      data: updates
    });

    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update plan' });
  }
});

// Delete plan
router.delete('/plans/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.plan.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ success: true, message: 'Plan deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete plan' });
  }
});

// Get all sessions
router.get('/sessions', async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = status ? { status: status as any } : {};

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { startTime: 'desc' },
        include: {
          user: {
            select: {
              phone: true,
              firstName: true,
              lastName: true
            }
          },
          plan: {
            select: {
              name: true,
              price: true
            }
          }
        }
      }),
      prisma.session.count({ where })
    ]);

    const formattedSessions = sessions.map(session => ({
      ...session,
      dataUsed: Number(session.dataUsed)
    }));

    res.json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Failed to get sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to get sessions' });
  }
});

// Terminate session
router.post('/sessions/:id/terminate', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await sessionService.terminateSession(id);

    res.json({ success: true, message: 'Session terminated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to terminate session' });
  }
});

// Get payments
router.get('/payments', async (req: AuthRequest, res: Response) => {
  try {
    const result = await paymentService.listPayments(req.query as any);

    res.json({
      success: true,
      data: result,
      totals: result.totals
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get payments' });
  }
});

// Get active users on a specific router
router.get('/routers/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    try {
      const data = await routerService.getRouterStatus(id);
      res.json({
        success: true,
        data,
      });
    } catch (err: any) {
      if (err.message && err.message.startsWith('Router not found')) {
        return res.status(404).json({ success: false, error: 'Router not found' });
      }
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get router status' });
  }
});

// Get all routers
router.get('/routers', async (req: AuthRequest, res: Response) => {
  try {
    const routers = await routerService.listRouters();
    res.json({ success: true, data: routers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get routers' });
  }
});

// Get single router
router.get('/routers/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const routerRecord = await routerService.getRouterById(id);
    if (!routerRecord) {
      return res.status(404).json({ success: false, error: 'Router not found' });
    }
    res.json({ success: true, data: routerRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get router' });
  }
});

// Create router
router.post('/routers', [
  body('name').notEmpty().withMessage('Router name is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Port must be a valid integer between 1 and 65535')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, location, port, username, password, host } = req.body;

    const routerRecord = await routerService.createRouter({
      name,
      location,
      port,
      username,
      password,
      host
    });

    res.status(201).json({ success: true, data: routerRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create router' });
  }
});

// Update router
router.put('/routers/:id', [
  body('name').optional().notEmpty().withMessage('Router name cannot be empty'),
  body('location').optional().notEmpty().withMessage('Location cannot be empty'),
  body('host').optional().notEmpty().withMessage('Host cannot be empty'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Port must be a valid integer between 1 and 65535'),
  body('username').optional().notEmpty().withMessage('Username cannot be empty'),
  body('password').optional().notEmpty().withMessage('Password cannot be empty'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { name, location, host, port, username, password, isActive } = req.body;

    try {
      const updatedRouter = await routerService.updateRouter(id, {
        name,
        location,
        host,
        port,
        username,
        password,
        isActive
      });

      res.json({ success: true, data: updatedRouter });
    } catch (err: any) {
      if (err.message === 'Router not found') {
        return res.status(404).json({ success: false, error: 'Router not found' });
      }
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update router' });
  }
});

// Delete router
router.delete('/routers/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    try {
      const result = await routerService.deleteRouter(id);

      if (result.outcome === 'deactivated') {
        return res.json({
          success: true,
          message: 'Router deactivated successfully',
          data: result.router,
        });
      }

      return res.json({ success: true, message: 'Router deleted successfully' });
    } catch (err: any) {
      if (err.message && err.message.startsWith('Router not found:')) {
        return res.status(404).json({ success: false, error: 'Router not found' });
      }
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete router' });
  }
});

// Get RouterOS provisioning script
router.get('/routers/:id/provision-script', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    let script: string;
    try {
      script = await routerService.generateProvisioningScript(id);
    } catch (err: any) {
      if (err.message && err.message.startsWith('Router not found')) {
        return res.status(404).json({ success: false, error: 'Router not found' });
      }
      throw err;
    }

    if (req.headers.accept === 'text/plain' || req.query.format === 'text') {
      return res.type('text/plain').send(script);
    }

    res.json({
      success: true,
      data: {
        script
      },
      script
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate provisioning script' });
  }
});


// Test router connection with granular diagnostics
router.post('/routers/:id/test-connection', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    try {
      const result = await routerService.testConnection(id);
      res.json(result);
    } catch (err: any) {
      if (err.message && err.message.startsWith('Router not found')) {
        return res.status(404).json({ success: false, error: 'Router not found' });
      }
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to test router connection' });
  }
});

export default router;