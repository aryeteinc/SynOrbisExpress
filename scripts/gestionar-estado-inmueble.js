/**
 * Script para gestionar el estado de un inmueble (activar o desactivar)
 * 
 * Este script permite activar o desactivar un inmueble y actualiza
 * la tabla inmuebles_estado para mantener la consistencia.
 * 
 * Uso: node gestionar-estado-inmueble.js <ref_inmueble> <estado>
 * 
 * Donde:
 * - <ref_inmueble> es la referencia del inmueble
 * - <estado> es 1 (activo) o 0 (inactivo)
 * 
 * Ejemplo para activar: node gestionar-estado-inmueble.js 244 1
 * Ejemplo para desactivar: node gestionar-estado-inmueble.js 244 0
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

// Función para gestionar el estado de un inmueble
async function managePropertyActiveState(inmuebleRef, codigoSincronizacion, activo) {
  try {
    // Si el inmueble se marca como activo, eliminar su registro de inmuebles_estado
    if (activo === true || activo === 1) {
      const deleted = await db('inmuebles_estado')
        .where('inmueble_ref', inmuebleRef)
        .delete();
      
      if (deleted > 0) {
        console.log(`Inmueble #${inmuebleRef}: Eliminado de inmuebles_estado porque ahora está activo`);
      }
      return true;
    }
    
    // Si el inmueble se marca como inactivo, guardar o actualizar su estado
    // Verificar si ya existe un registro para este inmueble
    const existingState = await db('inmuebles_estado')
      .where('inmueble_ref', inmuebleRef)
      .first();
    
    if (existingState) {
      // Actualizar el registro existente
      await db('inmuebles_estado')
        .where('id', existingState.id)
        .update({
          activo: 0,
          updated_at: db.fn.now()
        });
      console.log(`Inmueble #${inmuebleRef}: Estado activo=0 actualizado en inmuebles_estado`);
    } else {
      // Crear un nuevo registro
      await db('inmuebles_estado').insert({
        inmueble_ref: inmuebleRef,
        codigo_sincronizacion: codigoSincronizacion || '',
        activo: 0,
        fecha_modificacion: db.fn.now(),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
      console.log(`Inmueble #${inmuebleRef}: Estado activo=0 guardado en inmuebles_estado`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error al gestionar estado activo para inmueble #${inmuebleRef}: ${error.message}`);
    return false;
  }
}

async function gestionarEstadoInmueble(refInmueble, estado) {
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
    
    // Convertir estado a booleano
    const nuevoEstado = estado === '1' || estado === 1 || estado === true;
    
    if (inmueble.activo === nuevoEstado) {
      console.log(`El inmueble #${refInmueble} ya está ${nuevoEstado ? 'activo' : 'inactivo'}. No es necesario hacer cambios.`);
    } else {
      // Actualizar el estado del inmueble
      await db('inmuebles')
        .where('id', inmueble.id)
        .update({
          activo: nuevoEstado,
          fecha_actualizacion: db.fn.now()
        });
      
      // Gestionar el estado en inmuebles_estado
      await managePropertyActiveState(refInmueble, inmueble.codigo_sincronizacion, nuevoEstado);
      
      console.log(`Inmueble #${refInmueble} marcado como ${nuevoEstado ? 'activo' : 'inactivo'}.`);
      
      // Registrar el cambio en el historial
      await db('historial_cambios').insert({
        inmueble_id: inmueble.id,
        campo: 'activo',
        valor_anterior: inmueble.activo ? '1' : '0',
        valor_nuevo: nuevoEstado ? '1' : '0',
        fecha_cambio: db.fn.now()
      });
      
      console.log(`Cambio registrado en el historial.`);
    }
    
    console.log(`\n¡Operación completada con éxito!`);
  } catch (error) {
    console.error(`Error al gestionar el estado del inmueble: ${error.message}`);
    process.exit(1);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Obtener los argumentos de línea de comandos
const refInmueble = process.argv[2];
const estado = process.argv[3];

if (!refInmueble || (estado !== '0' && estado !== '1')) {
  console.error('Error: Debe especificar la referencia del inmueble y el estado (0 o 1).');
  console.error('Uso: node gestionar-estado-inmueble.js <ref_inmueble> <estado>');
  console.error('Ejemplo para activar: node gestionar-estado-inmueble.js 244 1');
  console.error('Ejemplo para desactivar: node gestionar-estado-inmueble.js 244 0');
  process.exit(1);
}

// Ejecutar la función principal
gestionarEstadoInmueble(refInmueble, estado);
