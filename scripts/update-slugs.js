/**
 * Script para actualizar el campo slug en todos los inmuebles existentes
 * 
 * Este script recorre todos los inmuebles en la base de datos y genera
 * el slug según la lógica requerida:
 * - Si tiene codigo_sincronizacion: slug = 'inmueble-' + codigo_sincronizacion
 * - Si no tiene codigo_sincronizacion: slug = 'ncr-' + id
 */

const knex = require('knex');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
const dbConfig = {
  client: process.env.DB_CLIENT || 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3307,  // Puerto 3307 para Docker
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
  console.log('ACTUALIZACIÓN DE SLUGS EN INMUEBLES EXISTENTES');
  console.log('======================================================================');
  
  try {
    // Verificar conexión a la base de datos
    console.log('Probando conexión a la base de datos...');
    await db.raw('SELECT 1+1 AS result');
    console.log('Conexión a la base de datos establecida correctamente.');
    
    // Obtener todos los inmuebles
    console.log('Obteniendo lista de inmuebles...');
    const inmuebles = await db('inmuebles').select('id', 'ref', 'codigo_sincronizacion', 'slug');
    console.log(`Se encontraron ${inmuebles.length} inmuebles.`);
    
    // Contador para estadísticas
    let actualizados = 0;
    let sinCambios = 0;
    let errores = 0;
    
    // Procesar cada inmueble
    console.log('Actualizando slugs...');
    for (const inmueble of inmuebles) {
      try {
        // Generar el slug según la lógica requerida
        const nuevoSlug = generateSlug(inmueble.codigo_sincronizacion, inmueble.id);
        
        // Si el slug actual es diferente al nuevo, actualizarlo
        if (inmueble.slug !== nuevoSlug) {
          console.log(`Inmueble #${inmueble.ref}: Actualizando slug de '${inmueble.slug || 'null'}' a '${nuevoSlug}'`);
          
          await db('inmuebles')
            .where('id', inmueble.id)
            .update({ slug: nuevoSlug });
          
          actualizados++;
        } else {
          console.log(`Inmueble #${inmueble.ref}: Slug ya está correcto (${inmueble.slug})`);
          sinCambios++;
        }
      } catch (error) {
        console.error(`Error al procesar inmueble #${inmueble.ref}: ${error.message}`);
        errores++;
      }
    }
    
    // Mostrar resultados
    console.log('\nRESULTADOS DE LA ACTUALIZACIÓN');
    console.log('======================================================================');
    console.log(`Total inmuebles procesados: ${inmuebles.length}`);
    console.log(`Slugs actualizados: ${actualizados}`);
    console.log(`Slugs sin cambios: ${sinCambios}`);
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
