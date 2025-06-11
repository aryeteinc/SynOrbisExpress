require('dotenv').config();
const knex = require('knex');

// Configuración de la base de datos
const db = knex({
  client: process.env.DB_TYPE || 'mysql',
  connection: {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
    user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'inmuebles'
  }
});

async function checkProperty(ref) {
  console.log(`\nBuscando inmueble con referencia: ${ref}`);
  
  try {
    // Verificar si el inmueble existe en la base de datos
    const property = await db('inmuebles').where({ ref }).first();
    
    if (property) {
      console.log('\n✅ El inmueble existe en la base de datos:');
      console.log(JSON.stringify(property, null, 2));
      
      // Verificar imágenes asociadas
      const images = await db('imagenes_inmueble').where({ inmueble_id: property.id }).orderBy('orden');
      
      if (images && images.length > 0) {
        console.log(`\n✅ El inmueble tiene ${images.length} imágenes asociadas:`);
        console.log(JSON.stringify(images, null, 2));
      } else {
        console.log('\n❌ El inmueble no tiene imágenes asociadas en la base de datos.');
      }
    } else {
      console.log('\n❌ El inmueble NO existe en la base de datos.');
      
      // Verificar si hay algún registro en la tabla de sincronización
      const syncRecord = await db('sincronizaciones_inmuebles')
        .where({ ref_inmueble: ref })
        .orderBy('created_at', 'desc')
        .first();
      
      if (syncRecord) {
        console.log('\nRegistro de sincronización encontrado:');
        console.log(JSON.stringify(syncRecord, null, 2));
      } else {
        console.log('\nNo se encontraron registros de sincronización para este inmueble.');
      }
    }
  } catch (error) {
    console.error(`Error al verificar el inmueble: ${error.message}`);
  } finally {
    await db.destroy();
  }
}

// Obtener la referencia desde los argumentos de línea de comandos
const ref = process.argv[2] || '261';
checkProperty(ref);
