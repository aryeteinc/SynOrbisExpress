// app.js - Punto de entrada para Railway
const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// Crear la aplicación Express
const app = express();
const port = process.env.PORT || 3000;

// Ruta principal
app.get('/', (req, res) => {
  res.send('SyncOrbisExpress está funcionando correctamente.');
});

// Ruta para verificar el estado
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date()
  });
});

// Ruta para ejecutar sincronización manual
app.get('/sync/:key', (req, res) => {
  const apiKey = process.env.API_KEY || 'clave_predeterminada';
  
  if (req.params.key !== apiKey) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  
  res.json({ status: 'Sincronización iniciada' });
  
  // Ejecutar sincronización en segundo plano
  exec('node scripts/sync-js.js', (error) => {
    if (error) console.error('Error en sincronización:', error);
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`SyncOrbisExpress ejecutándose en el puerto ${port}`);
});