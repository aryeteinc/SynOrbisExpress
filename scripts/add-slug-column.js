/**
 * Script para añadir la columna slug a la tabla inmuebles
 * 
 * Este script añade la columna slug a la tabla inmuebles si no existe
 * y luego actualiza todos los registros con el valor correspondiente.
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

// Función para generar el slug de un inmueble
function generateSlug(codigoSincronizacion, id) {
  if (codigoSincronizacion && codigoSincronizacion.trim() !== '') {
    return `inmueble-${codigoSincronizacion}`;
  } else if (id) {
    return `ncr-${id}`;
  }
  return null;
}

// Función principal
async function main() {
  console.log('======================================================================');
  console.log('MIGRACIÓN: AÑADIR COLUMNA SLUG A LA TABLA INMUEBLES');
  console.log('======================================================================');
  
  try {
    // Verificar conexión a la base de datos
    console.log('Probando conexión a la base de datos...');
    await db.raw('SELECT 1+1 AS result');
    console.log('Conexión a la base de datos establecida correctamente.');
    
    // Verificar si la columna slug ya existe
    console.log('Verificando si la columna slug existe...');
    const hasSlugColumn = await db.schema.hasColumn('inmuebles', 'slug');
    
    if (hasSlugColumn) {
      console.log('La columna slug ya existe en la tabla inmuebles.');
    } else {
      console.log('La columna slug no existe. Añadiendo columna...');
      
      // Añadir la columna slug
      await db.schema.table('inmuebles', table => {
        table.string('slug').nullable().unique();
      });
      
      console.log('Columna slug añadida correctamente.');
    }
    
    // Actualizar los valores de slug para todos los inmuebles
    console.log('Actualizando valores de slug para todos los inmuebles...');
    
    // Obtener todos los inmuebles
    const inmuebles = await db('inmuebles').select('id', 'ref', 'codigo_sincronizacion');
    console.log(`Se encontraron ${inmuebles.length} inmuebles.`);
    
    // Contador para estadísticas
    let actualizados = 0;
    let errores = 0;
    
    // Procesar cada inmueble
    for (const inmueble of inmuebles) {
      try {
        // Generar el slug según la lógica requerida
        const slug = generateSlug(inmueble.codigo_sincronizacion, inmueble.id);
        
        // Actualizar el inmueble con el nuevo slug
        await db('inmuebles')
          .where('id', inmueble.id)
          .update({ slug });
        
        console.log(`Inmueble #${inmueble.ref}: Slug actualizado a '${slug}'`);
        actualizados++;
      } catch (error) {
        console.error(`Error al actualizar inmueble #${inmueble.ref}: ${error.message}`);
        errores++;
      }
    }
    
    // Mostrar resultados
    console.log('\nRESULTADOS DE LA MIGRACIÓN');
    console.log('======================================================================');
    console.log(`Total inmuebles procesados: ${inmuebles.length}`);
    console.log(`Slugs actualizados: ${actualizados}`);
    console.log(`Errores: ${errores}`);
    
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
