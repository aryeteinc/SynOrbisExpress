/**
 * Script para optimizar imágenes de inmuebles
 * 
 * Este script comprime y optimiza las imágenes existentes para mejorar
 * el rendimiento y reducir el espacio de almacenamiento.
 * 
 * Requiere instalar sharp: npm install sharp
 * 
 * Uso:
 * node scripts/optimize-images.js [--quality=80] [--width=800] [--folder=path/to/images]
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// Verificar si sharp está instalado
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('\x1b[31m❌ El módulo sharp no está instalado. Instálelo con: npm install sharp\x1b[0m');
  process.exit(1);
}

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos de línea de comandos
const args = process.argv.slice(2);
const options = {
  quality: 80,
  width: 800,
  folder: process.env.IMAGES_FOLDER || path.join(__dirname, '../public/images/inmuebles')
};

// Parsear argumentos
args.forEach(arg => {
  if (arg.startsWith('--quality=')) {
    options.quality = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--width=')) {
    options.width = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--folder=')) {
    options.folder = arg.split('=')[1];
  }
});

// Validar opciones
if (options.quality < 1 || options.quality > 100) {
  console.error('\x1b[31m❌ La calidad debe estar entre 1 y 100\x1b[0m');
  process.exit(1);
}

if (options.width < 100) {
  console.error('\x1b[31m❌ El ancho mínimo debe ser al menos 100 píxeles\x1b[0m');
  process.exit(1);
}

// Verificar que la carpeta de imágenes existe
if (!fs.existsSync(options.folder)) {
  console.error(`\x1b[31m❌ La carpeta de imágenes no existe: ${options.folder}\x1b[0m`);
  process.exit(1);
}

/**
 * Optimiza una imagen
 * @param {string} inputPath - Ruta de la imagen de entrada
 * @param {string} outputPath - Ruta donde guardar la imagen optimizada
 * @param {object} options - Opciones de optimización
 * @returns {Promise<object>} - Información sobre la optimización
 */
async function optimizeImage(inputPath, outputPath, options) {
  // Obtener información de la imagen original
  const originalStats = fs.statSync(inputPath);
  const originalSize = originalStats.size;
  
  try {
    // Procesar la imagen con sharp
    await sharp(inputPath)
      .resize(options.width) // Redimensionar manteniendo la proporción
      .jpeg({ quality: options.quality }) // Comprimir con la calidad especificada
      .toFile(outputPath);
    
    // Obtener información de la imagen optimizada
    const optimizedStats = fs.statSync(outputPath);
    const optimizedSize = optimizedStats.size;
    
    // Calcular reducción de tamaño
    const reduction = originalSize - optimizedSize;
    const reductionPercent = (reduction / originalSize) * 100;
    
    return {
      originalSize,
      optimizedSize,
      reduction,
      reductionPercent
    };
  } catch (error) {
    console.error(`\x1b[31mError al optimizar ${inputPath}: ${error.message}\x1b[0m`);
    return null;
  }
}

/**
 * Recorre recursivamente un directorio y optimiza todas las imágenes
 * @param {string} directory - Directorio a procesar
 * @param {object} options - Opciones de optimización
 * @returns {Promise<object>} - Estadísticas de optimización
 */
async function processDirectory(directory, options) {
  const stats = {
    processed: 0,
    skipped: 0,
    failed: 0,
    totalOriginalSize: 0,
    totalOptimizedSize: 0,
    totalReduction: 0
  };
  
  // Leer contenido del directorio
  const items = fs.readdirSync(directory);
  
  for (const item of items) {
    const itemPath = path.join(directory, item);
    const itemStat = fs.statSync(itemPath);
    
    if (itemStat.isDirectory()) {
      // Procesar subdirectorio recursivamente
      const subStats = await processDirectory(itemPath, options);
      
      // Acumular estadísticas
      stats.processed += subStats.processed;
      stats.skipped += subStats.skipped;
      stats.failed += subStats.failed;
      stats.totalOriginalSize += subStats.totalOriginalSize;
      stats.totalOptimizedSize += subStats.totalOptimizedSize;
      stats.totalReduction += subStats.totalReduction;
    } else if (itemStat.isFile()) {
      // Verificar si es una imagen
      const ext = path.extname(itemPath).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        // Crear nombre para archivo optimizado
        const optimizedPath = itemPath.replace(ext, `_optimized${ext}`);
        
        // Verificar si la imagen ya fue optimizada previamente
        if (fs.existsSync(optimizedPath)) {
          console.log(`\x1b[33mSaltando imagen ya optimizada: ${itemPath}\x1b[0m`);
          stats.skipped++;
          continue;
        }
        
        console.log(`Optimizando: ${itemPath}`);
        
        // Optimizar la imagen
        const result = await optimizeImage(itemPath, optimizedPath, options);
        
        if (result) {
          stats.processed++;
          stats.totalOriginalSize += result.originalSize;
          stats.totalOptimizedSize += result.optimizedSize;
          stats.totalReduction += result.reduction;
          
          console.log(`\x1b[32m✓ Optimizado: ${itemPath} (${(result.originalSize / 1024).toFixed(2)} KB → ${(result.optimizedSize / 1024).toFixed(2)} KB, -${result.reductionPercent.toFixed(2)}%)\x1b[0m`);
          
          // Si la optimización fue exitosa, reemplazar la imagen original
          fs.unlinkSync(itemPath);
          fs.renameSync(optimizedPath, itemPath);
        } else {
          stats.failed++;
          
          // Eliminar el archivo optimizado si existe pero falló
          if (fs.existsSync(optimizedPath)) {
            fs.unlinkSync(optimizedPath);
          }
        }
      }
    }
  }
  
  return stats;
}

/**
 * Función principal
 */
async function main() {
  console.log('\x1b[1m======================================================================\x1b[0m');
  console.log('\x1b[1mOPTIMIZACIÓN DE IMÁGENES PARA SYNCORBISEXPRESS\x1b[0m');
  console.log('\x1b[1m======================================================================\x1b[0m');
  
  console.log(`\x1b[34mCarpeta de imágenes: ${options.folder}\x1b[0m`);
  console.log(`\x1b[34mCalidad de compresión: ${options.quality}%\x1b[0m`);
  console.log(`\x1b[34mAncho máximo: ${options.width}px\x1b[0m`);
  
  console.log('\nIniciando optimización de imágenes...\n');
  
  // Procesar el directorio de imágenes
  const startTime = Date.now();
  const stats = await processDirectory(options.folder, options);
  const endTime = Date.now();
  
  // Calcular tiempo total
  const totalTime = (endTime - startTime) / 1000;
  
  console.log('\n\x1b[1m======================================================================\x1b[0m');
  console.log('\x1b[1mRESULTADOS DE LA OPTIMIZACIÓN\x1b[0m');
  console.log('\x1b[1m======================================================================\x1b[0m');
  
  console.log(`\x1b[32mImágenes procesadas: ${stats.processed}\x1b[0m`);
  console.log(`\x1b[33mImágenes saltadas: ${stats.skipped}\x1b[0m`);
  console.log(`\x1b[31mImágenes fallidas: ${stats.failed}\x1b[0m`);
  
  if (stats.processed > 0) {
    const reductionPercent = (stats.totalReduction / stats.totalOriginalSize) * 100;
    
    console.log(`\nTamaño original total: ${(stats.totalOriginalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Tamaño optimizado total: ${(stats.totalOptimizedSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`\x1b[32mReducción total: ${(stats.totalReduction / (1024 * 1024)).toFixed(2)} MB (${reductionPercent.toFixed(2)}%)\x1b[0m`);
  }
  
  console.log(`\nTiempo total: ${totalTime.toFixed(2)} segundos`);
  
  console.log('\n\x1b[1m======================================================================\x1b[0m');
  console.log('\x1b[32m\x1b[1m✓ OPTIMIZACIÓN DE IMÁGENES COMPLETADA\x1b[0m');
  console.log('\x1b[1m======================================================================\x1b[0m');
}

// Ejecutar la función principal
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\x1b[31mError fatal: ${error.message}\x1b[0m`);
    process.exit(1);
  });
