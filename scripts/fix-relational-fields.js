/**
 * Script para corregir los campos relacionales nulos en la tabla de inmuebles
 * Asigna valores predeterminados a los campos ciudad_id, barrio_id, tipo_inmueble_id, uso_id, estado_actual_id
 * y genera una descripción corta a partir de la descripción completa
 */

require('dotenv').config();
const knex = require('knex')({
  client: process.env.DB_TYPE || 'sqlite',
  connection: process.env.DB_TYPE === 'mysql'
    ? {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
      }
    : { filename: process.env.SQLITE_PATH },
  useNullAsDefault: true
});

async function fixRelationalFields() {
  console.log('======================================================================');
  console.log('CORRECCIÓN DE CAMPOS RELACIONALES EN INMUEBLES');
  console.log('======================================================================');

  // Obtener estadísticas iniciales
  const initialStats = await getStats();
  console.log('\nEstadísticas iniciales de campos nulos:');
  console.table(initialStats);

  // Obtener IDs predeterminados de las tablas relacionales
  const defaultValues = await getDefaultValues();
  console.log('\nValores predeterminados a utilizar:');
  console.table(defaultValues);

  // 1. Actualizar ciudad_id
  console.log('\nActualizando campos relacionales...');
  
  // Actualizar todos los inmuebles con valores predeterminados para campos relacionales
  const updateCount = await knex('inmuebles')
    .whereNull('ciudad_id')
    .orWhereNull('barrio_id')
    .orWhereNull('tipo_inmueble_id')
    .orWhereNull('uso_id')
    .orWhereNull('estado_actual_id')
    .update({
      ciudad_id: defaultValues.ciudad_id,
      barrio_id: defaultValues.barrio_id,
      tipo_inmueble_id: defaultValues.tipo_inmueble_id,
      uso_id: defaultValues.uso_id,
      estado_actual_id: defaultValues.estado_actual_id
    });
  
  console.log(`Actualizados ${updateCount} inmuebles con valores predeterminados para campos relacionales`);

  // 2. Generar descripción corta a partir de la descripción completa
  console.log('\nGenerando descripciones cortas...');
  
  const inmuebles = await knex('inmuebles')
    .whereNull('descripcion_corta')
    .select('id', 'descripcion', 'titulo');
  
  let descriptionUpdates = 0;
  
  for (const inmueble of inmuebles) {
    let descripcionCorta = '';
    
    if (inmueble.descripcion && inmueble.descripcion.length > 0) {
      // Extraer las primeras 150 caracteres de la descripción
      descripcionCorta = inmueble.descripcion.substring(0, 150);
      // Si cortamos en medio de una palabra, retroceder hasta el último espacio
      if (descripcionCorta.length === 150 && inmueble.descripcion.length > 150) {
        const lastSpace = descripcionCorta.lastIndexOf(' ');
        if (lastSpace > 100) { // Asegurarse de que no retrocedemos demasiado
          descripcionCorta = descripcionCorta.substring(0, lastSpace);
        }
        descripcionCorta += '...';
      }
    } else if (inmueble.titulo) {
      // Si no hay descripción, usar el título
      descripcionCorta = inmueble.titulo;
    } else {
      // Si no hay título ni descripción, usar un texto genérico
      descripcionCorta = 'Propiedad inmobiliaria disponible';
    }
    
    await knex('inmuebles')
      .where('id', inmueble.id)
      .update({ descripcion_corta: descripcionCorta });
    
    descriptionUpdates++;
  }
  
  console.log(`Generadas ${descriptionUpdates} descripciones cortas`);

  // Obtener estadísticas finales
  const finalStats = await getStats();
  console.log('\nEstadísticas finales de campos nulos:');
  console.table(finalStats);

  console.log('\n¡Corrección de campos relacionales completada!');
  console.log('======================================================================');
}

async function getStats() {
  return await knex('inmuebles')
    .select(knex.raw(`
      COUNT(*) as total,
      SUM(CASE WHEN ciudad_id IS NULL THEN 1 ELSE 0 END) as ciudad_null,
      SUM(CASE WHEN barrio_id IS NULL THEN 1 ELSE 0 END) as barrio_null,
      SUM(CASE WHEN tipo_inmueble_id IS NULL THEN 1 ELSE 0 END) as tipo_inmueble_null,
      SUM(CASE WHEN uso_id IS NULL THEN 1 ELSE 0 END) as uso_null,
      SUM(CASE WHEN estado_actual_id IS NULL THEN 1 ELSE 0 END) as estado_null,
      SUM(CASE WHEN descripcion_corta IS NULL THEN 1 ELSE 0 END) as desc_corta_null
    `));
}

async function getDefaultValues() {
  // Obtener el primer ID de cada tabla relacional
  const defaultValues = {};
  
  // Ciudad (Sincelejo)
  const ciudad = await knex('ciudades').select('id').orderBy('id').first();
  defaultValues.ciudad_id = ciudad ? ciudad.id : 1;
  
  // Barrio (primer barrio)
  const barrio = await knex('barrios').select('id').orderBy('id').first();
  defaultValues.barrio_id = barrio ? barrio.id : 1;
  
  // Tipo de inmueble (Casa)
  const tipoInmueble = await knex('tipos_inmueble')
    .select('id')
    .where('nombre', 'like', '%Casa%')
    .first();
  defaultValues.tipo_inmueble_id = tipoInmueble ? tipoInmueble.id : 2; // ID 2 suele ser Casa
  
  // Uso de inmueble (Vivienda)
  const usoInmueble = await knex('usos_inmueble')
    .select('id')
    .where('nombre', 'like', '%Vivienda%')
    .first();
  defaultValues.uso_id = usoInmueble ? usoInmueble.id : 1; // ID 1 suele ser Vivienda
  
  // Estado actual (Disponible)
  const estadoInmueble = await knex('estados_inmueble')
    .select('id')
    .where('nombre', 'like', '%Disponible%')
    .first();
  defaultValues.estado_actual_id = estadoInmueble ? estadoInmueble.id : 1; // ID 1 suele ser Disponible
  
  return defaultValues;
}

// Ejecutar la función principal
fixRelationalFields()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Error al corregir campos relacionales:', err);
    process.exit(1);
  });
