import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: process.env.API_URL || 'https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/',
  imagesFolder: process.env.IMAGES_FOLDER || path.join(process.cwd(), 'imagenes_inmuebles'),
  asesoresImagesFolder: process.env.ASESORES_IMAGES_FOLDER || path.join(process.cwd(), 'imagenes_asesores'),
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    sqlitePath: process.env.SQLITE_PATH || path.join(process.cwd(), 'inmuebles_db.sqlite'),
    mysql: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'root',
      database: process.env.MYSQL_DATABASE || 'inmuebles'
    }
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key-change-in-production',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',')
  },
  security: {
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10) // 100 requests per minute
    }
  }
};

export default config;
