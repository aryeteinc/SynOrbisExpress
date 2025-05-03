/**
 * Script para verificar la estructura de la tabla inmuebles
 */

const knex = require('knex');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos (MySQL en Docker)
const dbConfig = {
  client: process.env.DB_CLIENT || 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'inmuebles',
    charset: 'utf8mb4'
  },
  useNullAsDefault: true
};

// Crear conexión a la base de datos
const db = knex(dbConfig);

// Función principal
async function main() {
  console.log('======================================================================');
  console.log('VERIFICANDO ESTRUCTURA DE LA TABLA INMUEBLES');
  console.log('======================================================================');
  
  try {
    // Verificar conexión a la base de datos
    console.log('Probando conexión a la base de datos...');
    await db.raw('SELECT 1+1 AS result');
    console.log('Conexión a la base de datos establecida correctamente.');
    
    // Obtener la estructura de la tabla inmuebles
    console.log('Obteniendo estructura de la tabla inmuebles...');
    const columns = await db.raw('SHOW COLUMNS FROM inmuebles');
    
    console.log('\nEstructura de la tabla inmuebles:');
    console.log('----------------------------------------------------------------------');
    
    // Mostrar la estructura de cada columna
    columns[0].forEach((column, index) => {
      console.log(`${index + 1}. ${column.Field} (${column.Type})${column.Null === 'YES' ? ' NULL' : ' NOT NULL'}${column.Key ? ` [${column.Key}]` : ''}${column.Default ? ` DEFAULT '${column.Default}'` : ''}`);
    });
    
  } catch (error) {
    console.error(`Error fatal: ${error.message}`);
    process.exit(1);
  } finally {
    // Cerrar conexión a la base de datos
    await db.destroy();
  }
}

// Ejecutar la función principal
main().catch(error => {
  console.error(`Error fatal: ${error.message}`);
  process.exit(1);
});
