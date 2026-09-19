import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        staff: true,
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, staffId: user.staffId },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    const safeUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      staffId: user.staffId,
      staff: user.staff
    };

    return res.json({ message: 'Login successful', user: safeUser, token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  return res.json({ message: 'Logout successful' });
};

export const me = (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json({ user: req.user });
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, phone } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trimmedName = name.trim();
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { staff: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let updatedStaff;
    if (user.staffId) {
      updatedStaff = await prisma.staff.update({
        where: { id: user.staffId },
        data: {
          name: trimmedName,
          phone: trimmedPhone,
        }
      });
    } else {
      updatedStaff = await prisma.staff.create({
        data: {
          name: trimmedName,
          phone: trimmedPhone,
          role: user.role,
          status: 'Active'
        }
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { staffId: updatedStaff.id }
      });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      staffId: updatedStaff.id,
      staff: updatedStaff
    };

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: safeUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error while updating profile' });
  }
};
