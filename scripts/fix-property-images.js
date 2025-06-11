require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const crypto = require('crypto');
const sharp = require('sharp');

// Configuración de la base de datos
const knex = require('knex');
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

// Configuración de optimización de imágenes
const imageConfig = {
  quality: process.env.IMAGE_QUALITY ? parseInt(process.env.IMAGE_QUALITY) : 80,
  width: process.env.IMAGE_WIDTH ? parseInt(process.env.IMAGE_WIDTH) : 1200,
  maxConcurrent: process.env.MAX_CONCURRENT_IMAGES ? parseInt(process.env.MAX_CONCURRENT_IMAGES) : 3
};

// Estadísticas
const stats = {
  inicio: Date.now(),
  propiedadesTotal: 0,
  propiedadesProcesadas: 0,
  imagenesTotal: 0,
  imagenesDescargadas: 0,
  imagenesOptimizadas: 0,
  errores: 0,
  ahorroEspacio: 0
};

// Función para optimizar una imagen con Sharp
async function optimizeImage(inputPath, outputPath, options = {}) {
  try {
    // Opciones por defecto
    const defaults = {
      quality: imageConfig.quality,
      width: imageConfig.width
    };
    
    // Combinar opciones
    const opts = { ...defaults, ...options };
    
    // Obtener tamaño original
    const originalSize = fs.statSync(inputPath).size;
    
    // Procesar la imagen
    await sharp(inputPath)
      .resize(opts.width) // Redimensionar al ancho máximo
      .jpeg({ quality: opts.quality }) // Comprimir con la calidad especificada
      .toFile(outputPath);
    
    // Obtener tamaño optimizado
    const optimizedSize = fs.statSync(outputPath).size;
    
    // Calcular ahorro
    const savings = originalSize - optimizedSize;
    stats.ahorroEspacio += savings;
    
    return {
      originalSize,
      optimizedSize,
      savings,
      savingsPercent: ((savings / originalSize) * 100).toFixed(2)
    };
  } catch (error) {
    console.error(`Error al optimizar imagen: ${error.message}`);
    // Si hay un error, devolver null para indicar que no se pudo optimizar
    return null;
  }
}

// Función para descargar y procesar una imagen
async function downloadAndProcessImage(url, filePath) {
  try {
    // Crear directorio si no existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Descargar la imagen
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    
    // Guardar la imagen original en un archivo temporal
    const tempFilePath = `${filePath}.temp`;
    const writer = fs.createWriteStream(tempFilePath);
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          // Optimizar la imagen
          const optimizationResult = await optimizeImage(tempFilePath, filePath);
          
          if (optimizationResult) {
            console.log(`Imagen optimizada: ${path.basename(filePath)}`);
            console.log(`  - Tamaño original: ${(optimizationResult.originalSize / 1024).toFixed(2)} KB`);
            console.log(`  - Tamaño optimizado: ${(optimizationResult.optimizedSize / 1024).toFixed(2)} KB`);
            console.log(`  - Ahorro: ${(optimizationResult.savings / 1024).toFixed(2)} KB (${optimizationResult.savingsPercent}%)`);
            stats.imagenesOptimizadas++;
          } else {
            // Si la optimización falló, usar la imagen original
            fs.copyFileSync(tempFilePath, filePath);
          }
          
          // Eliminar el archivo temporal
          fs.unlinkSync(tempFilePath);
          
          stats.imagenesDescargadas++;
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
      
      writer.on('error', (error) => {
        // Eliminar el archivo temporal si existe
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Error al descargar/procesar imagen: ${error.message}`);
    return false;
  }
}

// Función para procesar imágenes en paralelo
async function processImagesParallel(propertyId, propertyRef, images, maxConcurrent = imageConfig.maxConcurrent) {
  console.log(`\nProcesando ${images.length} imágenes para inmueble #${propertyRef}`);
  
  // Verificar si ya existen imágenes en la base de datos para este inmueble
  const existingImages = await db('imagenes_inmueble')
    .where('inmueble_id', propertyId)
    .select('id', 'archivo', 'orden', 'hash');
  
  console.log(`Imágenes existentes en BD: ${existingImages.length}`);
  
  // Crear un mapa de imágenes existentes por orden para búsqueda rápida
  const existingImagesByOrder = {};
  existingImages.forEach(img => {
    existingImagesByOrder[img.orden] = img;
  });
  
  // Crear tareas para cada imagen
  const tasks = [];
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const orden = i + 1; // El orden comienza en 1
    
    // Verificar si ya existe una imagen con este orden
    const existingImage = existingImagesByOrder[orden];
    
    // Calcular hash de la URL para detectar cambios
    const urlHash = crypto.createHash('md5').update(image.url).digest('hex');
    
    // Crear nombre de archivo basado en la referencia del inmueble y el orden
    const fileExtension = path.extname(image.url) || '.jpg';
    const fileName = `${propertyRef}_${orden}${fileExtension}`;
    const filePath = path.join(imagesFolder, fileName);
    
    // Verificar si necesitamos descargar esta imagen
    const needsDownload = !existingImage || existingImage.hash !== urlHash || !fs.existsSync(path.join(imagesFolder, existingImage.archivo));
    
    tasks.push({
      image,
      orden,
      existingImage,
      urlHash,
      fileName,
      filePath,
      needsDownload,
      process: async () => {
        try {
          if (needsDownload) {
            console.log(`Descargando imagen ${orden}/${images.length} para inmueble #${propertyRef}`);
            await downloadAndProcessImage(image.url, filePath);
            
            // Actualizar o insertar en la base de datos
            if (existingImage) {
              await db('imagenes_inmueble')
                .where('id', existingImage.id)
                .update({
                  archivo: fileName,
                  hash: urlHash,
                  updated_at: db.fn.now()
                });
              console.log(`Imagen ${orden} actualizada en la base de datos`);
            } else {
              await db('imagenes_inmueble').insert({
                inmueble_id: propertyId,
                archivo: fileName,
                orden: orden,
                hash: urlHash,
                created_at: db.fn.now(),
                updated_at: db.fn.now()
              });
              console.log(`Imagen ${orden} insertada en la base de datos`);
            }
          } else {
            console.log(`Imagen ${orden} ya existe y está actualizada`);
          }
          return true;
        } catch (error) {
          console.error(`Error procesando imagen ${orden} para inmueble #${propertyRef}: ${error.message}`);
          stats.errores++;
          return false;
        }
      }
    });
  }
  
  // Procesar imágenes en lotes con concurrencia limitada
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent);
    console.log(`Procesando lote de imágenes ${i+1}-${Math.min(i+maxConcurrent, tasks.length)}/${tasks.length}`);
    
    const batchResults = await Promise.all(batch.map(task => task.process()));
    
    // Verificar resultados
    const successCount = batchResults.filter(result => result).length;
    console.log(`Lote completado: ${successCount}/${batch.length} imágenes procesadas correctamente`);
  }
  
  // Eliminar imágenes que ya no están en la API
  const currentOrders = images.map((_, idx) => idx + 1);
  const imagesToDelete = existingImages.filter(img => !currentOrders.includes(img.orden));
  
  if (imagesToDelete.length > 0) {
    console.log(`Eliminando ${imagesToDelete.length} imágenes obsoletas para inmueble #${propertyRef}`);
    
    for (const img of imagesToDelete) {
      try {
        // Eliminar archivo físico
        if (img.archivo) {
          const imgPath = path.join(imagesFolder, img.archivo);
          if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
            console.log(`Archivo eliminado: ${img.archivo}`);
          }
        }
        
        // Eliminar registro de la base de datos
        await db('imagenes_inmueble').where('id', img.id).delete();
        console.log(`Registro eliminado de la base de datos: ID ${img.id}`);
      } catch (error) {
        console.error(`Error al eliminar imagen obsoleta: ${error.message}`);
        stats.errores++;
      }
    }
  }
  
  console.log(`Procesamiento de imágenes completado para inmueble #${propertyRef}`);
}

// Función principal para corregir un inmueble específico
async function fixProperty(ref) {
  console.log(`\n🔧 Iniciando corrección para inmueble con referencia: ${ref}`);
  console.log('===========================================================');
  
  try {
    // 1. Verificar si el inmueble existe en la API
    console.log('\n1️⃣ Verificando existencia en la API...');
    
    // Obtener URL de la API desde variables de entorno
    const apiUrl = process.env.API_URL;
    const apiKey = process.env.API_KEY;
    
    if (!apiUrl || !apiKey) {
      console.error('❌ No se pudo obtener la URL de la API o la clave API desde las variables de entorno.');
      console.error('   Verifique que las variables API_URL y API_KEY estén configuradas correctamente en el archivo .env');
      return false;
    }
    
    // Obtener datos de la API
    const response = await axios.get(`${apiUrl}?key=${apiKey}`);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('❌ La respuesta de la API no tiene el formato esperado.');
      return false;
    }
    
    const propertyInApi = response.data.find(p => p.ref == ref);
    
    if (!propertyInApi) {
      console.error(`❌ El inmueble con referencia ${ref} NO existe en la API.`);
      return false;
    }
    
    console.log('✅ El inmueble SÍ existe en la API:');
    console.log(`   - Título: ${propertyInApi.titulo || 'No disponible'}`);
    console.log(`   - Tipo: ${propertyInApi.tipo_inmueble_nombre || 'No disponible'}`);
    console.log(`   - Uso: ${propertyInApi.uso_inmueble_nombre || 'No disponible'}`);
    
    // Verificar imágenes en la API
    if (!propertyInApi.imagenes || !Array.isArray(propertyInApi.imagenes) || propertyInApi.imagenes.length === 0) {
      console.error('❌ El inmueble NO tiene imágenes en la API.');
      return false;
    }
    
    console.log(`   - Imágenes disponibles en API: ${propertyInApi.imagenes.length}`);
    stats.imagenesTotal = propertyInApi.imagenes.length;
    
    // 2. Verificar si el inmueble existe en la base de datos
    console.log('\n2️⃣ Verificando existencia en la base de datos...');
    
    let property = await db('inmuebles').where({ ref }).first();
    
    if (!property) {
      console.log('❌ El inmueble NO existe en la base de datos. Creando registro...');
      
      // Asignar valores predeterminados para campos relacionales
      propertyInApi.ciudad_id = 1; // ID predeterminado para ciudad
      propertyInApi.barrio_id = 1; // ID predeterminado para barrio
      
      // Asignar tipo_inmueble_id basado en el nombre
      if (propertyInApi.tipo_inmueble_nombre && propertyInApi.tipo_inmueble_nombre.includes('Casa')) {
        propertyInApi.tipo_inmueble_id = 2; // Casa
      } else if (propertyInApi.tipo_inmueble_nombre && propertyInApi.tipo_inmueble_nombre.includes('Apartamento')) {
        propertyInApi.tipo_inmueble_id = 1; // Apartamento
      } else if (propertyInApi.tipo_inmueble_nombre && propertyInApi.tipo_inmueble_nombre.includes('Local')) {
        propertyInApi.tipo_inmueble_id = 3; // Local
      } else if (propertyInApi.tipo_inmueble_nombre && propertyInApi.tipo_inmueble_nombre.includes('Oficina')) {
        propertyInApi.tipo_inmueble_id = 4; // Oficina
      } else if (propertyInApi.tipo_inmueble_nombre && propertyInApi.tipo_inmueble_nombre.includes('Bodega')) {
        propertyInApi.tipo_inmueble_id = 5; // Bodega
      } else if (propertyInApi.tipo_inmueble_nombre && propertyInApi.tipo_inmueble_nombre.includes('Lote')) {
        propertyInApi.tipo_inmueble_id = 6; // Lote
      } else {
        propertyInApi.tipo_inmueble_id = 1; // Valor predeterminado
      }
      
      // Asignar uso_inmueble_id basado en el nombre
      if (propertyInApi.uso_inmueble_nombre && propertyInApi.uso_inmueble_nombre.includes('Residencial')) {
        propertyInApi.uso_inmueble_id = 1; // Residencial
      } else if (propertyInApi.uso_inmueble_nombre && propertyInApi.uso_inmueble_nombre.includes('Comercial')) {
        propertyInApi.uso_inmueble_id = 2; // Comercial
      } else if (propertyInApi.uso_inmueble_nombre && propertyInApi.uso_inmueble_nombre.includes('Industrial')) {
        propertyInApi.uso_inmueble_id = 3; // Industrial
      } else {
        propertyInApi.uso_inmueble_id = 1; // Valor predeterminado
      }
      
      // Asignar estado_inmueble_id basado en el nombre
      if (propertyInApi.estado_inmueble_nombre && propertyInApi.estado_inmueble_nombre.includes('Venta')) {
        propertyInApi.estado_inmueble_id = 1; // Venta
      } else if (propertyInApi.estado_inmueble_nombre && propertyInApi.estado_inmueble_nombre.includes('Arriendo')) {
        propertyInApi.estado_inmueble_id = 2; // Arriendo
      } else if (propertyInApi.estado_inmueble_nombre && propertyInApi.estado_inmueble_nombre.includes('Venta/Arriendo')) {
        propertyInApi.estado_inmueble_id = 3; // Venta/Arriendo
      } else {
        propertyInApi.estado_inmueble_id = 1; // Valor predeterminado
      }
      
      // Insertar el inmueble en la base de datos
      try {
        const [newId] = await db('inmuebles').insert({
          ref: propertyInApi.ref,
          titulo: propertyInApi.titulo || `Inmueble Ref. ${propertyInApi.ref}`,
          descripcion: propertyInApi.descripcion || '',
          descripcion_corta: propertyInApi.descripcion_corta || '',
          area: propertyInApi.area || 0,
          habitaciones: propertyInApi.habitaciones || 0,
          banos: propertyInApi.banos || 0,
          garajes: propertyInApi.garajes || 0,
          estrato: propertyInApi.estrato || 0,
          precio_venta: propertyInApi.precio_venta || 0,
          precio_canon: propertyInApi.precio_canon || 0,
          precio_administracion: propertyInApi.precio_administracion || 0,
          latitud: propertyInApi.latitud || 0,
          longitud: propertyInApi.longitud || 0,
          direccion: propertyInApi.direccion || '',
          ciudad_id: propertyInApi.ciudad_id,
          barrio_id: propertyInApi.barrio_id,
          tipo_inmueble_id: propertyInApi.tipo_inmueble_id,
          uso_inmueble_id: propertyInApi.uso_inmueble_id,
          estado_inmueble_id: propertyInApi.estado_inmueble_id,
          slug: propertyInApi.slug || `inmueble-${propertyInApi.ref}`,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
        
        console.log(`✅ Inmueble creado con ID: ${newId}`);
        
        // Obtener el inmueble recién creado
        property = await db('inmuebles').where('id', newId).first();
      } catch (error) {
        console.error(`❌ Error al crear el inmueble: ${error.message}`);
        return false;
      }
    } else {
      console.log('✅ El inmueble SÍ existe en la base de datos:');
      console.log(`   - ID interno: ${property.id}`);
      console.log(`   - Título: ${property.titulo || 'No disponible'}`);
    }
    
    // 3. Procesar imágenes
    console.log('\n3️⃣ Procesando imágenes...');
    
    if (!property) {
      console.error('❌ No se pudo obtener el inmueble de la base de datos.');
      return false;
    }
    
    // Procesar imágenes en paralelo
    await processImagesParallel(property.id, property.ref, propertyInApi.imagenes);
    
    // 4. Verificar resultados
    console.log('\n4️⃣ Verificando resultados...');
    
    // Verificar imágenes en la base de datos
    const imagesInDb = await db('imagenes_inmueble').where('inmueble_id', property.id).orderBy('orden');
    
    if (imagesInDb && imagesInDb.length > 0) {
      console.log(`✅ El inmueble tiene ${imagesInDb.length} imágenes en la base de datos.`);
      
      // Verificar archivos físicos
      let missingFiles = 0;
      for (const img of imagesInDb) {
        if (img.archivo) {
          const imagePath = path.join(imagesFolder, img.archivo);
          const imageExists = fs.existsSync(imagePath);
          
          if (!imageExists) {
            console.log(`❌ Archivo no encontrado: ${img.archivo}`);
            missingFiles++;
          }
        }
      }
      
      if (missingFiles === 0) {
        console.log('✅ Todos los archivos de imagen existen físicamente.');
      } else {
        console.log(`⚠️ Faltan ${missingFiles} archivos de imagen.`);
      }
    } else {
      console.log('❌ El inmueble NO tiene imágenes en la base de datos.');
      return false;
    }
    
    // 5. Mostrar estadísticas
    const tiempoTotal = (Date.now() - stats.inicio) / 1000;
    
    console.log('\n📊 Estadísticas:');
    console.log(`   - Tiempo total: ${tiempoTotal.toFixed(2)} segundos`);
    console.log(`   - Imágenes totales: ${stats.imagenesTotal}`);
    console.log(`   - Imágenes descargadas: ${stats.imagenesDescargadas}`);
    console.log(`   - Imágenes optimizadas: ${stats.imagenesOptimizadas}`);
    console.log(`   - Ahorro de espacio: ${(stats.ahorroEspacio / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Errores: ${stats.errores}`);
    
    console.log('\n✅ Corrección completada con éxito.');
    return true;
  } catch (error) {
    console.error(`\n❌ Error general: ${error.message}`);
    return false;
  } finally {
    // Cerrar conexión a la base de datos
    await db.destroy();
  }
}

// Obtener la referencia desde los argumentos de línea de comandos
const ref = process.argv[2] || '261';

// Ejecutar la función principal
fixProperty(ref)
  .then(success => {
    if (success) {
      console.log('\n✅ Proceso completado correctamente.');
    } else {
      console.log('\n⚠️ El proceso completó con advertencias o errores.');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error(`\n❌ Error fatal: ${error.message}`);
    process.exit(1);
  });
