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
  res.send(`
    <h1>SyncOrbisExpress está funcionando correctamente</h1>
    <p>Entorno: ${isRailway ? 'Railway' : 'Local'}</p>
    <p>Hora del servidor: ${new Date().toLocaleString()}</p>
    <p><a href="/status">Ver estado</a></p>
  `);
});

// Ruta para verificar el estado
app.get('/status', (req, res) => {
  // Verificar la conexión a la base de datos
  let dbStatus = 'No verificado';
  
  // Información de entorno para Railway
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    DB_HOST: process.env.MYSQLHOST || process.env.DB_HOST || 'no configurado',
    DB_DATABASE: process.env.MYSQLDATABASE || process.env.DB_DATABASE || 'no configurado',
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