/**
 * Authentication service
 * Handles user authentication, token generation and validation
 */
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { Knex } from 'knex';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { User, UserDTO, LoginResponse, TokenPayload } from '../models/User';
import config from '../config/config';

export class AuthService {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Setup user tables in the database
   */
  public async setupUserTables(): Promise<void> {
    const knex = this.db.getConnection();
    
    // Create users table if it doesn't exist
    const hasUsersTable = await knex.schema.hasTable('users');
    if (!hasUsersTable) {
      console.log('Creating users table...');
      await knex.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('username', 50).notNullable().unique();
        table.string('email', 100).notNullable().unique();
        table.string('password', 100).notNullable();
        table.enum('role', ['admin', 'user', 'guest']).defaultTo('user');
        table.boolean('active').defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      });
      console.log('Users table created successfully');
      
      // Create default admin user
      await this.createDefaultAdmin();
    }
    
    // Create refresh tokens table if it doesn't exist
    const hasTokensTable = await knex.schema.hasTable('refresh_tokens');
    if (!hasTokensTable) {
      console.log('Creating refresh_tokens table...');
      await knex.schema.createTable('refresh_tokens', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.string('token', 255).notNullable().unique();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
      });
      console.log('Refresh tokens table created successfully');
    }
  }

  /**
   * Create default admin user
   */
  private async createDefaultAdmin(): Promise<void> {
    const knex = this.db.getConnection();
    
    // Check if admin user already exists
    const adminExists = await knex('users').where('username', 'admin').first();
    if (!adminExists) {
      // Generate a random password if not provided in environment variables
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      // Create admin user
      await knex('users').insert({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        active: true
      });
      
      console.log(`Default admin user created with password: ${defaultPassword}`);
      console.log('IMPORTANT: Change this password immediately in a production environment!');
    }
  }

  /**
   * Register a new user
   * @param user User data
   * @returns Created user
   */
  public async register(user: User): Promise<UserDTO> {
    const knex = this.db.getConnection();
    
    // Check if username or email already exists
    const existingUser = await knex('users')
      .where('username', user.username)
      .orWhere('email', user.email)
      .first();
    
    if (existingUser) {
      if (existingUser.username === user.username) {
        throw new Error('Username already exists');
      } else {
        throw new Error('Email already exists');
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(user.password, 10);
    
    // Create user
    const [userId] = await knex('users').insert({
      username: user.username,
      email: user.email,
      password: hashedPassword,
      role: user.role || 'user',
      active: user.active !== undefined ? user.active : true
    });
    
    // Get created user
    const createdUser = await knex('users')
      .where('id', userId)
      .first();
    
    // Return user without password
    return this.sanitizeUser(createdUser);
  }

  /**
   * Login a user
   * @param username Username
   * @param password Password
   * @returns Login response with tokens
   */
  public async login(username: string, password: string): Promise<LoginResponse> {
    const knex = this.db.getConnection();
    
    // Find user by username
    const user = await knex('users')
      .where('username', username)
      .first();
    
    if (!user) {
      throw new Error('Invalid username or password');
    }
    
    // Check if user is active
    if (!user.active) {
      throw new Error('User account is inactive');
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid username or password');
    }
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken);
    
    // Return user and tokens
    return {
      user: this.sanitizeUser(user),
      token: accessToken,
      refreshToken: refreshToken
    };
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Refresh token
   * @returns New access token
   */
  public async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const knex = this.db.getConnection();
    
    // Find refresh token in database
    const tokenRecord = await knex('refresh_tokens')
      .where('token', refreshToken)
      .where('expires_at', '>', knex.fn.now())
      .first();
    
    if (!tokenRecord) {
      throw new Error('Invalid or expired refresh token');
    }
    
    // Get user
    const user = await knex('users')
      .where('id', tokenRecord.user_id)
      .first();
    
    if (!user || !user.active) {
      throw new Error('User not found or inactive');
    }
    
    // Generate new access token
    const accessToken = this.generateAccessToken(user);
    
    return { token: accessToken };
  }

  /**
   * Logout a user by invalidating their refresh token
   * @param refreshToken Refresh token
   */
  public async logout(refreshToken: string): Promise<void> {
    const knex = this.db.getConnection();
    
    // Delete refresh token from database
    await knex('refresh_tokens')
      .where('token', refreshToken)
      .delete();
  }

  /**
   * Verify JWT token
   * @param token JWT token
   * @returns Token payload
   */
  public verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Generate access token
   * @param user User
   * @returns JWT token
   */
  private generateAccessToken(user: User): string {
    const payload: TokenPayload = {
      id: user.id!,
      username: user.username,
      role: user.role
    };
    
    // expiresIn puede ser un número (segundos) o una cadena como '1h', '7d', etc.
    const options: SignOptions = {};
    
    // Convertir el valor de expiresIn a un formato que TypeScript acepte
    // Esto es necesario porque TypeScript espera un tipo específico para expiresIn
    options.expiresIn = config.auth.jwtExpiresIn as any;
    
    return jwt.sign(payload, config.auth.jwtSecret, options);
  }

  /**
   * Generate refresh token
   * @param user User
   * @returns Refresh token
   */
  private generateRefreshToken(user: User): string {
    const payload: TokenPayload = {
      id: user.id!,
      username: user.username,
      role: user.role
    };
    
    // expiresIn puede ser un número (segundos) o una cadena como '1h', '7d', etc.
    const options: SignOptions = {};
    
    // Convertir el valor de expiresIn a un formato que TypeScript acepte
    // Esto es necesario porque TypeScript espera un tipo específico para expiresIn
    options.expiresIn = config.auth.refreshTokenExpiresIn as any;
    
    return jwt.sign(payload, config.auth.refreshTokenSecret, options);
  }

  /**
   * Store refresh token in database
   * @param userId User ID
   * @param token Refresh token
   */
  private async storeRefreshToken(userId: number, token: string): Promise<void> {
    const knex = this.db.getConnection();
    
    // Calculate expiration date
    const expiresIn = config.auth.refreshTokenExpiresIn;
    const expiresInMs = this.parseExpiresIn(expiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);
    
    // Store token
    await knex('refresh_tokens').insert({
      user_id: userId,
      token: token,
      expires_at: expiresAt
    });
  }

  /**
   * Parse expires in string to milliseconds
   * @param expiresIn Expires in string (e.g. '7d', '24h', '60m')
   * @returns Milliseconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));
    
    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      case 's':
        return value * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000; // Default to 7 days
    }
  }

  /**
   * Remove sensitive data from user object
   * @param user User
   * @returns User without sensitive data
   */
  private sanitizeUser(user: User): UserDTO {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserDTO;
  }

  /**
   * Get user by ID
   * @param id User ID
   * @returns User
   */
  public async getUserById(id: number): Promise<UserDTO | null> {
    const knex = this.db.getConnection();
    
    const user = await knex('users')
      .where('id', id)
      .first();
    
    if (!user) {
      return null;
    }
    
    return this.sanitizeUser(user);
  }

  /**
   * Get all users
   * @returns Array of users
   */
  public async getAllUsers(): Promise<UserDTO[]> {
    const knex = this.db.getConnection();
    
    const users = await knex('users').select();
    
    return users.map(user => this.sanitizeUser(user));
  }

  /**
   * Update user
   * @param id User ID
   * @param userData User data to update
   * @returns Updated user
   */
  public async updateUser(id: number, userData: Partial<User>): Promise<UserDTO> {
    const knex = this.db.getConnection();
    
    // Check if user exists
    const user = await knex('users')
      .where('id', id)
      .first();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Prepare update data
    const updateData: Partial<User> = {
      ...userData,
      updated_at: new Date()
    };
    
    // Hash password if provided
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    // Update user
    await knex('users')
      .where('id', id)
      .update(updateData);
    
    // Get updated user
    const updatedUser = await knex('users')
      .where('id', id)
      .first();
    
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Delete user
   * @param id User ID
   */
  public async deleteUser(id: number): Promise<void> {
    const knex = this.db.getConnection();
    
    // Check if user exists
    const user = await knex('users')
      .where('id', id)
      .first();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Delete user
    await knex('users')
      .where('id', id)
      .delete();
  }

  /**
   * Change user password
   * @param id User ID
   * @param currentPassword Current password
   * @param newPassword New password
   */
  public async changePassword(id: number, currentPassword: string, newPassword: string): Promise<void> {
    const knex = this.db.getConnection();
    
    // Get user
    const user = await knex('users')
      .where('id', id)
      .first();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await knex('users')
      .where('id', id)
      .update({
        password: hashedPassword,
        updated_at: new Date()
      });
  }
}
