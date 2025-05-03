/**
 * Script para corregir valores nulos en la tabla de inmuebles
 * Este script actualiza los campos nulos con valores predeterminados
 * o los extrae de otros campos cuando es posible.
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

async function fixNullValues() {
  console.log('======================================================================');
  console.log('CORRECCIÓN DE VALORES NULOS EN INMUEBLES');
  console.log('======================================================================');

  // Obtener estadísticas iniciales
  const initialStats = await getStats();
  console.log('\nEstadísticas iniciales de campos nulos:');
  console.table(initialStats);

  // 1. Corregir títulos nulos
  console.log('\nCorrigiendo títulos nulos...');
  await knex('inmuebles')
    .whereNull('titulo')
    .orWhere('titulo', '')
    .update({
      titulo: knex.raw(`COALESCE(descripcion, 'Inmueble Ref: ' || ref)`)
    });
  
  // 2. Corregir descripciones nulas
  console.log('Corrigiendo descripciones nulas...');
  await knex('inmuebles')
    .whereNull('descripcion')
    .orWhere('descripcion', '')
    .update({
      descripcion: knex.raw(`COALESCE(titulo, 'Inmueble disponible, Ref: ' || ref)`)
    });

  // 3. Corregir habitaciones nulas
  console.log('Corrigiendo habitaciones nulas...');
  await knex('inmuebles')
    .whereNull('habitaciones')
    .update({ habitaciones: 0 });

  // 4. Corregir baños nulos
  console.log('Corrigiendo baños nulos...');
  await knex('inmuebles')
    .whereNull('banos')
    .update({ banos: 0 });

  // 5. Corregir garajes nulos
  console.log('Corrigiendo garajes nulos...');
  await knex('inmuebles')
    .whereNull('garajes')
    .update({ garajes: 0 });

  // Obtener estadísticas finales
  const finalStats = await getStats();
  console.log('\nEstadísticas finales de campos nulos:');
  console.table(finalStats);

  console.log('\n¡Corrección de valores nulos completada!');
  console.log('======================================================================');
}

async function getStats() {
  return await knex('inmuebles')
    .select(knex.raw(`
      COUNT(*) as total,
      SUM(CASE WHEN titulo IS NULL OR titulo = '' THEN 1 ELSE 0 END) as titulo_null,
      SUM(CASE WHEN descripcion IS NULL OR descripcion = '' THEN 1 ELSE 0 END) as descripcion_null,
      SUM(CASE WHEN area IS NULL THEN 1 ELSE 0 END) as area_null,
      SUM(CASE WHEN habitaciones IS NULL THEN 1 ELSE 0 END) as habitaciones_null,
      SUM(CASE WHEN banos IS NULL THEN 1 ELSE 0 END) as banos_null,
      SUM(CASE WHEN garajes IS NULL THEN 1 ELSE 0 END) as garajes_null
    `));
}

// Ejecutar la función principal
fixNullValues()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Error al corregir valores nulos:', err);
    process.exit(1);
  });
