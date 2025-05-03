/**
 * Script para gestionar etiquetas de inmuebles
 * 
 * Uso:
 * - Añadir etiqueta a inmueble: node manage-property-tags.js --add --inmueble=123 --etiqueta=1
 * - Eliminar etiqueta de inmueble: node manage-property-tags.js --remove --inmueble=123 --etiqueta=1
 * - Listar etiquetas de inmueble: node manage-property-tags.js --list --inmueble=123
 * - Listar inmuebles con etiqueta: node manage-property-tags.js --list --etiqueta=1
 * - Crear nueva etiqueta: node manage-property-tags.js --create --nombre="Nueva etiqueta" --color="#FF5733" --descripcion="Descripción opcional"
 */

const knex = require('knex');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos
const args = process.argv.slice(2);
let action = null;
let inmuebleId = null;
let etiquetaId = null;
let etiquetaNombre = null;
let etiquetaColor = null;
let etiquetaDescripcion = null;

args.forEach(arg => {
  if (arg === '--add') action = 'add';
  else if (arg === '--remove') action = 'remove';
  else if (arg === '--list') action = 'list';
  else if (arg === '--create') action = 'create';
  else if (arg.startsWith('--inmueble=')) inmuebleId = parseInt(arg.split('=')[1], 10);
  else if (arg.startsWith('--etiqueta=')) {
    const valor = arg.split('=')[1];
    // Verificar si es un número o un nombre
    if (!isNaN(parseInt(valor, 10))) {
      etiquetaId = parseInt(valor, 10);
    } else {
      etiquetaNombre = valor;
    }
  }
  else if (arg.startsWith('--nombre=')) etiquetaNombre = arg.split('=')[1].replace(/"/g, '');
  else if (arg.startsWith('--color=')) etiquetaColor = arg.split('=')[1];
  else if (arg.startsWith('--descripcion=')) etiquetaDescripcion = arg.split('=')[1].replace(/"/g, '');
});

// Verificar argumentos
if (!action) {
  console.error('Error: Debe especificar una acción (--add, --remove, --list, --create)');
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

// Función para obtener el ID de un inmueble por su referencia
async function getInmuebleIdByRef(ref) {
  const inmueble = await db('inmuebles').where('ref', ref).first('id');
  if (!inmueble) {
    throw new Error(`No se encontró ningún inmueble con referencia ${ref}`);
  }
  return inmueble.id;
}

// Función para obtener el ID de una etiqueta por su nombre
async function getEtiquetaIdByNombre(nombre) {
  const etiqueta = await db('etiquetas').where('nombre', nombre).first('id');
  if (!etiqueta) {
    throw new Error(`No se encontró ninguna etiqueta con nombre "${nombre}"`);
  }
  return etiqueta.id;
}

// Función para añadir una etiqueta a un inmueble
async function addTagToProperty(inmuebleRef, etiquetaId) {
  try {
    // Obtener el ID del inmueble a partir de su referencia
    const inmuebleId = await getInmuebleIdByRef(inmuebleRef);
    
    // Verificar si la etiqueta existe
    const etiqueta = await db('etiquetas').where('id', etiquetaId).first();
    if (!etiqueta) {
      throw new Error(`No se encontró ninguna etiqueta con ID ${etiquetaId}`);
    }
    
    // Verificar si la relación ya existe
    const existingRelation = await db('inmuebles_etiquetas')
      .where({
        inmueble_id: inmuebleId,
        etiqueta_id: etiquetaId
      })
      .first();
    
    if (existingRelation) {
      console.log(`El inmueble #${inmuebleRef} ya tiene asignada la etiqueta "${etiqueta.nombre}"`);
      return;
    }
    
    // Crear la relación
    await db('inmuebles_etiquetas').insert({
      inmueble_id: inmuebleId,
      etiqueta_id: etiquetaId,
      created_at: db.fn.now()
    });
    
    console.log(`Se ha añadido la etiqueta "${etiqueta.nombre}" al inmueble #${inmuebleRef}`);
  } catch (error) {
    console.error(`Error al añadir etiqueta: ${error.message}`);
  }
}

// Función para eliminar una etiqueta de un inmueble
async function removeTagFromProperty(inmuebleRef, etiquetaId) {
  try {
    // Obtener el ID del inmueble a partir de su referencia
    const inmuebleId = await getInmuebleIdByRef(inmuebleRef);
    
    // Verificar si la etiqueta existe
    const etiqueta = await db('etiquetas').where('id', etiquetaId).first();
    if (!etiqueta) {
      throw new Error(`No se encontró ninguna etiqueta con ID ${etiquetaId}`);
    }
    
    // Eliminar la relación
    const deleted = await db('inmuebles_etiquetas')
      .where({
        inmueble_id: inmuebleId,
        etiqueta_id: etiquetaId
      })
      .delete();
    
    if (deleted > 0) {
      console.log(`Se ha eliminado la etiqueta "${etiqueta.nombre}" del inmueble #${inmuebleRef}`);
    } else {
      console.log(`El inmueble #${inmuebleRef} no tenía asignada la etiqueta "${etiqueta.nombre}"`);
    }
  } catch (error) {
    console.error(`Error al eliminar etiqueta: ${error.message}`);
  }
}

// Función para listar etiquetas de un inmueble
async function listPropertyTags(inmuebleRef) {
  try {
    // Obtener el ID del inmueble a partir de su referencia
    const inmuebleId = await getInmuebleIdByRef(inmuebleRef);
    
    // Obtener las etiquetas del inmueble
    const tags = await db('inmuebles_etiquetas as ie')
      .join('etiquetas as e', 'e.id', 'ie.etiqueta_id')
      .where('ie.inmueble_id', inmuebleId)
      .select('e.id', 'e.nombre', 'e.color', 'e.descripcion', 'ie.created_at');
    
    console.log(`Etiquetas del inmueble #${inmuebleRef}:`);
    if (tags.length > 0) {
      console.table(tags);
    } else {
      console.log('Este inmueble no tiene etiquetas asignadas.');
    }
  } catch (error) {
    console.error(`Error al listar etiquetas: ${error.message}`);
  }
}

// Función para listar inmuebles con una etiqueta específica
async function listPropertiesWithTag(etiquetaId) {
  try {
    // Verificar si la etiqueta existe
    const etiqueta = await db('etiquetas').where('id', etiquetaId).first();
    if (!etiqueta) {
      throw new Error(`No se encontró ninguna etiqueta con ID ${etiquetaId}`);
    }
    
    // Obtener los inmuebles con esta etiqueta
    const properties = await db('inmuebles_etiquetas as ie')
      .join('inmuebles as i', 'i.id', 'ie.inmueble_id')
      .where('ie.etiqueta_id', etiquetaId)
      .select('i.id', 'i.ref', 'i.titulo', 'i.tipo_inmueble_nombre', 'i.barrio_nombre', 'i.ciudad_nombre', 'ie.created_at');
    
    console.log(`Inmuebles con la etiqueta "${etiqueta.nombre}":`);
    if (properties.length > 0) {
      console.table(properties);
    } else {
      console.log('No hay inmuebles con esta etiqueta.');
    }
  } catch (error) {
    console.error(`Error al listar inmuebles: ${error.message}`);
  }
}

// Función para crear una nueva etiqueta
async function createTag(nombre, color, descripcion) {
  try {
    // Verificar si ya existe una etiqueta con ese nombre
    const existingTag = await db('etiquetas').where('nombre', nombre).first();
    if (existingTag) {
      throw new Error(`Ya existe una etiqueta con el nombre "${nombre}"`);
    }
    
    // Crear la etiqueta
    const [id] = await db('etiquetas').insert({
      nombre: nombre,
      color: color || '#3498db', // Color por defecto si no se especifica
      descripcion: descripcion || null,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });
    
    console.log(`Se ha creado la etiqueta "${nombre}" con ID ${id}`);
  } catch (error) {
    console.error(`Error al crear etiqueta: ${error.message}`);
  }
}

// Función principal
async function main() {
  try {
    // Ejecutar la acción correspondiente
    switch (action) {
      case 'add':
        if (!inmuebleId) {
          throw new Error('Debe especificar un inmueble (--inmueble=123)');
        }
        
        if (!etiquetaId && etiquetaNombre) {
          etiquetaId = await getEtiquetaIdByNombre(etiquetaNombre);
        }
        
        if (!etiquetaId) {
          throw new Error('Debe especificar una etiqueta (--etiqueta=1 o --etiqueta="Nombre")');
        }
        
        await addTagToProperty(inmuebleId, etiquetaId);
        break;
        
      case 'remove':
        if (!inmuebleId) {
          throw new Error('Debe especificar un inmueble (--inmueble=123)');
        }
        
        if (!etiquetaId && etiquetaNombre) {
          etiquetaId = await getEtiquetaIdByNombre(etiquetaNombre);
        }
        
        if (!etiquetaId) {
          throw new Error('Debe especificar una etiqueta (--etiqueta=1 o --etiqueta="Nombre")');
        }
        
        await removeTagFromProperty(inmuebleId, etiquetaId);
        break;
        
      case 'list':
        if (inmuebleId && !etiquetaId) {
          await listPropertyTags(inmuebleId);
        } else if (etiquetaId && !inmuebleId) {
          await listPropertiesWithTag(etiquetaId);
        } else if (etiquetaNombre && !inmuebleId) {
          etiquetaId = await getEtiquetaIdByNombre(etiquetaNombre);
          await listPropertiesWithTag(etiquetaId);
        } else {
          throw new Error('Debe especificar un inmueble (--inmueble=123) o una etiqueta (--etiqueta=1), pero no ambos');
        }
        break;
        
      case 'create':
        if (!etiquetaNombre) {
          throw new Error('Debe especificar un nombre para la etiqueta (--nombre="Nueva etiqueta")');
        }
        
        await createTag(etiquetaNombre, etiquetaColor, etiquetaDescripcion);
        break;
        
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Ejecutar la función principal
main();
