import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import jwt from 'jsonwebtoken';

// Define custom context type for Hono with user variable
type Variables = {
  user: any;
};

const app = new Hono<{ Variables: Variables }>();

// CORS configuration for multi-tenant subdomains
app.use('*', cors({
  origin: (origin) => {
    // Allow all subdomains of localhost for local development
    if (!origin || origin.match(/^https?:\/\/[\w-]+\.localhost(:\d+)?$/)) {
      return origin || '*';
    }
    return origin;
  },
  credentials: true,
}));

// In-memory tenant database (in production, use a real database)
const tenantDatabase: Record<string, { users: string[] }> = {
  'company-a': {
    users: ['user1@example.com', 'admin@company-a.com']
  },
  'company-b': {
    users: ['user2@example.com', 'admin@company-b.com']
  },
  'company-c': {
    users: ['user3@example.com', 'admin@company-c.com']
  }
};

// Middleware to verify JWT token
const verifyToken = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // In production, verify with Cognito's public keys
    // For local development, we'll do basic JWT decode
    const decoded = jwt.decode(token) as any;
    
    if (!decoded) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    c.set('user', decoded);
    await next();
  } catch (error) {
    return c.json({ error: 'Token verification failed' }, 401);
  }
};

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Public endpoint to get tenant information
app.get('/api/tenants', (c) => {
  const tenants = Object.keys(tenantDatabase).map(id => ({
    id,
    userCount: tenantDatabase[id].users.length
  }));
  return c.json({ tenants });
});

// Public endpoint to verify tenant-user relationship
app.post('/api/verify-tenant-user', async (c) => {
  const { tenantId, email } = await c.req.json();
  
  const tenant = tenantDatabase[tenantId];
  if (!tenant) {
    return c.json({ valid: false, error: 'Tenant not found' }, 404);
  }

  const isValid = tenant.users.includes(email);
  return c.json({ valid: isValid });
});

// Protected endpoint - requires valid JWT with tenant claim
app.get('/api/user/profile', verifyToken, (c) => {
  const user = c.get('user');
  return c.json({
    email: user.email,
    tenantId: user['custom:tenant_id'],
    sub: user.sub
  });
});

// Protected tenant-specific endpoint
app.get('/api/tenant/data', verifyToken, (c) => {
  const user = c.get('user');
  const tenantId = user['custom:tenant_id'];

  if (!tenantId) {
    return c.json({ error: 'No tenant information in token' }, 403);
  }

  // Return tenant-specific data
  return c.json({
    message: `Welcome to ${tenantId}`,
    tenantId,
    data: {
      // Tenant-specific data would go here
      settings: {},
      features: []
    }
  });
});

const port = 3001;
console.log(`Backend server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});
