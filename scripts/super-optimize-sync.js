/**
 * Script de optimización avanzada para SyncOrbisExpress
 * 
 * Este script implementa optimizaciones adicionales para mejorar
 * significativamente la velocidad de sincronización:
 * 
 * 1. Procesamiento en paralelo de inmuebles
 * 2. Procesamiento asíncrono de imágenes
 * 3. Sistema de caché para consultas frecuentes
 * 4. Transacciones para operaciones múltiples
 * 5. Índices adicionales en la base de datos
 * 6. Sistema de registro de rendimiento
 * 
 * Uso:
 * node scripts/super-optimize-sync.js
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// Implementación simple para reemplazar chalk
const chalk = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

// Cargar variables de entorno
dotenv.config();

// Configuración
const config = {
  dbType: process.env.DB_TYPE || 'mysql',
  mysqlHost: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  mysqlPort: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
  mysqlUser: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  mysqlDatabase: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'inmuebles',
  imagesFolder: process.env.IMAGES_FOLDER || path.join(__dirname, '../public/images/inmuebles'),
  syncScriptPath: path.join(__dirname, 'sync-optimized-v2.js'),
  originalScriptPath: path.join(__dirname, 'sync-js.js'),
  batchSize: process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : 5,
  maxConcurrentImages: process.env.MAX_CONCURRENT_IMAGES ? parseInt(process.env.MAX_CONCURRENT_IMAGES) : 3,
  imageQuality: process.env.IMAGE_QUALITY ? parseInt(process.env.IMAGE_QUALITY) : 80,
  imageWidth: process.env.IMAGE_WIDTH ? parseInt(process.env.IMAGE_WIDTH) : 1200
};

// Inicializar conexión a la base de datos
let db;

/**
 * Optimiza la base de datos con índices adicionales
 */
async function optimizeDatabaseAdvanced() {
  console.log(chalk.bold('\n=== Optimización avanzada de la base de datos ==='));
  
  try {
    if (config.dbType === 'mysql') {
      console.log('Configurando conexión a MySQL...');
      db = knex({
        client: 'mysql2',
        connection: {
          host: config.mysqlHost,
          port: config.mysqlPort,
          user: config.mysqlUser,
          password: config.mysqlPassword,
          database: config.mysqlDatabase
        },
        pool: { min: 0, max: 7 }
      });
    } else {
      console.error(chalk.red('❌ Tipo de base de datos no soportado para optimización avanzada.'));
      return false;
    }
    
    // Probar la conexión
    await db.raw('SELECT 1');
    console.log(chalk.green('✅ Conexión a la base de datos establecida correctamente.'));
    
    // 1. Crear índices compuestos avanzados
    console.log('Creando índices compuestos avanzados...');
    
    const advancedIndices = [
      { 
        table: 'inmuebles', 
        indices: [
          { name: 'idx_inmuebles_ciudad_tipo', columns: ['ciudad_id', 'tipo_inmueble_id'] },
          { name: 'idx_inmuebles_precio', columns: ['precio_venta', 'precio_canon'] },
          { name: 'idx_inmuebles_area_habitaciones', columns: ['area_construida', 'habitaciones'] },
          { name: 'idx_inmuebles_activo_destacado', columns: ['activo', 'destacado'] }
        ]
      },
      {
        table: 'imagenes',
        indices: [
          { name: 'idx_imagenes_inmueble_orden', columns: ['inmueble_id', 'orden'] }
        ]
      }
    ];
    
    for (const tableInfo of advancedIndices) {
      const tableExists = await db.schema.hasTable(tableInfo.table);
      
      if (!tableExists) {
        console.log(chalk.yellow(`⚠️ Tabla ${tableInfo.table} no existe, no se pueden crear índices.`));
        continue;
      }
      
      for (const index of tableInfo.indices) {
        try {
          // Verificar si el índice ya existe
          const indexesResult = await db.raw(`SHOW INDEX FROM ${tableInfo.table} WHERE Key_name = '${index.name}'`);
          
          if (indexesResult[0].length === 0) {
            // Crear el índice
            const columnsStr = index.columns.map(col => `\`${col}\``).join(', ');
            await db.raw(`CREATE INDEX ${index.name} ON ${tableInfo.table} (${columnsStr})`);
            console.log(chalk.green(`✅ Índice compuesto ${index.name} creado en la tabla ${tableInfo.table}.`));
          } else {
            console.log(chalk.blue(`ℹ️ El índice ${index.name} ya existe en la tabla ${tableInfo.table}.`));
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error creando índice ${index.name} en la tabla ${tableInfo.table}: ${error.message}`));
        }
      }
    }
    
    // 2. Crear índice de texto completo si no existe
    try {
      console.log('\nCreando índice de texto completo para búsquedas...');
      
      // Verificar si la tabla inmuebles existe
      const hasInmuebles = await db.schema.hasTable('inmuebles');
      
      if (hasInmuebles) {
        // Verificar si ya existe un índice FULLTEXT
        const fulltextIndexResult = await db.raw(`SHOW INDEX FROM inmuebles WHERE Index_type = 'FULLTEXT'`);
        
        if (fulltextIndexResult[0].length === 0) {
          // Crear índice FULLTEXT
          await db.raw(`ALTER TABLE inmuebles ADD FULLTEXT idx_inmuebles_fulltext (titulo, descripcion)`);
          console.log(chalk.green(`✅ Índice de texto completo creado en la tabla inmuebles.`));
        } else {
          console.log(chalk.blue(`ℹ️ Ya existe un índice de texto completo en la tabla inmuebles.`));
        }
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️ No se pudo crear el índice de texto completo: ${error.message}`));
      console.log(chalk.yellow('Esto no afecta la funcionalidad, solo el rendimiento de búsquedas.'));
    }
    
    // 3. Optimizar configuración de MySQL para mejor rendimiento
    console.log('\nConfigurando variables avanzadas de MySQL...');
    
    try {
      // Configurar variables adicionales para mejor rendimiento
      await db.raw('SET GLOBAL innodb_flush_log_at_trx_commit = 2'); // Mejor rendimiento a costa de durabilidad
      await db.raw('SET GLOBAL innodb_flush_method = O_DIRECT'); // Mejor rendimiento de I/O
      await db.raw('SET GLOBAL innodb_buffer_pool_instances = 4'); // Múltiples instancias de buffer pool
      
      console.log(chalk.green('✅ Variables avanzadas de MySQL configuradas correctamente.'));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ No se pudieron configurar algunas variables avanzadas de MySQL: ${error.message}`));
      console.log(chalk.yellow('Esto no afecta la funcionalidad, solo el rendimiento.'));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error en la optimización avanzada de la base de datos: ${error.message}`));
    return false;
  }
}

/**
 * Modifica el script de sincronización para implementar optimizaciones avanzadas
 */
async function enhanceSyncScript() {
  console.log(chalk.bold('\n=== Mejorando el script de sincronización ==='));
  
  try {
    if (!fs.existsSync(config.syncScriptPath)) {
      console.error(chalk.red(`❌ No se encontró el archivo ${config.syncScriptPath}.`));
      return false;
    }
    
    console.log('Leyendo el script de sincronización...');
    let content = fs.readFileSync(config.syncScriptPath, 'utf8');
    let modified = false;
    
    // 1. Implementar sistema de caché
    if (!content.includes('// Sistema de caché') && !content.includes('const cache =')) {
      console.log('Implementando sistema de caché para consultas frecuentes...');
      
      const cacheImplementation = `
// Sistema de caché para consultas frecuentes
const cache = {
  data: new Map(),
  ttl: 300000, // 5 minutos en milisegundos
  
  // Obtener un valor de la caché
  get(key) {
    if (this.data.has(key)) {
      const item = this.data.get(key);
      if (Date.now() < item.expiry) {
        return item.value;
      }
      this.data.delete(key); // Eliminar si expiró
    }
    return null;
  },
  
  // Guardar un valor en la caché
  set(key, value, ttl = this.ttl) {
    this.data.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  },
  
  // Limpiar la caché
  clear() {
    this.data.clear();
  }
};
`;
      
      // Insertar después de las importaciones
      const importEndPos = content.indexOf('// Cargar variables de entorno');
      if (importEndPos !== -1) {
        content = content.slice(0, importEndPos) + cacheImplementation + content.slice(importEndPos);
        modified = true;
      }
    }
    
    // 2. Implementar sistema de registro de rendimiento
    if (!content.includes('// Sistema de registro de rendimiento') && !content.includes('const performance =')) {
      console.log('Implementando sistema de registro de rendimiento...');
      
      const performanceImplementation = `
// Sistema de registro de rendimiento
const performance = {
  timers: {},
  
  start(label) {
    this.timers[label] = Date.now();
  },
  
  end(label) {
    if (!this.timers[label]) return 0;
    
    const duration = Date.now() - this.timers[label];
    delete this.timers[label];
    
    console.log(\`⏱️ \${label}: \${duration}ms\`);
    return duration;
  }
};
`;
      
      // Insertar después del sistema de caché o después de las importaciones
      if (content.includes('// Sistema de caché')) {
        const cacheEndPos = content.indexOf('// Sistema de caché') + content.substring(content.indexOf('// Sistema de caché')).indexOf('};') + 2;
        content = content.slice(0, cacheEndPos) + '\n' + performanceImplementation + content.slice(cacheEndPos);
      } else {
        const importEndPos = content.indexOf('// Cargar variables de entorno');
        if (importEndPos !== -1) {
          content = content.slice(0, importEndPos) + performanceImplementation + content.slice(importEndPos);
        }
      }
      modified = true;
    }
    
    // 3. Implementar procesamiento en paralelo para inmuebles
    if (!content.includes('processBatchInParallel') && !content.includes('Promise.all(batch.map(')) {
      console.log('Implementando procesamiento en paralelo para inmuebles...');
      
      const parallelProcessingImplementation = `
// Función para procesar lotes de inmuebles en paralelo
async function processBatchInParallel(properties, batchSize = 5) {
  const results = [];
  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    console.log(\`Procesando lote \${Math.floor(i/batchSize) + 1}/\${Math.ceil(properties.length/batchSize)} (\${i+1}-\${Math.min(i+batchSize, properties.length)}/\${properties.length})\`);
    
    // Iniciar medición de tiempo para este lote
    performance.start(\`lote_\${Math.floor(i/batchSize) + 1}\`);
    
    // Procesar inmuebles en paralelo con un límite de concurrencia
    const batchResults = await Promise.all(
      batch.map(property => processProperty(property, downloadImages, trackChanges)
        .catch(error => {
          console.error(\`Error procesando inmueble #\${property.ref}: \${error.message}\`);
          stats.errores++;
          return null;
        })
      )
    );
    
    const duration = performance.end(\`lote_\${Math.floor(i/batchSize) + 1}\`);
    
    results.push(...batchResults.filter(result => result !== null));
    console.log(\`Lote \${Math.floor(i/batchSize) + 1} completado: \${batchResults.filter(result => result !== null).length} inmuebles procesados en \${duration}ms\`);
  }
  return results;
}
`;
      
      // Buscar la función main para modificarla
      const mainFunctionPos = content.indexOf('async function main()');
      if (mainFunctionPos !== -1) {
        // Insertar la función de procesamiento en paralelo antes de la función main
        content = content.slice(0, mainFunctionPos) + parallelProcessingImplementation + content.slice(mainFunctionPos);
        
        // Modificar la parte de la función main que procesa los inmuebles
        const processPropertiesPattern = /for\s*\(\s*const\s+property\s+of\s+properties\s*\)\s*\{[\s\S]*?await\s+processProperty[\s\S]*?\}/;
        const newProcessingCode = `
    // Procesar inmuebles en paralelo
    console.log('Procesando inmuebles en paralelo...');
    performance.start('procesamiento_total');
    await processBatchInParallel(properties, 5);
    console.log(\`⏱️ Tiempo total de procesamiento: \${performance.end('procesamiento_total')}ms\`);
    `;
        
        content = content.replace(processPropertiesPattern, newProcessingCode);
        modified = true;
      }
    }
    
    // 4. Optimizar el procesamiento de imágenes
    if (!content.includes('processImagesOptimized') && !content.includes('Promise.all(chunk.map(')) {
      console.log('Optimizando el procesamiento de imágenes...');
      
      // Buscar la función processImages
      const processImagesPos = content.indexOf('async function processImages');
      if (processImagesPos !== -1) {
        // Crear una versión optimizada de la función
        const processImagesOptimizedImplementation = `
// Función optimizada para procesar imágenes con paralelismo controlado
async function processImagesOptimized(propertyId, propertyRef, images) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    console.log(\`Inmueble #\${propertyRef}: No hay imágenes para procesar\`);
    return [];
  }
  
  console.log(\`Inmueble #\${propertyRef}: Procesando \${images.length} imágenes en paralelo...\`);
  performance.start(\`imagenes_\${propertyRef}\`);
  
  // Crear carpeta para las imágenes del inmueble
  const propertyFolder = path.join(config.imagesFolder, \`inmueble_\${propertyRef}\`);
  if (!fs.existsSync(propertyFolder)) {
    fs.mkdirSync(propertyFolder, { recursive: true });
  }
  
  // Obtener imágenes existentes de la base de datos (usar caché si está disponible)
  const cacheKey = \`imagenes_\${propertyId}\`;
  let existingImages = cache.get(cacheKey);
  
  if (existingImages === null) {
    try {
      existingImages = await db('imagenes')
        .where('inmueble_id', propertyId)
        .select('id', 'url', 'url_local', 'orden');
      
      // Guardar en caché
      cache.set(cacheKey, existingImages);
      
      if (existingImages.length > 0) {
        console.log(\`Inmueble #\${propertyRef}: Se encontraron \${existingImages.length} imágenes en la base de datos\`);
      }
    } catch (dbError) {
      console.log(\`Inmueble #\${propertyRef}: No se pudieron obtener imágenes de la base de datos: \${dbError.message}\`);
      existingImages = [];
    }
  } else {
    console.log(\`Inmueble #\${propertyRef}: Usando caché para \${existingImages.length} imágenes existentes\`);
  }
  
  // Mapear URLs existentes para comparación rápida
  const existingUrlMap = new Map();
  existingImages.forEach(img => {
    existingUrlMap.set(img.url, img);
  });
  
  const processedImages = [];
  
  // Procesar imágenes en lotes paralelos
  const concurrencyLimit = 3; // Procesar hasta 3 imágenes simultáneamente
  const chunks = [];
  
  // Dividir en chunks para procesamiento paralelo
  for (let i = 0; i < images.length; i += concurrencyLimit) {
    chunks.push(images.slice(i, i + concurrencyLimit));
  }
  
  // Procesar cada chunk en paralelo
  for (const [chunkIndex, chunk] of chunks.entries()) {
    console.log(\`Procesando lote de imágenes \${chunkIndex + 1}/\${chunks.length} para inmueble #\${propertyRef}\`);
    
    // Procesar este lote en paralelo
    const chunkPromises = chunk.map(async (image, index) => {
      const i = chunkIndex * concurrencyLimit + index;
      const imageUrl = image.url || image.imagen || image.src || image;
      
      if (!imageUrl) {
        console.log(\`Inmueble #\${propertyRef}: Imagen \${i+1}/\${images.length} no tiene URL\`);
        return null;
      }
      
      try {
        // Obtener nombre de archivo de la URL
        const urlParts = imageUrl.split('/');
        const originalFilename = urlParts[urlParts.length - 1];
        
        // Crear nombre de archivo local
        const localFilename = \`\${propertyRef}_\${i+1}_\${originalFilename}\`;
        const localPath = path.join(propertyFolder, localFilename);
        
        let hash = null;
        let imageRegistered = false;
        let existingImageId = null;
        
        // Verificar si la imagen ya existe en la base de datos
        if (existingUrlMap.has(imageUrl)) {
          const existingImage = existingUrlMap.get(imageUrl);
          existingImageId = existingImage.id;
          
          // Si la imagen ya existe y tiene la misma ruta local, no descargarla de nuevo
          if (fs.existsSync(existingImage.url_local)) {
            console.log(\`Inmueble #\${propertyRef}: Imagen \${i+1}/\${images.length} ya existe localmente\`);
            
            // Agregar la imagen a la lista de procesadas con su ID existente
            return {
              id: existingImage.id,
              url: imageUrl,
              url_local: existingImage.url_local,
              orden: i,
              descargada: 1
            };
          } 
          console.log(\`Inmueble #\${propertyRef}: Imagen \${i+1}/\${images.length} existe en BD pero no en disco, descargando\`);
        }
        
        // Si la imagen no está registrada en la base de datos, verificar si existe en el sistema de archivos
        if (!imageRegistered && fs.existsSync(localPath)) {
          // Si la imagen ya existe en disco, calcular su hash
          hash = await calculateImageHash(localPath);
          console.log(\`Inmueble #\${propertyRef}: Imagen \${i+1}/\${images.length} ya existe localmente con hash \${hash}\`);
          
          return {
            url: imageUrl,
            url_local: localPath,
            orden: i,
            descargada: 1
          };
        }
        
        // Si la imagen no está registrada y no existe en disco, descargarla
        console.log(\`Inmueble #\${propertyRef}: Descargando imagen \${i+1}/\${images.length}: \${imageUrl}\`);
        
        try {
          // Descargar la imagen
          const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'arraybuffer'
          });
          
          // Guardar la imagen localmente
          fs.writeFileSync(localPath, response.data);
          
          // Calcular hash MD5 de la imagen
          hash = await calculateImageHash(localPath);
          console.log(\`Inmueble #\${propertyRef}: Imagen \${i+1}/\${images.length} descargada con hash \${hash}\`);
          
          // Incrementar contador de imágenes descargadas
          stats.imagenes_descargadas++;
          
          return {
            url: imageUrl,
            url_local: localPath,
            orden: i,
            descargada: 1
          };
        } catch (downloadError) {
          console.error(\`Error al descargar imagen \${i+1}/\${images.length} para inmueble #\${propertyRef}: \${downloadError.message}\`);
          return null;
        }
      } catch (error) {
        console.error(\`Error al procesar imagen \${i+1}/\${images.length} para inmueble #\${propertyRef}: \${error.message}\`);
        return null;
      }
    });
    
    // Esperar a que se completen todas las promesas de este chunk
    const chunkResults = await Promise.all(chunkPromises);
    
    // Filtrar resultados nulos y agregarlos a las imágenes procesadas
    processedImages.push(...chunkResults.filter(result => result !== null));
  }
  
  // Guardar las imágenes procesadas en la base de datos usando transacción
  try {
    await db.transaction(async (trx) => {
      // Eliminar imágenes existentes que ya no están en la lista actual
      if (existingImages.length > 0) {
        const processedUrls = processedImages.map(img => img.url);
        const imagesToDelete = existingImages.filter(img => !processedUrls.includes(img.url));
        
        if (imagesToDelete.length > 0) {
          console.log(\`Inmueble #\${propertyRef}: Eliminando \${imagesToDelete.length} imágenes obsoletas de la base de datos\`);
          await trx('imagenes')
            .whereIn('id', imagesToDelete.map(img => img.id))
            .delete();
        }
      }
      
      // Insertar o actualizar imágenes en la base de datos
      for (const img of processedImages) {
        if (img.id) {
          // Actualizar imagen existente
          await trx('imagenes')
            .where('id', img.id)
            .update({
              orden: img.orden,
              updated_at: trx.fn.now()
            });
        } else {
          // Insertar nueva imagen
          await trx('imagenes').insert({
            inmueble_id: propertyId,
            url: img.url,
            url_local: img.url_local,
            orden: img.orden,
            descargada: img.descargada || 1
          });
        }
      }
    });
    
    console.log(\`Inmueble #\${propertyRef}: \${processedImages.length} imágenes guardadas en la base de datos\`);
  } catch (dbError) {
    console.error(\`Error al guardar imágenes en la base de datos para inmueble #\${propertyRef}: \${dbError.message}\`);
  }
  
  const duration = performance.end(\`imagenes_\${propertyRef}\`);
  console.log(\`⏱️ Procesamiento de imágenes para inmueble #\${propertyRef} completado en \${duration}ms\`);
  
  return processedImages;
}
`;
        
        // Insertar la función optimizada después de la función original
        const processImagesEndPos = content.indexOf('async function processImages') + content.substring(content.indexOf('async function processImages')).indexOf('}') + 1;
        content = content.slice(0, processImagesEndPos) + '\n\n' + processImagesOptimizedImplementation + content.slice(processImagesEndPos);
        
        // Reemplazar llamadas a processImages por processImagesOptimized
        content = content.replace(/await processImages\(/g, 'await processImagesOptimized(');
        
        modified = true;
      }
    }
    
    // 5. Implementar transacciones para el procesamiento de propiedades
    if (!content.includes('db.transaction') && !content.includes('trx(')) {
      console.log('Implementando transacciones para el procesamiento de propiedades...');
      
      // Buscar puntos donde se realizan múltiples operaciones de base de datos
      // y reemplazarlos con transacciones
      
      // Ejemplo: Actualización de inmuebles
      const updatePattern = /await db\('inmuebles'\)[\s\S]*?\.update\(\{[\s\S]*?\}\);/g;
      content = content.replace(updatePattern, (match) => {
        return `await db.transaction(async (trx) => {
      ${match.replace(/db\(/g, 'trx(')}
    });`;
      });
      
      modified = true;
    }
    
    if (modified) {
      // Crear una copia de seguridad del archivo original
      const backupPath = `${config.syncScriptPath}.backup-${Date.now()}`;
      fs.copyFileSync(config.syncScriptPath, backupPath);
      console.log(chalk.blue(`ℹ️ Se ha creado una copia de seguridad del script original en ${backupPath}`));
      
      // Guardar el archivo modificado
      fs.writeFileSync(config.syncScriptPath, content);
      console.log(chalk.green('✅ Script de sincronización actualizado con optimizaciones avanzadas.'));
      
      return true;
    } else {
      console.log(chalk.blue('ℹ️ El script de sincronización ya contiene todas las optimizaciones avanzadas.'));
      return true;
    }
  } catch (error) {
    console.error(chalk.red(`❌ Error al mejorar el script de sincronización: ${error.message}`));
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log(chalk.bold('======================================================================'));
  console.log(chalk.bold('OPTIMIZACIÓN AVANZADA DE SYNCORBISEXPRESS V2'));
  console.log(chalk.bold('======================================================================'));
  
  let success = true;
  
  // Optimizar la base de datos con índices avanzados
  if (!(await optimizeDatabaseAdvanced())) {
    success = false;
  }
  
  // Verificar que el script optimizado existe
  if (!fs.existsSync(config.syncScriptPath)) {
    console.log(chalk.yellow(`\n⚠️ El script optimizado no existe: ${config.syncScriptPath}`));
    console.log(chalk.blue(`\nℹ️ Utilizando script original: ${config.originalScriptPath}`));
    config.syncScriptPath = config.originalScriptPath;
    success = false;
  } else {
    console.log(chalk.green(`\n✅ Usando script optimizado: ${config.syncScriptPath}`));
  }
  
  console.log(chalk.bold('\n======================================================================'));
  
  if (success) {
    console.log(chalk.green(chalk.bold('✅ OPTIMIZACIÓN AVANZADA COMPLETADA CORRECTAMENTE')));
    console.log(chalk.green('La sincronización está lista para ejecutarse con rendimiento mejorado.'));
    
    // Preguntar si desea ejecutar la sincronización ahora
    console.log(chalk.bold('\n¿Desea ejecutar la sincronización optimizada ahora? (s/n)'));
    
    // Leer la respuesta del usuario (simulación simple)
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const response = await new Promise(resolve => {
      rl.question('> ', answer => {
        rl.close();
        resolve(answer.toLowerCase());
      });
    });
    
    if (response === 's' || response === 'si' || response === 'y' || response === 'yes') {
      console.log(chalk.bold('\nEjecutando sincronización optimizada...\n'));
      
      // Configurar variables de entorno para la optimización
      const env = {
        ...process.env,
        BATCH_SIZE: config.batchSize.toString(),
        MAX_CONCURRENT_IMAGES: config.maxConcurrentImages.toString(),
        IMAGE_QUALITY: config.imageQuality.toString(),
        IMAGE_WIDTH: config.imageWidth.toString()
      };
      
      try {
        execSync(`node ${config.syncScriptPath}`, { stdio: 'inherit', env });
        console.log(chalk.green('\n✅ Sincronización optimizada completada con éxito!'));
      } catch (error) {
        console.error(chalk.red(`\n❌ Error al ejecutar la sincronización: ${error.message}`));
      }
    } else {
      console.log(chalk.blue('\nPuede ejecutar la sincronización optimizada manualmente con:'));
      console.log(chalk.blue(`node ${config.syncScriptPath}`));
    }
    
    console.log(chalk.blue('\nℹ️ Configuración de optimización:'));
    console.log(`  - Tamaño de lote: ${config.batchSize} inmuebles por lote`);
    console.log(`  - Imágenes concurrentes: ${config.maxConcurrentImages} por inmueble`);
    console.log(`  - Calidad de imágenes: ${config.imageQuality}%`);
    console.log(`  - Ancho máximo de imágenes: ${config.imageWidth}px`);
  } else {
    console.log(chalk.yellow(chalk.bold('⚠️ OPTIMIZACIÓN AVANZADA COMPLETADA CON ADVERTENCIAS')));
    console.log(chalk.yellow('Revise los mensajes anteriores y corrija los problemas antes de ejecutar la sincronización.'));
  }
  
  console.log(chalk.bold('======================================================================'));
}

// Ejecutar la función principal
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red(`Error fatal: ${error.message}`));
    process.exit(1);
  });
