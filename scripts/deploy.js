/**
 * Script de despliegue para producción
 * Este script prepara la aplicación para producción, compilando el código TypeScript
 * y copiando los archivos necesarios a la carpeta de distribución.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

// Función para ejecutar comandos y mostrar la salida
function runCommand(command, message) {
  console.log(`${colors.bright}${colors.blue}==> ${message}${colors.reset}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`${colors.red}Error al ejecutar: ${command}${colors.reset}`);
    return false;
  }
}

// Función para crear un archivo .env para producción
function createProductionEnv() {
  console.log(`${colors.bright}${colors.blue}==> Creando archivo .env para producción${colors.reset}`);
  
  if (!fs.existsSync('.env')) {
    console.error(`${colors.red}No se encontró el archivo .env de desarrollo${colors.reset}`);
    return false;
  }
  
  try {
    // Leer el archivo .env actual
    const envContent = fs.readFileSync('.env', 'utf8');
    
    // Modificar las variables para producción
    const prodEnvContent = envContent
      .replace(/NODE_ENV=development/g, 'NODE_ENV=production')
      .replace(/DB_TYPE=sqlite/g, 'DB_TYPE=mysql') // Cambiar a MySQL si es necesario
      .replace(/# DB_TYPE=mysql/g, 'DB_TYPE=mysql');
    
    // Guardar el archivo .env.production
    fs.writeFileSync('dist/.env', prodEnvContent);
    console.log(`${colors.green}Archivo .env para producción creado correctamente${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Error al crear el archivo .env para producción: ${error.message}${colors.reset}`);
    return false;
  }
}

// Función para copiar archivos adicionales necesarios para producción
function copyAdditionalFiles() {
  console.log(`${colors.bright}${colors.blue}==> Copiando archivos adicionales${colors.reset}`);
  
  const filesToCopy = [
    'package.json',
    'package-lock.json',
    'README.md',
    'docs'
  ];
  
  try {
    // Crear carpeta docs en dist si no existe
    if (!fs.existsSync('dist/docs')) {
      fs.mkdirSync('dist/docs', { recursive: true });
    }
    
    // Copiar archivos
    for (const file of filesToCopy) {
      if (fs.existsSync(file)) {
        if (fs.lstatSync(file).isDirectory()) {
          // Es un directorio, copiar recursivamente
          runCommand(`cp -R ${file} dist/`, `Copiando directorio ${file}`);
        } else {
          // Es un archivo, copiar directamente
          fs.copyFileSync(file, `dist/${file}`);
          console.log(`${colors.green}Archivo ${file} copiado correctamente${colors.reset}`);
        }
      } else {
        console.log(`${colors.yellow}Advertencia: El archivo ${file} no existe y no se copiará${colors.reset}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Error al copiar archivos adicionales: ${error.message}${colors.reset}`);
    return false;
  }
}

// Función para crear un archivo package.json optimizado para producción
function createProductionPackageJson() {
  console.log(`${colors.bright}${colors.blue}==> Creando package.json optimizado para producción${colors.reset}`);
  
  try {
    // Leer el package.json actual
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Crear una versión optimizada para producción
    const prodPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        sync: 'node scripts/sync-js.js',
        'clean-syncs': 'node scripts/clean-syncs.js',
        'reset-db': 'node scripts/reset-db.js'
      },
      dependencies: packageJson.dependencies,
      author: packageJson.author,
      license: packageJson.license
    };
    
    // Guardar el package.json optimizado
    fs.writeFileSync('dist/package.json', JSON.stringify(prodPackageJson, null, 2));
    console.log(`${colors.green}Archivo package.json optimizado creado correctamente${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Error al crear el package.json optimizado: ${error.message}${colors.reset}`);
    return false;
  }
}

// Función principal
async function deploy() {
  console.log(`${colors.bright}${colors.yellow}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}                DESPLIEGUE DE SYNCORBIS EXPRESS                       ${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}======================================================================${colors.reset}`);
  
  // Paso 1: Limpiar la carpeta dist
  if (!runCommand('npm run clean', 'Limpiando carpeta dist')) {
    return;
  }
  
  // Paso 2: Compilar TypeScript
  if (!runCommand('npx tsc', 'Compilando código TypeScript')) {
    return;
  }
  
  // Paso 3: Copiar scripts JavaScript
  if (!runCommand('mkdir -p dist/scripts && cp scripts/*.js dist/scripts/', 'Copiando scripts JavaScript')) {
    return;
  }
  
  // Paso 4: Crear archivo .env para producción
  if (!createProductionEnv()) {
    return;
  }
  
  // Paso 5: Copiar archivos adicionales
  if (!copyAdditionalFiles()) {
    return;
  }
  
  // Paso 6: Crear package.json optimizado
  if (!createProductionPackageJson()) {
    return;
  }
  
  // Paso 7: Crear carpeta para imágenes
  if (!runCommand('mkdir -p dist/imagenes_inmuebles', 'Creando carpeta para imágenes')) {
    return;
  }
  
  console.log(`${colors.bright}${colors.green}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.green}                DESPLIEGUE COMPLETADO EXITOSAMENTE                    ${colors.reset}`);
  console.log(`${colors.bright}${colors.green}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}Los archivos para producción están disponibles en la carpeta dist/${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}Para iniciar la aplicación en producción:${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}1. Copia la carpeta dist/ a tu servidor${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}2. Ejecuta 'npm install --production' dentro de la carpeta dist/${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}3. Ejecuta 'npm start' para iniciar la aplicación${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}======================================================================${colors.reset}`);
}

// Ejecutar la función principal
deploy().catch(error => {
  console.error(`${colors.red}Error durante el despliegue: ${error.message}${colors.reset}`);
  process.exit(1);
});
