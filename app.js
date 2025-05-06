// app.js - Punto de entrada para Railway
const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// Configuración para Railway
const isRailway = process.env.RAILWAY_STATIC_URL ? true : false;

// Crear la aplicación Express
const app = express();
const port = process.env.PORT || 3000;

// Configurar directorio de archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  // Verificar si hay un parámetro de inicialización
  const setupKey = req.query.setup;
  const apiKey = process.env.API_KEY || 'clave_predeterminada';
  
  if (setupKey && setupKey === apiKey) {
    // Ejecutar scripts de configuración
    res.send(`
      <h1>SyncOrbisExpress - Inicializando...</h1>
      <p>Ejecutando scripts de configuración...</p>
      <p>Este proceso puede tardar unos minutos. No cierres esta ventana.</p>
      <script>
        setTimeout(() => {
          window.location.href = '/status';
        }, 15000);
      </script>
    `);
    
    // Configurar variables de entorno para MySQL en Railway
    if (isRailway) {
      // Mapear variables de Railway a las que espera la aplicación
      process.env.MYSQL_HOST = process.env.MYSQLHOST || process.env.MYSQL_HOST;
      process.env.MYSQL_PORT = process.env.MYSQLPORT || process.env.MYSQL_PORT;
      process.env.MYSQL_USER = process.env.MYSQLUSER || process.env.MYSQL_USER;
      process.env.MYSQL_PASSWORD = process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD;
      process.env.MYSQL_DATABASE = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE;
      
      // Asegurar que DB_TYPE sea mysql
      process.env.DB_TYPE = 'mysql';
    }
    
    // Ejecutar scripts de configuración en segundo plano
    const setupCmd = 'node scripts/setup.js && node scripts/fix-inmuebles-table.js';
    console.log('Ejecutando:', setupCmd);
    
    exec(setupCmd, (error, stdout, stderr) => {
      if (error) {
        console.error('Error en configuración:', error);
        return;
      }
      console.log('Configuración completada:', stdout);
    });
    
    return;
  }
  
  // Mostrar página normal
  res.send(`
    <h1>SyncOrbisExpress está funcionando correctamente</h1>
    <p>Entorno: ${isRailway ? 'Railway' : 'Local'}</p>
    <p>Hora del servidor: ${new Date().toLocaleString()}</p>
    <p><a href="/status">Ver estado</a></p>
    <p><a href="/?setup=${apiKey}">Inicializar base de datos</a></p>
    <p><a href="/sync/${apiKey}">Ejecutar sincronización</a></p>
  `);
});

// Ruta para verificar el estado
app.get('/status', async (req, res) => {
  // Verificar la conexión a la base de datos
  let dbStatus = 'No verificado';
  
  // Intentar conectar a la base de datos
  if (process.env.DB_TYPE === 'mysql') {
    try {
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
      });
      
      // Verificar la conexión con una consulta simple
      const [rows] = await connection.execute('SELECT 1 as test');
      if (rows && rows.length > 0) {
        dbStatus = 'Conectado correctamente';
      }
      
      await connection.end();
    } catch (error) {
      dbStatus = `Error: ${error.message}`;
      console.error('Error al conectar a la base de datos:', error);
    }
  }
  
  // Configurar variables de entorno para MySQL en Railway
  if (isRailway) {
    // Mapear variables de Railway a las que espera la aplicación
    process.env.MYSQL_HOST = process.env.MYSQLHOST || process.env.MYSQL_HOST;
    process.env.MYSQL_PORT = process.env.MYSQLPORT || process.env.MYSQL_PORT;
    process.env.MYSQL_USER = process.env.MYSQLUSER || process.env.MYSQL_USER;
    process.env.MYSQL_PASSWORD = process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD;
    process.env.MYSQL_DATABASE = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE;
    
    // Asegurar que DB_TYPE sea mysql
    process.env.DB_TYPE = 'mysql';
  }
  
  // Información de entorno para Railway
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    DB_HOST: process.env.MYSQL_HOST || 'no configurado',
    DB_PORT: process.env.MYSQL_PORT || 'no configurado',
    DB_USER: process.env.MYSQL_USER || 'no configurado',
    DB_DATABASE: process.env.MYSQL_DATABASE || 'no configurado',
    RAILWAY: isRailway ? 'Sí' : 'No'
  };
  
  res.json({
    status: 'online',
    timestamp: new Date(),
    environment: envInfo,
    database: dbStatus
  });
});

// Ruta para ejecutar configuración inicial
app.get('/setup/:key', (req, res) => {
  const apiKey = process.env.API_KEY || 'clave_predeterminada';
  
  if (req.params.key !== apiKey) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  
  res.json({ status: 'Configuración iniciada' });
  
  // Ejecutar scripts de configuración en secuencia
  exec('node scripts/setup.js && node scripts/fix-inmuebles-table.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Error en configuración:', error);
      return;
    }
    console.log('Configuración completada:', stdout);
  });
});

// Ruta para ejecutar sincronización manual
app.get('/sync/:key', (req, res) => {
  const apiKey = process.env.API_KEY || 'clave_predeterminada';
  
  if (req.params.key !== apiKey) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  
  // Registrar inicio de sincronización
  const logDir = path.join(__dirname, 'logs');
  const logFile = path.join(logDir, `sync-${Date.now()}.log`);
  
  // Asegurarse de que el directorio de logs exista
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  res.json({ 
    status: 'Sincronización iniciada',
    logFile: logFile
  });
  
  // Ejecutar sincronización en segundo plano
  exec(`node scripts/sync-js.js > ${logFile} 2>&1`, (error) => {
    if (error) {
      console.error('Error en sincronización:', error);
      fs.appendFileSync(logFile, `\nError: ${error.message}`);
      return;
    }
    fs.appendFileSync(logFile, '\nSincronización completada con éxito');
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`SyncOrbisExpress ejecutándose en el puerto ${port}`);
  if (isRailway) {
    console.log('Entorno detectado: Railway');
    console.log('Variables de entorno MySQL:');
    console.log('- Host:', process.env.MYSQLHOST || 'no definido');
    console.log('- Puerto:', process.env.MYSQLPORT || 'no definido');
    console.log('- Base de datos:', process.env.MYSQLDATABASE || 'no definido');
  }
});