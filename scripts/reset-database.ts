/**
 * Script para reiniciar la base de datos
 * Este script elimina la base de datos SQLite existente y la vuelve a crear con la estructura correcta
 */
import { DatabaseConnection } from '../src/database/DatabaseConnection';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
const dbConfig = {
  type: process.env.DB_TYPE || 'sqlite',
  sqlitePath: process.env.SQLITE_PATH || './inmuebles_db.sqlite',
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'inmuebles'
  }
};

async function resetDatabase() {
  console.log('Iniciando reinicio de la base de datos...');
  
  // Si es SQLite, eliminar el archivo
  if (dbConfig.type === 'sqlite') {
    const dbPath = path.resolve(process.cwd(), dbConfig.sqlitePath);
    
    // Verificar si el archivo existe
    if (fs.existsSync(dbPath)) {
      console.log(`Eliminando base de datos SQLite existente: ${dbPath}`);
      fs.unlinkSync(dbPath);
      console.log('Base de datos eliminada correctamente');
    } else {
      console.log('No se encontró una base de datos SQLite existente');
    }
  }
  
  // Crear conexión a la base de datos
  const dbConnection = new DatabaseConnection(dbConfig);
  
  try {
    // Configurar tablas
    console.log('Creando estructura de la base de datos...');
    await dbConnection.setupTables();
    console.log('Base de datos reiniciada correctamente');
  } catch (error) {
    console.error('Error al reiniciar la base de datos:', error);
  } finally {
    // Cerrar conexión
    await dbConnection.close();
  }
}

// Ejecutar la función
resetDatabase()
  .then(() => {
    console.log('Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error en el proceso:', error);
    process.exit(1);
  });
