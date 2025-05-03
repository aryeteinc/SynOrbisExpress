/**
 * Script para verificar qué tablas tienen datos
 */

const knex = require('knex');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configurar la conexión a la base de datos
const dbConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'rootpassword',
    database: process.env.MYSQL_DATABASE || 'inmuebles'
  }
};

// Crear la conexión a la base de datos
const db = knex(dbConfig);

async function checkTables() {
  try {
    // Obtener todas las tablas de la base de datos
    const tablesResult = await db.raw(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE || 'inmuebles'}'`
    );
    
    // Extraer los nombres de las tablas
    const tables = tablesResult[0].map(row => row.TABLE_NAME);
    
    console.log('Verificando tablas con datos:');
    let tablesWithData = 0;
    
    // Verificar cada tabla
    for (const table of tables) {
      try {
        const count = await db(table).count('* as count').first();
        if (count.count > 0) {
          console.log(`- ${table}: ${count.count} filas`);
          tablesWithData++;
        }
      } catch (error) {
        console.error(`Error verificando tabla ${table}: ${error.message}`);
      }
    }
    
    if (tablesWithData === 0) {
      console.log('No se encontraron tablas con datos.');
    } else {
      console.log(`Se encontraron ${tablesWithData} tablas con datos.`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    // Cerrar la conexión
    await db.destroy();
  }
}

// Ejecutar la función
checkTables();
