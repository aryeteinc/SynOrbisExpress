/**
 * Authentication routes
 */
import express from 'express';
import { AuthService } from '../services/AuthService';
import { authenticateJWT, authorize } from '../middlewares/auth.middleware';
import { User, LoginRequest } from '../models/User';

const router = express.Router();

/**
 * Create router with authentication service
 * @param authService Authentication service
 * @returns Express router
 */
export default function createAuthRouter(authService: AuthService) {
  /**
   * @route POST /api/auth/register
   * @desc Register a new user
   * @access Public
   */
  router.post('/register', async (req, res) => {
    try {
      const userData: User = req.body;
      
      // Validate required fields
      if (!userData.username || !userData.email || !userData.password) {
        return res.status(400).json({ error: 'Username, email and password are required' });
      }
      
      // Only admins can create admin users
      if (userData.role === 'admin') {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          userData.role = 'user'; // Default to user role
        } else {
          try {
            const token = authHeader.split(' ')[1];
            const decoded = authService.verifyToken(token);
            
            if (decoded.role !== 'admin') {
              userData.role = 'user'; // Default to user role
            }
          } catch (error) {
            userData.role = 'user'; // Default to user role
          }
        }
      }
      
      const user = await authService.register(userData);
      res.status(201).json(user);
    } catch (error) {
      console.error(`Error registering user: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @route POST /api/auth/login
   * @desc Login a user
   * @access Public
   */
  router.post('/login', async (req, res) => {
    try {
      const { username, password }: LoginRequest = req.body;
      
      // Validate required fields
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      
      const response = await authService.login(username, password);
      res.json(response);
    } catch (error) {
      console.error(`Error logging in: ${(error as Error).message}`);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  /**
   * @route POST /api/auth/refresh
   * @desc Refresh access token
   * @access Public
   */
  router.post('/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }
      
      const response = await authService.refreshToken(refreshToken);
      res.json(response);
    } catch (error) {
      console.error(`Error refreshing token: ${(error as Error).message}`);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  });

  /**
   * @route POST /api/auth/logout
   * @desc Logout a user
   * @access Private
   */
  router.post('/logout', authenticateJWT(authService), async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }
      
      await authService.logout(refreshToken);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error(`Error logging out: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @route GET /api/auth/profile
   * @desc Get user profile
   * @access Private
   */
  router.get('/profile', authenticateJWT(authService), async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const user = await authService.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error(`Error getting profile: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @route PUT /api/auth/profile
   * @desc Update user profile
   * @access Private
   */
  router.put('/profile', authenticateJWT(authService), async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userData = req.body;
      
      // Prevent role change through profile update
      delete userData.role;
      
      const user = await authService.updateUser(userId, userData);
      res.json(user);
    } catch (error) {
      console.error(`Error updating profile: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @route POST /api/auth/change-password
   * @desc Change user password
   * @access Private
   */
  router.post('/change-password', authenticateJWT(authService), async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }
      
      await authService.changePassword(userId, currentPassword, newPassword);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error(`Error changing password: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @route GET /api/auth/users
   * @desc Get all users
   * @access Admin
   */
  router.get('/users', authenticateJWT(authService), authorize(['admin']), async (req, res) => {
    try {
      const users = await authService.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error(`Error getting users: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @route GET /api/auth/users/:id
   * @desc Get user by ID
   * @access Admin
   */
  router.get('/users/:id', authenticateJWT(authService), authorize(['admin']), async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const user = await authService.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error(`Error getting user: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @route PUT /api/auth/users/:id
   * @desc Update user
   * @access Admin
   */
  router.put('/users/:id', authenticateJWT(authService), authorize(['admin']), async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      const userData = req.body;
      const user = await authService.updateUser(userId, userData);
      res.json(user);
    } catch (error) {
      console.error(`Error updating user: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * @route DELETE /api/auth/users/:id
   * @desc Delete user
   * @access Admin
   */
  router.delete('/users/:id', authenticateJWT(authService), authorize(['admin']), async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      await authService.deleteUser(userId);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error(`Error deleting user: ${(error as Error).message}`);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  return router;
}
