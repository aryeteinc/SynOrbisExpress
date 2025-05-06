// railway-config.js
// Script para configurar y diagnosticar Railway

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== DIAGNÓSTICO DE RAILWAY ===');
console.log('Fecha y hora:', new Date().toISOString());
console.log('');

// Detectar entorno Railway
const isRailway = process.env.RAILWAY_STATIC_URL ? true : false;
console.log('Railway detectado:', isRailway ? 'Sí' : 'No');

// Mostrar todas las variables de entorno (sin mostrar valores sensibles)
console.log('\n=== VARIABLES DE ENTORNO ===');
const envVars = Object.keys(process.env).sort();
const railwayVars = envVars.filter(key => key.startsWith('RAILWAY_') || key.startsWith('MYSQL'));
const dbVars = envVars.filter(key => key.includes('DB_') || key.includes('MYSQL_'));
const apiVars = envVars.filter(key => key.includes('API_'));

console.log('\nVariables Railway:', railwayVars.length);
railwayVars.forEach(key => {
  const value = key.includes('PASSWORD') || key.includes('SECRET') ? '***' : process.env[key];
  console.log(`- ${key}: ${value}`);
});

console.log('\nVariables de Base de Datos:', dbVars.length);
dbVars.forEach(key => {
  const value = key.includes('PASSWORD') || key.includes('SECRET') ? '***' : process.env[key];
  console.log(`- ${key}: ${value}`);
});

console.log('\nVariables de API:', apiVars.length);
apiVars.forEach(key => {
  const value = key.includes('KEY') || key.includes('SECRET') ? '***' : process.env[key];
  console.log(`- ${key}: ${value}`);
});

// Verificar conexión a MySQL si está configurado
console.log('\n=== PRUEBA DE CONEXIÓN A MYSQL ===');
try {
  if (process.env.MYSQL_HOST) {
    const mysql = require('mysql2');
    
    const config = {
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE
    };
    
    console.log('Configuración de conexión:');
    console.log('- Host:', config.host);
    console.log('- Port:', config.port);
    console.log('- User:', config.user);
    console.log('- Database:', config.database);
    
    const connection = mysql.createConnection(config);
    
    connection.connect(function(err) {
      if (err) {
        console.error('Error al conectar a MySQL:', err.message);
        process.exit(1);
      }
      
      console.log('Conexión a MySQL exitosa!');
      
      // Probar una consulta simple
      connection.query('SELECT 1 + 1 AS result', function (error, results) {
        if (error) {
          console.error('Error al ejecutar consulta:', error.message);
        } else {
          console.log('Consulta exitosa, resultado:', results[0].result);
        }
        
        connection.end();
        
        // Si estamos en Railway, configurar variables
        if (isRailway) {
          console.log('\n=== CONFIGURACIÓN AUTOMÁTICA ===');
          console.log('Configurando variables para Railway...');
          
          // Intentar configurar variables si no están presentes
          if (!process.env.DB_TYPE) {
            console.log('Configurando DB_TYPE=mysql');
            // En Railway no podemos modificar process.env directamente,
            // pero podemos mostrar instrucciones
            console.log('IMPORTANTE: Debes configurar manualmente DB_TYPE=mysql en Railway');
          }
          
          console.log('\nInstrucciones para configurar Railway:');
          console.log('1. Ve a tu proyecto en Railway');
          console.log('2. Selecciona tu servicio de aplicación');
          console.log('3. Ve a la pestaña "Variables"');
          console.log('4. Añade las siguientes variables:');
          console.log('   DB_TYPE=mysql');
          console.log('   MYSQL_HOST=' + (process.env.MYSQL_HOST || 'tu-host-mysql'));
          console.log('   MYSQL_PORT=' + (process.env.MYSQL_PORT || '3306'));
          console.log('   MYSQL_USER=' + (process.env.MYSQL_USER || 'tu-usuario-mysql'));
          console.log('   MYSQL_PASSWORD=****');
          console.log('   MYSQL_DATABASE=' + (process.env.MYSQL_DATABASE || 'tu-base-de-datos-mysql'));
          console.log('   API_URL=https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/');
          console.log('   API_KEY=tu-clave-api');
        }
      });
    });
  } else {
    console.log('MySQL no está configurado (MYSQL_HOST no definido)');
    
    // Instrucciones para configurar
    console.log('\n=== INSTRUCCIONES DE CONFIGURACIÓN ===');
    console.log('Para configurar MySQL en Railway:');
    console.log('1. Ve a tu proyecto en Railway');
    console.log('2. Haz clic en "New" → "Database" → "MySQL"');
    console.log('3. Espera a que se aprovisione la base de datos');
    console.log('4. Ve a tu servicio de aplicación');
    console.log('5. Ve a la pestaña "Variables"');
    console.log('6. Haz clic en "Reference variables from another service"');
    console.log('7. Selecciona tu servicio MySQL');
    console.log('8. Selecciona todas las variables disponibles');
    console.log('9. Añade manualmente estas variables adicionales:');
    console.log('   DB_TYPE=mysql');
    console.log('   API_URL=https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/');
    console.log('   API_KEY=tu-clave-api');
  }
} catch (error) {
  console.error('Error al verificar MySQL:', error.message);
}

console.log('\n=== FIN DEL DIAGNÓSTICO ===');
