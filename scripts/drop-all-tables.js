/**
 * Script para eliminar todas las tablas sin recrearlas
 * Simula un entorno de producción donde solo existe la base de datos
 */

const knex = require('knex');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
let config = {
  dbType: process.env.DB_TYPE || 'sqlite'
};

// Configurar la conexión a la base de datos según el tipo
let dbConfig;

if (config.dbType.toLowerCase() === 'mysql') {
  console.log('Configurando conexión a MySQL...');
  dbConfig = {
    client: 'mysql2',
    connection: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'root',
      database: process.env.MYSQL_DATABASE || 'inmuebles'
    },
    pool: { min: 0, max: 7 }
  };
} else {
  console.log('Configurando conexión a SQLite...');
  dbConfig = {
    client: 'sqlite3',
    connection: {
      filename: process.env.SQLITE_PATH || 'inmuebles_db.sqlite'
    },
    useNullAsDefault: true
  };
}

// Crear la conexión a la base de datos
const db = knex(dbConfig);

// Función para eliminar todas las tablas
async function dropAllTables() {
  try {
    console.log('Desactivando restricciones de clave foránea...');
    
    // Desactivar restricciones de clave foránea
    if (config.dbType === 'sqlite') {
      await db.raw('PRAGMA foreign_keys = OFF');
    } else {
      await db.raw('SET FOREIGN_KEY_CHECKS = 0');
    }
    
    console.log('Obteniendo lista de tablas...');
    
    let tables = [];
    
    // Obtener lista de tablas según el tipo de base de datos
    if (config.dbType === 'sqlite') {
      const result = await db.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      tables = result.map(row => row.name);
    } else {
      const result = await db.raw('SHOW TABLES');
      const key = Object.keys(result[0][0])[0];
      tables = result[0].map(row => row[key]);
    }
    
    console.log(`Se encontraron ${tables.length} tablas:`, tables);
    
    // Eliminar cada tabla
    for (const table of tables) {
      console.log(`Eliminando tabla: ${table}`);
      await db.schema.dropTableIfExists(table);
    }
    
    console.log('Todas las tablas han sido eliminadas.');
    
    // Reactivar restricciones de clave foránea
    if (config.dbType === 'sqlite') {
      await db.raw('PRAGMA foreign_keys = ON');
    } else {
      await db.raw('SET FOREIGN_KEY_CHECKS = 1');
    }
    
    console.log('Restricciones de clave foránea reactivadas.');
    return true;
  } catch (error) {
    console.error('Error al eliminar tablas:', error);
    return false;
  }
}

// Función principal
async function main() {
  try {
    console.log('Iniciando eliminación de todas las tablas...');
    
    const success = await dropAllTables();
    
    if (success) {
      console.log('Todas las tablas han sido eliminadas correctamente.');
    } else {
      console.error('Hubo un error al eliminar las tablas.');
    }
    
    // Cerrar la conexión a la base de datos
    await db.destroy();
    
  } catch (error) {
    console.error('Error en el script:', error);
  }
}

// Ejecutar la función principal
main();
