/**
 * User model
 */
export interface User {
  id?: number;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user' | 'guest';
  active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface UserDTO {
  id: number;
  username: string;
  email: string;
  role: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: UserDTO;
  token: string;
  refreshToken: string;
}

export interface TokenPayload {
  id: number;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}
