/**
 * Main application file
 * Express.js application for synchronizing property data from an API to a database
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { DatabaseConnection } from './database/DatabaseConnection';
import { AuthService } from './services/AuthService';
import config from './config/config';
import createAuthRouter from './routes/auth.routes';

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
const port = config.port;

// Configure security middleware
app.use(helmet());

// Configure CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // En desarrollo, permitir todas las solicitudes
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Check if the origin is allowed
    if (config.auth.allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With', 'Accept']
}));

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Configure other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Create necessary directories
const imagesFolder = config.imagesFolder;
if (!fs.existsSync(imagesFolder)) {
  fs.mkdirSync(imagesFolder, { recursive: true });
  console.log(`Images directory created: ${imagesFolder}`);
}

// Create directory for asesores images
const asesoresImagesFolder = config.asesoresImagesFolder;
if (!fs.existsSync(asesoresImagesFolder)) {
  fs.mkdirSync(asesoresImagesFolder, { recursive: true });
  console.log(`Asesores images directory created: ${asesoresImagesFolder}`);
}

// Initialize database
const db = new DatabaseConnection({
  type: config.database.type as 'sqlite' | 'mysql',
  sqlitePath: config.database.sqlitePath,
  mysql: config.database.mysql
});

// Initialize authentication service
const authService = new AuthService(db);

// Setup database tables
(async () => {
  try {
    console.log('Creating database tables...');
    await db.setupTables();
    await db.actualizarEstructuraDB();
    
    // Setup authentication tables
    await authService.setupUserTables();
    
    console.log(`Database configured correctly. Type: ${config.database.type}`);
    await db.diagnosticarBaseDatos();
  } catch (error) {
    console.error(`Error configuring database: ${(error as Error).message}`);
    process.exit(1);
  }
})();

// Import and use routes
const authRouter = createAuthRouter(authService);
app.use('/api/auth', authRouter);

// Import routes dynamically

// Import sync routes
import('./routes/sync.routes').then(module => {
  const createSyncRouter = module.default;
  const syncRouter = createSyncRouter(db, authService);
  app.use('/api/sync', syncRouter);
  console.log('Sync routes loaded successfully');
}).catch(error => {
  console.error(`Error loading sync routes: ${error.message}`);
});

// Import inmuebles routes
import('./routes/inmuebles.routes').then(module => {
  const createInmueblesRouter = module.default;
  const inmueblesRouter = createInmueblesRouter(db, authService);
  app.use('/api/inmuebles', inmueblesRouter);
  console.log('Inmuebles routes loaded successfully');
}).catch(error => {
  console.error(`Error loading inmuebles routes: ${error.message}`);
});

// Import inmuebles características routes
import('./routes/inmuebles.caracteristicas.routes').then(module => {
  const createInmueblesCaracteristicasRouter = module.default;
  const inmueblesCaracteristicasRouter = createInmueblesCaracteristicasRouter(db, authService);
  app.use('/api/inmuebles-caracteristicas', inmueblesCaracteristicasRouter);
  console.log('Inmuebles características routes loaded successfully');
}).catch(error => {
  console.error(`Error loading inmuebles características routes: ${error.message}`);
});

// Home route
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>SyncOrbis Express API</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
          }
          .btn {
            display: inline-block;
            font-weight: 400;
            text-align: center;
            white-space: nowrap;
            vertical-align: middle;
            user-select: none;
            border: 1px solid transparent;
            padding: 0.375rem 0.75rem;
            font-size: 1rem;
            line-height: 1.5;
            border-radius: 0.25rem;
            text-decoration: none;
            transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
          }
          .btn-primary {
            color: #fff;
            background-color: #007bff;
            border-color: #007bff;
          }
          .btn-primary:hover {
            color: #fff;
            background-color: #0069d9;
            border-color: #0062cc;
          }
          h1 {
            color: #333;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
          }
          h2 {
            color: #444;
            margin-top: 30px;
          }
          code {
            background-color: #f5f5f5;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
          }
          pre {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
          .endpoint {
            margin-bottom: 20px;
            border-left: 3px solid #007bff;
            padding-left: 15px;
          }
          .method {
            font-weight: bold;
            color: #007bff;
          }
        </style>
      </head>
      <body>
        <h1>SyncOrbis Express API - Synchronization Service</h1>
        <p>Welcome to the SyncOrbis Express API. This API provides endpoints for synchronizing property data from Orbis.</p>
        
        <h2>Panel de Administración</h2>
        <p>Accede al panel de administración para gestionar sincronizaciones:</p>
        <p><a href="/admin/sync.html" class="btn btn-primary">Panel de Sincronizaciones</a></p>
        
        <h2>API Endpoints</h2>
        
        <div class="endpoint">
          <p><span class="method">POST</span> <code>/api/sync/start</code></p>
          <p>Start a manual synchronization.</p>
          <p>Requires authentication with admin role.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">GET</span> <code>/api/sync/current</code></p>
          <p>Get current synchronization status.</p>
          <p>Requires authentication with admin role.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">GET</span> <code>/api/sync/status/:id</code></p>
          <p>Get status of a specific synchronization by ID.</p>
          <p>Example: <code>/api/sync/status/123</code></p>
          <p>Requires authentication with admin role.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">POST</span> <code>/api/sync/clean</code></p>
          <p>Clean stuck synchronizations.</p>
          <p>Optional body: <code>{"sync_id": 123}</code> to clean a specific synchronization.</p>
          <p>Requires authentication with admin role.</p>
        </div>
        
        <div class="endpoint">
          <p><span class="method">GET</span> <code>/api/sync/history</code></p>
          <p>Get synchronization history (last 20 executions).</p>
          <p>Requires authentication with admin role.</p>
        </div>
        
        <h2>Authentication</h2>
        
        <div class="endpoint">
          <p><span class="method">POST</span> <code>/api/auth/login</code></p>
          <p>Login and get JWT token.</p>
          <pre>{
  "username": "admin",
  "password": "your_password"
}</pre>
        </div>
        
        <div class="endpoint">
          <p><span class="method">POST</span> <code>/api/auth/refresh</code></p>
          <p>Refresh JWT token.</p>
        </div>
      </body>
    </html>
  `);
});

// Start the server
app.listen(port, () => {
  console.log(`=`.repeat(70));
  console.log(`SyncOrbis Express API running on port ${port}`);
  console.log(`http://localhost:${port}`);
  console.log(`Node.js Version: ${process.version}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Database Type: ${config.database.type}`);
  console.log(`=`.repeat(70));
});
