// Script para verificar y corregir el inmueble con referencia 261
require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

// Carpeta de imágenes
const imagesFolder = process.env.IMAGES_FOLDER || path.join(__dirname, '../public/images/inmuebles');

async function checkProperty(ref) {
  console.log(`\n🔍 Verificando inmueble con referencia: ${ref}`);
  console.log('===========================================================');
  
  try {
    // 1. Mostrar las variables de entorno relevantes (sin mostrar valores sensibles)
    console.log('\n1️⃣ Variables de entorno configuradas:');
    console.log(`   - DB_TYPE: ${process.env.DB_TYPE ? '✅' : '❌'}`);
    console.log(`   - DB_HOST/MYSQL_HOST: ${process.env.DB_HOST || process.env.MYSQL_HOST ? '✅' : '❌'}`);
    console.log(`   - DB_USER/MYSQL_USER: ${process.env.DB_USER || process.env.MYSQL_USER ? '✅' : '❌'}`);
    console.log(`   - DB_PASSWORD/MYSQL_PASSWORD: ${process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD ? '✅' : '❌'}`);
    console.log(`   - DB_DATABASE/MYSQL_DATABASE: ${process.env.DB_DATABASE || process.env.MYSQL_DATABASE ? '✅' : '❌'}`);
    console.log(`   - API_URL: ${process.env.API_URL ? '✅' : '❌'}`);
    console.log(`   - API_KEY: ${process.env.API_KEY ? '✅' : '❌'}`);
    console.log(`   - IMAGES_FOLDER: ${process.env.IMAGES_FOLDER ? '✅' : '❌'}`);
    
    // 2. Verificar si el inmueble existe en la base de datos
    console.log('\n2️⃣ Verificando existencia en la base de datos...');
    
    try {
      const property = await db('inmuebles').where({ ref }).first();
      
      if (property) {
        console.log('✅ El inmueble SÍ existe en la base de datos:');
        console.log(`   - ID: ${property.id}`);
        console.log(`   - Título: ${property.titulo || 'No disponible'}`);
        console.log(`   - Tipo: ${property.tipo_inmueble_id}`);
        console.log(`   - Uso: ${property.uso_inmueble_id}`);
        console.log(`   - Estado: ${property.estado_inmueble_id}`);
        console.log(`   - Última actualización: ${property.updated_at}`);
        
        // 3. Verificar imágenes asociadas
        console.log('\n3️⃣ Verificando imágenes asociadas...');
        
        const images = await db('imagenes_inmueble').where({ inmueble_id: property.id }).orderBy('orden');
        
        if (images && images.length > 0) {
          console.log(`✅ El inmueble tiene ${images.length} imágenes asociadas:`);
          
          // Verificar archivos físicos
          for (const img of images) {
            const imagePath = path.join(imagesFolder, img.archivo || '');
            const imageExists = fs.existsSync(imagePath);
            
            console.log(`   - ID: ${img.id}, Orden: ${img.orden}, Archivo: ${img.archivo || 'No disponible'}`);
            console.log(`     Archivo físico: ${imageExists ? '✅ Existe' : '❌ No existe'}`);
            
            if (imageExists) {
              const stats = fs.statSync(imagePath);
              console.log(`     Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
            }
          }
        } else {
          console.log('❌ El inmueble NO tiene imágenes asociadas en la base de datos.');
          
          // Verificar si hay registros de sincronización para este inmueble
          console.log('\n4️⃣ Verificando registros de sincronización...');
          
          const syncRecords = await db('sincronizaciones_inmuebles')
            .where({ ref_inmueble: ref })
            .orderBy('created_at', 'desc')
            .limit(5);
          
          if (syncRecords && syncRecords.length > 0) {
            console.log(`✅ Se encontraron ${syncRecords.length} registros de sincronización:`);
            
            for (const record of syncRecords) {
              console.log(`   - ID: ${record.id}, Fecha: ${record.created_at}`);
              console.log(`     Estado: ${record.estado || 'No disponible'}`);
              console.log(`     Mensaje: ${record.mensaje || 'No disponible'}`);
            }
          } else {
            console.log('❌ No se encontraron registros de sincronización para este inmueble.');
          }
          
          // Verificar errores en el log
          console.log('\n5️⃣ Verificando errores en el log...');
          
          const errorLogs = await db('log_errores')
            .where('mensaje', 'like', `%${ref}%`)
            .orderBy('created_at', 'desc')
            .limit(5);
          
          if (errorLogs && errorLogs.length > 0) {
            console.log(`⚠️ Se encontraron ${errorLogs.length} registros de errores relacionados:`);
            
            for (const log of errorLogs) {
              console.log(`   - ID: ${log.id}, Fecha: ${log.created_at}`);
              console.log(`     Tipo: ${log.tipo || 'No disponible'}`);
              console.log(`     Mensaje: ${log.mensaje || 'No disponible'}`);
            }
          } else {
            console.log('✅ No se encontraron errores en el log relacionados con este inmueble.');
          }
        }
      } else {
        console.log('❌ El inmueble NO existe en la base de datos.');
        
        // Verificar si hay registros de sincronización para este inmueble
        console.log('\n4️⃣ Verificando registros de sincronización...');
        
        const syncRecords = await db('sincronizaciones_inmuebles')
          .where({ ref_inmueble: ref })
          .orderBy('created_at', 'desc')
          .limit(5);
        
        if (syncRecords && syncRecords.length > 0) {
          console.log(`✅ Se encontraron ${syncRecords.length} registros de sincronización:`);
          
          for (const record of syncRecords) {
            console.log(`   - ID: ${record.id}, Fecha: ${record.created_at}`);
            console.log(`     Estado: ${record.estado || 'No disponible'}`);
            console.log(`     Mensaje: ${record.mensaje || 'No disponible'}`);
          }
        } else {
          console.log('❌ No se encontraron registros de sincronización para este inmueble.');
        }
      }
    } catch (dbError) {
      console.error(`❌ Error al consultar la base de datos: ${dbError.message}`);
    }
    
    // 6. Recomendaciones
    console.log('\n6️⃣ Recomendaciones:');
    console.log('   1. Verificar que las variables API_URL y API_KEY estén correctamente configuradas en el archivo .env');
    console.log('   2. Ejecutar una sincronización específica para este inmueble:');
    console.log('      node scripts/sync-optimized-v2.js --ref=261');
    console.log('   3. Verificar los logs de error para identificar problemas específicos');
    console.log('   4. Comprobar que la API devuelve imágenes para este inmueble');
    
  } catch (error) {
    console.error(`Error general: ${error.message}`);
  } finally {
    await db.destroy();
  }
}

// Ejecutar la función
const ref = '261';
checkProperty(ref)
  .then(() => {
    console.log('\nVerificación completada.');
    process.exit(0);
  })
  .catch(error => {
    console.error(`Error fatal: ${error.message}`);
    process.exit(1);
  });
