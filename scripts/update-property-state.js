/**
 * Script para actualizar el estado de un inmueble (activo/destacado/en_caliente)
 * 
 * Uso:
 * node update-property-state.js --ref=123 --destacado=true|false --activo=true|false --en-caliente=true|false
 */

const knex = require('knex');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos
const args = process.argv.slice(2);
let propertyRef = null;
let destacado = null;
let activo = null;
let enCaliente = null;

args.forEach(arg => {
  if (arg.startsWith('--ref=')) {
    propertyRef = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--destacado=')) {
    destacado = arg.split('=')[1].toLowerCase() === 'true';
  } else if (arg.startsWith('--activo=')) {
    activo = arg.split('=')[1].toLowerCase() === 'true';
  } else if (arg.startsWith('--en-caliente=')) {
    enCaliente = arg.split('=')[1].toLowerCase() === 'true';
  }
});

// Verificar argumentos
if (!propertyRef) {
  console.error('Error: Debe especificar la referencia del inmueble (--ref=123)');
  process.exit(1);
}

if (destacado === null && activo === null && enCaliente === null) {
  console.error('Error: Debe especificar al menos un estado para actualizar (--destacado=true|false, --activo=true|false o --en-caliente=true|false)');
  process.exit(1);
}

// Configurar la conexión a la base de datos
let dbConfig;

// Usar el tipo de base de datos especificado en las variables de entorno
const dbType = process.env.DB_TYPE || 'sqlite';

if (dbType.toLowerCase() === 'mysql') {
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

// Función para gestionar los estados personalizados de un inmueble
async function managePropertyStates(inmuebleRef, activo, destacado, enCaliente) {
  try {
    // Obtener los valores actuales del inmueble
    const inmueble = await db('inmuebles')
      .where('ref', inmuebleRef)
      .first();
    
    if (!inmueble) {
      console.log(`Inmueble #${inmuebleRef}: No encontrado en la base de datos`);
      return false;
    }
    
    console.log(`Inmueble #${inmuebleRef}: Valores actuales: activo=${inmueble.activo}, destacado=${inmueble.destacado}, en_caliente=${inmueble.en_caliente}`);
    
    // Actualizar el inmueble en la tabla principal
    await db('inmuebles')
      .where('ref', inmuebleRef)
      .update({
        activo: activo !== null ? activo : inmueble.activo,
        destacado: destacado !== null ? destacado : inmueble.destacado,
        en_caliente: enCaliente !== null ? enCaliente : inmueble.en_caliente,
        fecha_actualizacion: db.fn.now()
      });
    
    console.log(`Inmueble #${inmuebleRef}: Actualizado en la tabla inmuebles`);
    
    // Obtener el código de sincronización del inmueble
    const codigoSincronizacion = inmueble.codigo_sincronizacion || '';
    
    // Valores actualizados para guardar en la tabla de estados
    const nuevoActivo = activo !== null ? activo : inmueble.activo;
    const nuevoDestacado = destacado !== null ? destacado : inmueble.destacado;
    const nuevoEnCaliente = enCaliente !== null ? enCaliente : inmueble.en_caliente;
    
    // Si todos los campos tienen valores por defecto (activo=true, destacado=false, en_caliente=false),
    // eliminar el registro de inmuebles_estados si existe
    if (nuevoActivo === true && nuevoDestacado === false && nuevoEnCaliente === false) {
      const deleted = await db('inmuebles_estados')
        .where('inmueble_ref', inmuebleRef)
        .where('codigo_sincronizacion', codigoSincronizacion)
        .delete();
      
      if (deleted > 0) {
        console.log(`Inmueble #${inmuebleRef}: Eliminado de inmuebles_estados porque tiene valores por defecto`);
      }
      return true;
    }
    
    // Si alguno de los campos tiene un valor personalizado, guardar o actualizar su estado
    // Verificar si ya existe un registro para este inmueble
    const existingState = await db('inmuebles_estados')
      .where('inmueble_ref', inmuebleRef)
      .where('codigo_sincronizacion', codigoSincronizacion)
      .first();
    
    if (existingState) {
      // Actualizar el registro existente
      await db('inmuebles_estados')
        .where('id', existingState.id)
        .update({
          activo: nuevoActivo,
          destacado: nuevoDestacado,
          en_caliente: nuevoEnCaliente,
          fecha_modificacion: db.fn.now(),
          updated_at: db.fn.now()
        });
      console.log(`Inmueble #${inmuebleRef}: Estados actualizados en inmuebles_estados (activo=${nuevoActivo}, destacado=${nuevoDestacado}, en_caliente=${nuevoEnCaliente})`);
    } else {
      // Crear un nuevo registro
      await db('inmuebles_estados').insert({
        inmueble_ref: inmuebleRef,
        codigo_sincronizacion: codigoSincronizacion,
        activo: nuevoActivo,
        destacado: nuevoDestacado,
        en_caliente: nuevoEnCaliente,
        fecha_modificacion: db.fn.now(),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
      console.log(`Inmueble #${inmuebleRef}: Estados guardados en inmuebles_estados (activo=${nuevoActivo}, destacado=${nuevoDestacado}, en_caliente=${nuevoEnCaliente})`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error al gestionar estados para inmueble #${inmuebleRef}: ${error.message}`);
    return false;
  }
}

// Función principal
async function main() {
  try {
    console.log(`Actualizando inmueble #${propertyRef}...`);
    
    // Actualizar los estados del inmueble
    await managePropertyStates(propertyRef, activo, destacado, enCaliente);
    
    console.log('Actualización completada con éxito.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Ejecutar la función principal
main();
