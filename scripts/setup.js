/**
 * Script de instalación y verificación para SyncOrbisExpress
 * 
 * Este script verifica el entorno, la estructura de la base de datos y realiza
 * las correcciones necesarias para garantizar que la aplicación funcione correctamente.
 * 
 * Uso:
 * node scripts/setup.js [--force]
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');
const dotenv = require('dotenv');
const { execSync } = require('child_process');
const chalk = require('chalk') || { green: (t) => t, yellow: (t) => t, red: (t) => t, blue: (t) => t, bold: (t) => t };

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos
const args = process.argv.slice(2);
const force = args.includes('--force');

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
 * Verifica las dependencias de Node.js
 */
async function checkNodeDependencies() {
  console.log(chalk.bold('\n=== Verificando dependencias de Node.js ==='));
  
  try {
    // Verificar que las dependencias estén instaladas
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    
    console.log(`Dependencias requeridas: ${dependencies.length}`);
    
    // Verificar node_modules
    if (!fs.existsSync(path.join(__dirname, '../node_modules'))) {
      console.log(chalk.yellow('⚠️ El directorio node_modules no existe.'));
      console.log(chalk.yellow('Ejecutando npm install...'));
      
      try {
        execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
        console.log(chalk.green('✅ Dependencias instaladas correctamente.'));
      } catch (error) {
        console.error(chalk.red(`❌ Error instalando dependencias: ${error.message}`));
        return false;
      }
    } else {
      console.log(chalk.green('✅ El directorio node_modules existe.'));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error verificando dependencias: ${error.message}`));
    return false;
  }
}

/**
 * Verifica la configuración del entorno
 */
async function checkEnvironment() {
  console.log(chalk.bold('\n=== Verificando configuración del entorno ==='));
  
  // Verificar archivo .env
  if (!fs.existsSync(path.join(__dirname, '../.env'))) {
    console.log(chalk.yellow('⚠️ El archivo .env no existe.'));
    
    // Verificar si existe .env.example
    if (fs.existsSync(path.join(__dirname, '../.env.example'))) {
      console.log(chalk.yellow('Copiando .env.example a .env...'));
      fs.copyFileSync(path.join(__dirname, '../.env.example'), path.join(__dirname, '../.env'));
      console.log(chalk.green('✅ Archivo .env creado desde .env.example.'));
      console.log(chalk.yellow('⚠️ Por favor, edite el archivo .env con sus credenciales.'));
    } else {
      console.log(chalk.red('❌ No se encontró el archivo .env.example.'));
      console.log(chalk.yellow('Creando un archivo .env básico...'));
      
      const envContent = `# Configuración de la base de datos
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_DATABASE=inmuebles

# Configuración de la API
API_URL=https://api.example.com
API_KEY=your_api_key

# Configuración de la aplicación
IMAGES_FOLDER=${path.join(__dirname, '../public/images/inmuebles')}
`;
      
      fs.writeFileSync(path.join(__dirname, '../.env'), envContent);
      console.log(chalk.green('✅ Archivo .env básico creado.'));
      console.log(chalk.yellow('⚠️ Por favor, edite el archivo .env con sus credenciales.'));
    }
    
    // Recargar variables de entorno
    dotenv.config();
  } else {
    console.log(chalk.green('✅ El archivo .env existe.'));
  }
  
  // Verificar directorio de imágenes
  if (!fs.existsSync(config.imagesFolder)) {
    console.log(chalk.yellow(`⚠️ El directorio de imágenes ${config.imagesFolder} no existe.`));
    console.log(chalk.yellow('Creando directorio de imágenes...'));
    
    try {
      fs.mkdirSync(config.imagesFolder, { recursive: true });
      console.log(chalk.green('✅ Directorio de imágenes creado correctamente.'));
    } catch (error) {
      console.error(chalk.red(`❌ Error creando directorio de imágenes: ${error.message}`));
      return false;
    }
  } else {
    console.log(chalk.green('✅ El directorio de imágenes existe.'));
  }
  
  return true;
}

/**
 * Verifica la conexión a la base de datos
 */
async function checkDatabase() {
  console.log(chalk.bold('\n=== Verificando conexión a la base de datos ==='));
  
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
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error conectando a la base de datos: ${error.message}`));
    
    if (error.message.includes('Unknown database')) {
      console.log(chalk.yellow('⚠️ La base de datos no existe.'));
      console.log(chalk.yellow('Intentando crear la base de datos...'));
      
      try {
        // Crear una conexión sin especificar la base de datos
        const tempDb = knex({
          client: 'mysql2',
          connection: {
            host: config.mysqlHost,
            port: config.mysqlPort,
            user: config.mysqlUser,
            password: config.mysqlPassword
          }
        });
        
        // Crear la base de datos
        await tempDb.raw(`CREATE DATABASE IF NOT EXISTS \`${config.mysqlDatabase}\``);
        console.log(chalk.green(`✅ Base de datos ${config.mysqlDatabase} creada correctamente.`));
        
        // Cerrar la conexión temporal
        await tempDb.destroy();
        
        // Reintentar la conexión con la base de datos
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
        
        await db.raw('SELECT 1');
        console.log(chalk.green('✅ Conexión a la base de datos establecida correctamente.'));
        
        return true;
      } catch (createError) {
        console.error(chalk.red(`❌ Error creando la base de datos: ${createError.message}`));
        return false;
      }
    }
    
    return false;
  }
}

/**
 * Verifica la estructura de la base de datos
 */
async function checkDatabaseStructure() {
  console.log(chalk.bold('\n=== Verificando estructura de la base de datos ==='));
  
  try {
    // Verificar si las tablas existen
    const requiredTables = [
      'inmuebles', 'imagenes', 'ciudades', 'barrios', 'tipos_inmueble',
      'usos_inmueble', 'estados_inmueble', 'asesores', 'caracteristicas',
      'inmueble_caracteristicas', 'etiquetas', 'inmuebles_etiquetas'
    ];
    
    let allTablesExist = true;
    const existingTables = [];
    
    for (const table of requiredTables) {
      const exists = await db.schema.hasTable(table);
      if (exists) {
        existingTables.push(table);
      } else {
        allTablesExist = false;
        console.log(chalk.yellow(`⚠️ La tabla ${table} no existe.`));
      }
    }
    
    if (existingTables.length > 0) {
      console.log(chalk.green(`✅ Tablas existentes: ${existingTables.join(', ')}`));
    }
    
    if (!allTablesExist) {
      console.log(chalk.yellow('⚠️ Algunas tablas requeridas no existen.'));
      
      if (force) {
        console.log(chalk.yellow('Ejecutando script de reinicio de base de datos...'));
        
        try {
          execSync('node scripts/reset-db.js --confirmar', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
          console.log(chalk.green('✅ Base de datos reiniciada correctamente.'));
        } catch (error) {
          console.error(chalk.red(`❌ Error reiniciando la base de datos: ${error.message}`));
          return false;
        }
      } else {
        console.log(chalk.yellow('Ejecute el siguiente comando para crear las tablas:'));
        console.log(chalk.yellow('node scripts/reset-db.js --confirmar'));
        return false;
      }
    }
    
    // Verificar la estructura de la tabla inmuebles
    if (await db.schema.hasTable('inmuebles')) {
      console.log('Verificando estructura de la tabla inmuebles...');
      
      // Verificar columnas específicas
      const requiredColumns = [
        'area_construida', 'area_privada', 'area_terreno', 'slug'
      ];
      
      let allColumnsExist = true;
      const missingColumns = [];
      
      for (const column of requiredColumns) {
        const exists = await db.schema.hasColumn('inmuebles', column);
        if (!exists) {
          allColumnsExist = false;
          missingColumns.push(column);
        }
      }
      
      if (!allColumnsExist) {
        console.log(chalk.yellow(`⚠️ Las siguientes columnas faltan en la tabla inmuebles: ${missingColumns.join(', ')}`));
        console.log(chalk.yellow('Añadiendo columnas faltantes...'));
        
        // Añadir columnas faltantes
        await db.schema.table('inmuebles', table => {
          if (missingColumns.includes('area_construida')) {
            table.float('area_construida').nullable();
          }
          if (missingColumns.includes('area_privada')) {
            table.float('area_privada').nullable();
          }
          if (missingColumns.includes('area_terreno')) {
            table.float('area_terreno').nullable();
          }
          if (missingColumns.includes('slug')) {
            table.string('slug').nullable();
          }
        });
        
        console.log(chalk.green('✅ Columnas añadidas correctamente.'));
      } else {
        console.log(chalk.green('✅ La estructura de la tabla inmuebles es correcta.'));
      }
    }
    
    // Optimizar la base de datos
    console.log('Optimizando la base de datos...');
    
    // Añadir índices si no existen
    if (await db.schema.hasTable('inmuebles')) {
      // Verificar si el índice existe antes de crearlo
      const indexesResult = await db.raw(`SHOW INDEX FROM inmuebles WHERE Key_name = 'idx_inmuebles_codigo_sincronizacion'`);
      
      if (indexesResult[0].length === 0) {
        console.log('Creando índices para la tabla inmuebles...');
        
        try {
          await db.raw('CREATE INDEX idx_inmuebles_codigo_sincronizacion ON inmuebles (codigo_sincronizacion)');
          await db.raw('CREATE INDEX idx_inmuebles_ref ON inmuebles (ref)');
          await db.raw('CREATE INDEX idx_inmuebles_slug ON inmuebles (slug)');
          
          console.log(chalk.green('✅ Índices creados correctamente.'));
        } catch (error) {
          console.error(chalk.red(`❌ Error creando índices: ${error.message}`));
        }
      } else {
        console.log(chalk.green('✅ Los índices ya existen.'));
      }
    }
    
    // Optimizar tablas
    try {
      await db.raw('OPTIMIZE TABLE inmuebles, imagenes, inmueble_caracteristicas');
      console.log(chalk.green('✅ Tablas optimizadas correctamente.'));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ No se pudieron optimizar las tablas: ${error.message}`));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error verificando la estructura de la base de datos: ${error.message}`));
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log(chalk.bold('======================================================================'));
  console.log(chalk.bold('INSTALACIÓN Y VERIFICACIÓN DE SYNCORBISEXPRESS'));
  console.log(chalk.bold('======================================================================'));
  
  let success = true;
  
  // Verificar dependencias de Node.js
  if (!(await checkNodeDependencies())) {
    success = false;
  }
  
  // Verificar configuración del entorno
  if (!(await checkEnvironment())) {
    success = false;
  }
  
  // Verificar conexión a la base de datos
  if (!(await checkDatabase())) {
    success = false;
  } else {
    // Verificar estructura de la base de datos
    if (!(await checkDatabaseStructure())) {
      success = false;
    }
  }
  
  // Cerrar la conexión a la base de datos
  if (db) {
    await db.destroy();
  }
  
  console.log(chalk.bold('\n======================================================================'));
  
  if (success) {
    console.log(chalk.green(chalk.bold('✅ INSTALACIÓN Y VERIFICACIÓN COMPLETADA CORRECTAMENTE')));
    console.log(chalk.green('Puede ejecutar la sincronización con:'));
    console.log(chalk.green('node scripts/sync-js.js'));
  } else {
    console.log(chalk.yellow(chalk.bold('⚠️ INSTALACIÓN Y VERIFICACIÓN COMPLETADA CON ADVERTENCIAS')));
    console.log(chalk.yellow('Revise los mensajes anteriores y corrija los problemas antes de ejecutar la sincronización.'));
    console.log(chalk.yellow('Para forzar la instalación, ejecute:'));
    console.log(chalk.yellow('node scripts/setup.js --force'));
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
