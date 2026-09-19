import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { staff: true }
    });

    if (!user) {
      res.clearCookie('token');
      return res.status(401).json({ error: 'User is inactive or deleted' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      staffId: user.staffId,
      staff: user.staff
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.clearCookie('token');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

export const DEFAULT_ROLE_MODULES: Record<string, string[]> = {
  'Head Doctor': [
    'Dashboard', 'Reception Desk', 'Partial Payments', 'Patients', 'Appointments',
    'Queue', 'Doctor Workspace', 'Prescriptions', 'Inventory', 'Dispensing',
    'Billing', 'Payments', 'Staff Management', 'Settings', 'Reports', 'Reimbursement'
  ],
  'Duty Doctor': ['Dashboard', 'Patients', 'Queue', 'Doctor Workspace', 'Prescriptions', 'Reimbursement'],
  'Receptionist': [
    'Dashboard', 'Reception Desk', 'Partial Payments', 'Patients', 'Appointments',
    'Queue', 'Dispensing', 'Billing', 'Payments'
  ]
};

export function getUserPermissions(user: any): string[] {
  if (!user) return [];
  const roleDefault = DEFAULT_ROLE_MODULES[user.role] || [];
  
  const staffPermissions = user.staff?.permissions;
  if (staffPermissions !== null && staffPermissions !== undefined && Array.isArray(staffPermissions)) {
    const customList = staffPermissions as string[];
    const set = new Set(customList);

    // Invariant: Reports is strictly Head Doctor only
    if (user.role !== 'Head Doctor') {
      set.delete('Reports');
    }

    // Sub-modules linked to visible sidebar menu modules
    if (set.has('Queue')) {
      set.add('Doctor Workspace');
      set.add('Prescriptions');
    }
    if (set.has('Reception Desk')) {
      ['Appointments', 'Billing', 'Payments', 'Dispensing'].forEach(sub => {
        set.add(sub);
      });
    }

    if (user.role === 'Head Doctor') {
      set.add('Staff Management');
      set.add('Dashboard');
    }
    return Array.from(set);
  }

  return roleDefault;
}

export const requireModule = (moduleName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permissions = getUserPermissions(req.user);
    if (!permissions.includes(moduleName)) {
      return res.status(403).json({ error: `Forbidden: Access to module '${moduleName}' is denied` });
    }

    next();
  };
};
