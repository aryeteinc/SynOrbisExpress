/**
 * Script para ofuscar el código JavaScript de producción
 * Este script utiliza JavaScript-Obfuscator para proteger el código compilado
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

// Verificar si JavaScript-Obfuscator está instalado
try {
  execSync('npm list -g javascript-obfuscator', { stdio: 'ignore' });
} catch (error) {
  console.log(`${colors.bright}${colors.yellow}JavaScript-Obfuscator no está instalado globalmente. Instalándolo...${colors.reset}`);
  try {
    execSync('npm install -g javascript-obfuscator', { stdio: 'inherit' });
    console.log(`${colors.bright}${colors.green}JavaScript-Obfuscator instalado correctamente.${colors.reset}`);
  } catch (installError) {
    console.error(`${colors.bright}${colors.red}Error al instalar JavaScript-Obfuscator. Por favor, instálalo manualmente:${colors.reset}`);
    console.error(`${colors.bright}${colors.yellow}npm install -g javascript-obfuscator${colors.reset}`);
    process.exit(1);
  }
}

// Configuración de ofuscación
const obfuscationConfig = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.7,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  debugProtectionInterval: 0,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// Guardar la configuración en un archivo temporal
const configPath = path.join(__dirname, 'obfuscator-config.json');
fs.writeFileSync(configPath, JSON.stringify(obfuscationConfig, null, 2));

/**
 * Ofusca un archivo JavaScript
 * @param {string} filePath Ruta del archivo a ofuscar
 */
function obfuscateFile(filePath) {
  try {
    console.log(`${colors.bright}${colors.blue}Ofuscando: ${filePath}${colors.reset}`);
    
    // Crear una copia de seguridad del archivo original
    const backupPath = `${filePath}.backup`;
    fs.copyFileSync(filePath, backupPath);
    
    // Ofuscar el archivo
    execSync(`javascript-obfuscator ${filePath} --output ${filePath} --config ${configPath}`, { stdio: 'ignore' });
    
    // Eliminar la copia de seguridad
    fs.unlinkSync(backupPath);
    
    console.log(`${colors.bright}${colors.green}Ofuscado correctamente: ${filePath}${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.bright}${colors.red}Error al ofuscar ${filePath}: ${error.message}${colors.reset}`);
    
    // Restaurar desde la copia de seguridad si existe
    const backupPath = `${filePath}.backup`;
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
      console.log(`${colors.bright}${colors.yellow}Restaurado desde copia de seguridad: ${filePath}${colors.reset}`);
    }
    
    return false;
  }
}

/**
 * Recorre recursivamente un directorio y ofusca todos los archivos JavaScript
 * @param {string} dirPath Ruta del directorio a procesar
 * @param {Array<string>} excludeDirs Directorios a excluir
 * @returns {number} Número de archivos ofuscados
 */
function processDirectory(dirPath, excludeDirs = []) {
  let count = 0;
  
  // Verificar si el directorio debe ser excluido
  const dirName = path.basename(dirPath);
  if (excludeDirs.includes(dirName)) {
    console.log(`${colors.bright}${colors.yellow}Omitiendo directorio excluido: ${dirPath}${colors.reset}`);
    return 0;
  }
  
  // Obtener todos los archivos y directorios
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      // Procesar subdirectorio recursivamente
      count += processDirectory(itemPath, excludeDirs);
    } else if (stats.isFile() && item.endsWith('.js')) {
      // Ofuscar archivo JavaScript
      if (obfuscateFile(itemPath)) {
        count++;
      }
    }
  }
  
  return count;
}

/**
 * Función principal
 */
async function main() {
  console.log(`${colors.bright}${colors.yellow}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}                OFUSCACIÓN DE CÓDIGO PARA PRODUCCIÓN                  ${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}======================================================================${colors.reset}`);
  
  // Verificar que existe la carpeta dist
  const distPath = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    console.error(`${colors.bright}${colors.red}Error: La carpeta 'dist' no existe. Primero debes compilar el proyecto.${colors.reset}`);
    console.error(`${colors.bright}${colors.yellow}Ejecuta: npm run build:prod${colors.reset}`);
    process.exit(1);
  }
  
  // Directorios a excluir
  const excludeDirs = ['node_modules'];
  
  // Ofuscar todos los archivos JavaScript en la carpeta dist
  console.log(`${colors.bright}${colors.blue}Iniciando ofuscación de archivos JavaScript...${colors.reset}`);
  const count = processDirectory(distPath, excludeDirs);
  
  // Eliminar el archivo de configuración temporal
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
  
  console.log(`${colors.bright}${colors.green}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.green}                OFUSCACIÓN COMPLETADA EXITOSAMENTE                    ${colors.reset}`);
  console.log(`${colors.bright}${colors.green}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}Se han ofuscado ${count} archivos JavaScript.${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}======================================================================${colors.reset}`);
}

// Ejecutar la función principal
main().catch(error => {
  console.error(`${colors.bright}${colors.red}Error durante la ofuscación: ${error.message}${colors.reset}`);
  process.exit(1);
});
