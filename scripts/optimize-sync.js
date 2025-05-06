/**
 * Script para optimizar la velocidad de sincronización
 * 
 * Este script realiza varias optimizaciones en la base de datos y en el proceso
 * de sincronización para mejorar el rendimiento.
 * 
 * Uso:
 * node scripts/optimize-sync.js
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');
const dotenv = require('dotenv');
const { execSync } = require('child_process');
const chalk = require('chalk') || { green: (t) => t, yellow: (t) => t, red: (t) => t, blue: (t) => t, bold: (t) => t };

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
  imagesFolder: process.env.IMAGES_FOLDER || path.join(__dirname, '../public/images/inmuebles')
};

// Inicializar conexión a la base de datos
let db;

/**
 * Optimiza la base de datos
 */
async function optimizeDatabase() {
  console.log(chalk.bold('\n=== Optimizando la base de datos ==='));
  
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
      console.error(chalk.red('❌ Tipo de base de datos no soportado.'));
      return false;
    }
    
    // Probar la conexión
    await db.raw('SELECT 1');
    console.log(chalk.green('✅ Conexión a la base de datos establecida correctamente.'));
    
    // 1. Crear índices para mejorar el rendimiento
    console.log('Creando índices para mejorar el rendimiento...');
    
    const tablesToIndex = [
      { 
        table: 'inmuebles', 
        indices: [
          { name: 'idx_inmuebles_ref', columns: ['ref'] },
          { name: 'idx_inmuebles_codigo_sincronizacion', columns: ['codigo_sincronizacion'] },
          { name: 'idx_inmuebles_slug', columns: ['slug'] },
          { name: 'idx_inmuebles_ciudad_id', columns: ['ciudad_id'] },
          { name: 'idx_inmuebles_barrio_id', columns: ['barrio_id'] },
          { name: 'idx_inmuebles_tipo_inmueble_id', columns: ['tipo_inmueble_id'] },
          { name: 'idx_inmuebles_uso_id', columns: ['uso_id'] },
          { name: 'idx_inmuebles_estado_actual_id', columns: ['estado_actual_id'] }
        ]
      },
      {
        table: 'imagenes',
        indices: [
          { name: 'idx_imagenes_inmueble_id', columns: ['inmueble_id'] },
          { name: 'idx_imagenes_es_principal', columns: ['es_principal'] }
        ]
      },
      {
        table: 'inmueble_caracteristicas',
        indices: [
          { name: 'idx_inmueble_caracteristicas_inmueble_id', columns: ['inmueble_id'] },
          { name: 'idx_inmueble_caracteristicas_caracteristica_id', columns: ['caracteristica_id'] }
        ]
      },
      {
        table: 'inmuebles_etiquetas',
        indices: [
          { name: 'idx_inmuebles_etiquetas_inmueble_id', columns: ['inmueble_id'] },
          { name: 'idx_inmuebles_etiquetas_etiqueta_id', columns: ['etiqueta_id'] }
        ]
      }
    ];
    
    for (const tableInfo of tablesToIndex) {
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
            console.log(chalk.green(`✅ Índice ${index.name} creado en la tabla ${tableInfo.table}.`));
          } else {
            console.log(chalk.blue(`ℹ️ El índice ${index.name} ya existe en la tabla ${tableInfo.table}.`));
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error creando índice ${index.name} en la tabla ${tableInfo.table}: ${error.message}`));
        }
      }
    }
    
    // 2. Optimizar tablas
    console.log('\nOptimizando tablas...');
    
    const tablesToOptimize = [
      'inmuebles', 'imagenes', 'inmueble_caracteristicas', 'inmuebles_etiquetas',
      'ciudades', 'barrios', 'tipos_inmueble', 'usos_inmueble', 'estados_inmueble'
    ];
    
    for (const table of tablesToOptimize) {
      const tableExists = await db.schema.hasTable(table);
      
      if (!tableExists) {
        console.log(chalk.yellow(`⚠️ Tabla ${table} no existe, no se puede optimizar.`));
        continue;
      }
      
      try {
        await db.raw(`OPTIMIZE TABLE ${table}`);
        console.log(chalk.green(`✅ Tabla ${table} optimizada.`));
      } catch (error) {
        console.error(chalk.red(`❌ Error optimizando tabla ${table}: ${error.message}`));
      }
    }
    
    // 3. Configurar variables de MySQL para mejorar el rendimiento
    console.log('\nConfigurando variables de MySQL para mejorar el rendimiento...');
    
    try {
      // Aumentar el tamaño del buffer de consultas
      await db.raw('SET GLOBAL innodb_buffer_pool_size = 268435456'); // 256MB
      
      // Aumentar el tamaño del buffer de consultas
      await db.raw('SET GLOBAL query_cache_size = 67108864'); // 64MB
      
      // Configurar el tiempo máximo de ejecución de consultas
      await db.raw('SET GLOBAL max_execution_time = 30000'); // 30 segundos
      
      // Configurar el tamaño máximo de paquetes
      await db.raw('SET GLOBAL max_allowed_packet = 67108864'); // 64MB
      
      console.log(chalk.green('✅ Variables de MySQL configuradas correctamente.'));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ No se pudieron configurar algunas variables de MySQL: ${error.message}`));
      console.log(chalk.yellow('Esto no afecta la funcionalidad, solo el rendimiento.'));
    }
    
    // 4. Analizar tablas para actualizar estadísticas
    console.log('\nAnalizando tablas para actualizar estadísticas...');
    
    for (const table of tablesToOptimize) {
      const tableExists = await db.schema.hasTable(table);
      
      if (!tableExists) {
        continue;
      }
      
      try {
        await db.raw(`ANALYZE TABLE ${table}`);
        console.log(chalk.green(`✅ Tabla ${table} analizada.`));
      } catch (error) {
        console.error(chalk.red(`❌ Error analizando tabla ${table}: ${error.message}`));
      }
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error optimizando la base de datos: ${error.message}`));
    return false;
  } finally {
    // Cerrar la conexión a la base de datos
    if (db) {
      await db.destroy();
    }
  }
}

/**
 * Optimiza el script de sincronización
 */
async function optimizeSyncScript() {
  console.log(chalk.bold('\n=== Optimizando el script de sincronización ==='));
  
  try {
    const syncFilePath = path.join(__dirname, 'sync-js.js');
    
    if (!fs.existsSync(syncFilePath)) {
      console.error(chalk.red(`❌ No se encontró el archivo ${syncFilePath}.`));
      return false;
    }
    
    console.log('Verificando el script de sincronización...');
    
    // Leer el contenido del archivo
    let content = fs.readFileSync(syncFilePath, 'utf8');
    let modified = false;
    
    // 1. Verificar y añadir configuración de batch processing
    if (!content.includes('batchSize') || !content.includes('processBatch')) {
      console.log(chalk.yellow('⚠️ No se encontró configuración de procesamiento por lotes.'));
      console.log(chalk.yellow('Se recomienda implementar procesamiento por lotes para mejorar el rendimiento.'));
      
      // No modificamos automáticamente el script porque podría ser complejo
    }
    
    // 2. Verificar y añadir configuración de caché
    if (!content.includes('cacheManager') && !content.includes('cache')) {
      console.log(chalk.yellow('⚠️ No se encontró configuración de caché.'));
      console.log(chalk.yellow('Se recomienda implementar un sistema de caché para mejorar el rendimiento.'));
      
      // No modificamos automáticamente el script porque podría ser complejo
    }
    
    // 3. Verificar y añadir configuración de consultas preparadas
    if (!content.includes('preparedStatement') && !content.includes('prepared statement')) {
      console.log(chalk.yellow('⚠️ No se encontró configuración de consultas preparadas.'));
      console.log(chalk.yellow('Se recomienda utilizar consultas preparadas para mejorar el rendimiento.'));
      
      // No modificamos automáticamente el script porque podría ser complejo
    }
    
    // 4. Verificar y añadir configuración de transacciones
    if (!content.includes('transaction') || !content.includes('trx.commit')) {
      console.log(chalk.yellow('⚠️ No se encontró configuración de transacciones.'));
      console.log(chalk.yellow('Se recomienda utilizar transacciones para mejorar el rendimiento y la integridad de los datos.'));
      
      // No modificamos automáticamente el script porque podría ser complejo
    }
    
    console.log(chalk.blue('ℹ️ Se han identificado posibles mejoras en el script de sincronización.'));
    console.log(chalk.blue('ℹ️ Consulte la documentación para implementar estas mejoras.'));
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error optimizando el script de sincronización: ${error.message}`));
    return false;
  }
}

/**
 * Optimiza el directorio de imágenes
 */
async function optimizeImagesDirectory() {
  console.log(chalk.bold('\n=== Optimizando el directorio de imágenes ==='));
  
  try {
    if (!fs.existsSync(config.imagesFolder)) {
      console.log(chalk.yellow(`⚠️ El directorio de imágenes ${config.imagesFolder} no existe.`));
      console.log(chalk.yellow('Creando directorio de imágenes...'));
      
      fs.mkdirSync(config.imagesFolder, { recursive: true });
      console.log(chalk.green('✅ Directorio de imágenes creado correctamente.'));
    } else {
      console.log(chalk.green('✅ El directorio de imágenes existe.'));
    }
    
    // Verificar permisos
    try {
      const testFile = path.join(config.imagesFolder, '.test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(chalk.green('✅ Permisos de escritura verificados correctamente.'));
    } catch (error) {
      console.error(chalk.red(`❌ Error verificando permisos de escritura: ${error.message}`));
      console.log(chalk.yellow('⚠️ Es posible que no tenga permisos de escritura en el directorio de imágenes.'));
      console.log(chalk.yellow('Ejecute el siguiente comando para corregir los permisos:'));
      console.log(chalk.yellow(`chmod -R 755 ${config.imagesFolder}`));
      console.log(chalk.yellow(`chown -R $(whoami) ${config.imagesFolder}`));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error optimizando el directorio de imágenes: ${error.message}`));
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log(chalk.bold('======================================================================'));
  console.log(chalk.bold('OPTIMIZACIÓN DE SYNCORBISEXPRESS'));
  console.log(chalk.bold('======================================================================'));
  
  let success = true;
  
  // Optimizar la base de datos
  if (!(await optimizeDatabase())) {
    success = false;
  }
  
  // Optimizar el script de sincronización
  if (!(await optimizeSyncScript())) {
    success = false;
  }
  
  // Optimizar el directorio de imágenes
  if (!(await optimizeImagesDirectory())) {
    success = false;
  }
  
  console.log(chalk.bold('\n======================================================================'));
  
  if (success) {
    console.log(chalk.green(chalk.bold('✅ OPTIMIZACIÓN COMPLETADA CORRECTAMENTE')));
    console.log(chalk.green('La sincronización debería ser más rápida ahora.'));
    console.log(chalk.green('Puede ejecutar la sincronización con:'));
    console.log(chalk.green('node scripts/sync-js.js'));
  } else {
    console.log(chalk.yellow(chalk.bold('⚠️ OPTIMIZACIÓN COMPLETADA CON ADVERTENCIAS')));
    console.log(chalk.yellow('Revise los mensajes anteriores y corrija los problemas antes de ejecutar la sincronización.'));
  }
  
  console.log(chalk.bold('======================================================================'));
}

// Ejecutar la función principal
main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red(`Error en el proceso principal: ${error.message}`));
    process.exit(1);
  });
