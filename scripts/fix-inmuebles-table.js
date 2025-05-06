/**
 * Script para añadir las columnas faltantes a la tabla inmuebles
 * 
 * Este script añade las columnas area_construida, area_privada y area_terreno
 * a la tabla inmuebles si no existen.
 * 
 * Uso:
 * node fix-inmuebles-table.js
 */

const knex = require('knex');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración
const config = {
  dbType: process.env.DB_TYPE || 'mysql',
  mysqlHost: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  mysqlPort: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
  mysqlUser: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  mysqlDatabase: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'inmuebles',
};

// Inicializar conexión a la base de datos
let db;

if (config.dbType === 'mysql') {
  console.log('Configurando conexión a MySQL...');
  db = knex({
    client: 'mysql2',
    connection: {
      host: config.mysqlHost,
      port: config.mysqlPort,
      user: config.mysqlUser,
      password: config.mysqlPassword,
      database: config.mysqlDatabase
    },
    pool: { min: 0, max: 7 }
  });
} else {
  console.error('Este script solo funciona con MySQL');
  process.exit(1);
}

async function fixInmueblesTable() {
  console.log('Iniciando corrección de la tabla inmuebles...');
  
  try {
    // Probar la conexión a la base de datos
    try {
      await db.raw('SELECT 1');
      console.log('Conexión a la base de datos establecida correctamente.');
    } catch (dbError) {
      console.error(`Error conectando a la base de datos: ${dbError.message}`);
      process.exit(1);
    }
    
    // Verificar si la tabla inmuebles existe
    const tableExists = await db.schema.hasTable('inmuebles');
    if (!tableExists) {
      console.error('La tabla inmuebles no existe.');
      process.exit(1);
    }
    
    // Verificar si las columnas ya existen
    const hasAreaConstruida = await db.schema.hasColumn('inmuebles', 'area_construida');
    const hasAreaPrivada = await db.schema.hasColumn('inmuebles', 'area_privada');
    const hasAreaTerreno = await db.schema.hasColumn('inmuebles', 'area_terreno');
    const hasDestacado = await db.schema.hasColumn('inmuebles', 'destacado');
    
    // Añadir las columnas si no existen
    if (!hasAreaConstruida) {
      console.log('Añadiendo columna area_construida...');
      await db.schema.table('inmuebles', table => {
        table.float('area_construida').nullable();
      });
      console.log('Columna area_construida añadida correctamente.');
    } else {
      console.log('La columna area_construida ya existe.');
    }
    
    if (!hasAreaPrivada) {
      console.log('Añadiendo columna area_privada...');
      await db.schema.table('inmuebles', table => {
        table.float('area_privada').nullable();
      });
      console.log('Columna area_privada añadida correctamente.');
    } else {
      console.log('La columna area_privada ya existe.');
    }
    
    if (!hasAreaTerreno) {
      console.log('Añadiendo columna area_terreno...');
      await db.schema.table('inmuebles', table => {
        table.float('area_terreno').nullable();
      });
      console.log('Columna area_terreno añadida correctamente.');
    } else {
      console.log('La columna area_terreno ya existe.');
    }
    
    if (!hasDestacado) {
      console.log('Añadiendo columna destacado...');
      await db.schema.table('inmuebles', table => {
        table.boolean('destacado').defaultTo(false);
      });
      console.log('Columna destacado añadida correctamente.');
    } else {
      console.log('La columna destacado ya existe.');
    }
    
    console.log('Todas las columnas han sido verificadas y añadidas si eran necesarias.');
    
    // Verificar la estructura de la tabla
    console.log('Verificando estructura de la tabla inmuebles...');
    const columns = await db.raw("SHOW COLUMNS FROM inmuebles");
    const columnNames = columns[0].map(col => col.Field);
    console.log('Columnas en la tabla inmuebles:');
    console.log(columnNames.join(', '));
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Ejecutar la función principal
fixInmueblesTable()
  .then(() => {
    console.log('Proceso completado correctamente.');
    process.exit(0);
  })
  .catch(error => {
    console.error(`Error en el proceso principal: ${error.message}`);
    process.exit(1);
  });
