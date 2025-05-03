/**
 * Script para corregir los valores nulos restantes en la tabla de inmuebles
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

async function fixRemainingNulls() {
  console.log('======================================================================');
  console.log('CORRECCIÓN DE VALORES NULOS RESTANTES EN INMUEBLES');
  console.log('======================================================================');

  // Obtener inmuebles con título o descripción nulos
  const problematicInmuebles = await knex('inmuebles')
    .select('id', 'ref', 'titulo', 'descripcion')
    .where(function() {
      this.whereNull('titulo')
        .orWhere('titulo', '')
        .orWhereNull('descripcion')
        .orWhere('descripcion', '');
    });

  console.log(`\nSe encontraron ${problematicInmuebles.length} inmuebles con problemas:`);
  console.table(problematicInmuebles);

  // Actualizar cada inmueble problemático
  for (const inmueble of problematicInmuebles) {
    const defaultTitle = `Inmueble Ref: ${inmueble.ref}`;
    const defaultDescription = `Propiedad inmobiliaria disponible, referencia: ${inmueble.ref}`;
    
    await knex('inmuebles')
      .where('id', inmueble.id)
      .update({
        titulo: inmueble.titulo || defaultTitle,
        descripcion: inmueble.descripcion || defaultDescription
      });
    
    console.log(`Actualizado inmueble ID ${inmueble.id}, Ref ${inmueble.ref}`);
  }

  // Verificar resultados
  const finalStats = await knex('inmuebles')
    .select(knex.raw(`
      COUNT(*) as total,
      SUM(CASE WHEN titulo IS NULL OR titulo = '' THEN 1 ELSE 0 END) as titulo_null,
      SUM(CASE WHEN descripcion IS NULL OR descripcion = '' THEN 1 ELSE 0 END) as descripcion_null
    `));

  console.log('\nEstadísticas finales:');
  console.table(finalStats);

  console.log('\n¡Corrección completada!');
  console.log('======================================================================');
}

// Ejecutar la función principal
fixRemainingNulls()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Error al corregir valores nulos restantes:', err);
    process.exit(1);
  });
