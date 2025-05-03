/**
 * Script para activar manualmente un inmueble
 * 
 * Este script marca un inmueble como activo (activo=1) y elimina su registro
 * de la tabla inmuebles_estado para que futuras sincronizaciones lo mantengan activo.
 * 
 * Uso: node activar-inmueble.js <ref_inmueble>
 * 
 * Ejemplo: node activar-inmueble.js 244
 */

require('dotenv').config();
const knex = require('knex');

// Configuración de la base de datos
const dbConfig = {
  client: process.env.DB_CLIENT || 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'syncorbis',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'inmuebles'
  }
};

// Crear conexión a la base de datos
const db = knex(dbConfig);

async function activarInmueble(refInmueble) {
  try {
    console.log(`Buscando inmueble con referencia #${refInmueble}...`);
    
    // Verificar si el inmueble existe
    const inmueble = await db('inmuebles')
      .where('ref', refInmueble)
      .first();
    
    if (!inmueble) {
      console.error(`Error: No se encontró ningún inmueble con la referencia #${refInmueble}`);
      process.exit(1);
    }
    
    console.log(`Inmueble #${refInmueble} encontrado. Estado actual: ${inmueble.activo ? 'Activo' : 'Inactivo'}`);
    
    if (inmueble.activo) {
      console.log(`El inmueble #${refInmueble} ya está activo. No es necesario hacer cambios.`);
    } else {
      // Marcar el inmueble como activo
      await db('inmuebles')
        .where('id', inmueble.id)
        .update({
          activo: true,
          fecha_actualizacion: db.fn.now()
        });
      
      // Eliminar el registro de inmuebles_estado si existe
      const deleted = await db('inmuebles_estado')
        .where('inmueble_ref', refInmueble)
        .delete();
      
      console.log(`Inmueble #${refInmueble} marcado como activo.`);
      
      if (deleted > 0) {
        console.log(`Se eliminó el registro de inmuebles_estado para que futuras sincronizaciones mantengan el inmueble activo.`);
      } else {
        console.log(`No se encontró registro en inmuebles_estado para este inmueble.`);
      }
      
      // Registrar el cambio en el historial
      await db('historial_cambios').insert({
        inmueble_id: inmueble.id,
        campo: 'activo',
        valor_anterior: '0',
        valor_nuevo: '1',
        fecha_cambio: db.fn.now()
      });
      
      console.log(`Cambio registrado en el historial.`);
    }
    
    console.log(`\n¡Operación completada con éxito!`);
  } catch (error) {
    console.error(`Error al activar el inmueble: ${error.message}`);
    process.exit(1);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Obtener la referencia del inmueble de los argumentos de línea de comandos
const refInmueble = process.argv[2];

if (!refInmueble) {
  console.error('Error: Debe especificar la referencia del inmueble.');
  console.error('Uso: node activar-inmueble.js <ref_inmueble>');
  process.exit(1);
}

// Ejecutar la función principal
activarInmueble(refInmueble);
