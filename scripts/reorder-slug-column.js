/**
 * Script para reordenar la columna slug en la tabla inmuebles
 * 
 * Este script modifica la estructura de la tabla inmuebles para
 * colocar la columna slug justo después de la columna codigo_sincronizacion.
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
    port: process.env.DB_PORT || 3306,  // Puerto 3306 para Docker
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',  // Contraseña para Docker
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
  console.log('REORDENANDO COLUMNA SLUG EN LA TABLA INMUEBLES');
  console.log('======================================================================');
  
  try {
    // Verificar conexión a la base de datos
    console.log('Probando conexión a la base de datos...');
    await db.raw('SELECT 1+1 AS result');
    console.log('Conexión a la base de datos establecida correctamente.');
    
    // Verificar si la columna slug existe
    console.log('Verificando si la columna slug existe...');
    const hasSlugColumn = await db.schema.hasColumn('inmuebles', 'slug');
    
    if (!hasSlugColumn) {
      console.error('La columna slug no existe en la tabla inmuebles. No se puede reordenar.');
      process.exit(1);
    }
    
    console.log('Reordenando la columna slug para que esté después de codigo_sincronizacion...');
    
    // En MySQL, para reordenar una columna, necesitamos modificar la tabla
    await db.raw(`
      ALTER TABLE inmuebles 
      MODIFY COLUMN slug VARCHAR(255) AFTER codigo_sincronizacion
    `);
    
    console.log('Columna slug reordenada correctamente.');
    
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
