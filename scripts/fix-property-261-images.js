/**
 * Script para forzar la sincronización de imágenes del inmueble con referencia 261
 * 
 * Este script:
 * 1. Verifica que el inmueble exista en la base de datos
 * 2. Obtiene las imágenes desde la API
 * 3. Descarga y optimiza las imágenes
 * 4. Actualiza la base de datos con la información de las imágenes
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const knex = require('knex');
const sharp = require('sharp');
const { performance } = require('perf_hooks');

// Cargar variables de entorno
dotenv.config();

// Configuración
const config = {
  apiUrl: process.env.API_URL || 'https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/',
  imagesFolder: process.env.IMAGES_FOLDER || path.join(process.cwd(), 'imagenes_inmuebles'),
  propertyRef: 261
};

// Configurar la conexión a la base de datos con mysql2
const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DATABASE || 'inmuebles'
  },
  pool: { min: 0, max: 7 }
});

// Función principal
async function main() {
  try {
    console.log(`\n🔍 Iniciando sincronización forzada para inmueble #${config.propertyRef}`);
    console.log('===========================================================');

    // Paso 1: Verificar que el inmueble exista en la base de datos
    console.log('\n1️⃣ Verificando existencia en la base de datos...');
    const property = await db('inmuebles').where('ref', config.propertyRef).first();
    
    if (!property) {
      console.error(`❌ El inmueble #${config.propertyRef} no existe en la base de datos.`);
      process.exit(1);
    }
    
    console.log(`✅ Inmueble #${config.propertyRef} encontrado en la base de datos (ID interno: ${property.id})`);
    
    // Paso 2: Obtener datos del inmueble desde la API
    console.log('\n2️⃣ Obteniendo datos desde la API...');
    const apiData = await fetchPropertyFromApi(config.propertyRef);
    
    if (!apiData) {
      console.error(`❌ No se pudo obtener información del inmueble #${config.propertyRef} desde la API.`);
      process.exit(1);
    }
    
    console.log(`✅ Datos del inmueble #${config.propertyRef} obtenidos desde la API`);
    
    // Paso 3: Procesar imágenes
    if (apiData.imagenes && Array.isArray(apiData.imagenes) && apiData.imagenes.length > 0) {
      console.log(`\n3️⃣ Procesando ${apiData.imagenes.length} imágenes...`);
      await processImages(property.id, config.propertyRef, apiData.imagenes);
    } else {
      console.log(`\n❌ El inmueble #${config.propertyRef} no tiene imágenes en la API.`);
    }
    
    console.log('\n✅ Sincronización forzada completada con éxito.');
  } catch (error) {
    console.error(`\n❌ Error durante la sincronización: ${error.message}`);
    console.error(error);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Función para obtener datos del inmueble desde la API
async function fetchPropertyFromApi(propertyRef) {
  try {
    console.log(`Consultando API en: ${config.apiUrl}`);
    
    const response = await axios.get(config.apiUrl, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 segundos de timeout
    });
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`Respuesta recibida. Código: ${response.status}`);
      
      // Extraer el inmueble específico de la respuesta
      let properties = [];
      
      if (Array.isArray(response.data)) {
        properties = response.data;
      } else if (typeof response.data === 'object') {
        if (response.data.data && Array.isArray(response.data.data)) {
          properties = response.data.data;
        } else if (response.data.inmuebles && Array.isArray(response.data.inmuebles)) {
          properties = response.data.inmuebles;
        } else if (response.data.items && Array.isArray(response.data.items)) {
          properties = response.data.items;
        } else if (response.data.results && Array.isArray(response.data.results)) {
          properties = response.data.results;
        }
      }
      
      // Buscar el inmueble con la referencia específica
      const property = properties.find(p => p.ref === propertyRef);
      
      if (property) {
        console.log(`Inmueble #${propertyRef} encontrado en la API`);
        return property;
      } else {
        console.error(`Inmueble #${propertyRef} no encontrado en la API`);
        return null;
      }
    } else {
      console.error(`Error al obtener datos de la API. Código: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error en la petición a la API: ${error.message}`);
    return null;
  }
}

// Función para procesar imágenes
async function processImages(propertyId, propertyRef, images) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    console.log(`Inmueble #${propertyRef}: No hay imágenes para procesar`);
    return [];
  }
  
  console.log(`Inmueble #${propertyRef}: Procesando ${images.length} imágenes...`);
  
  // Crear carpeta para las imágenes del inmueble
  const propertyFolder = path.join(config.imagesFolder, `inmueble_${propertyRef}`);
  if (!fs.existsSync(propertyFolder)) {
    fs.mkdirSync(propertyFolder, { recursive: true });
  }
  
  // Obtener imágenes existentes de la base de datos
  let existingImages = [];
  try {
    existingImages = await db('imagenes')
      .where('inmueble_id', propertyId)
      .select('id', 'url', 'url_local', 'orden');
    
    if (existingImages.length > 0) {
      console.log(`Inmueble #${propertyRef}: Se encontraron ${existingImages.length} imágenes en la base de datos`);
    }
  } catch (dbError) {
    console.error(`Inmueble #${propertyRef}: No se pudieron obtener imágenes de la base de datos: ${dbError.message}`);
    existingImages = [];
  }
  
  // Procesar cada imagen
  const results = [];
  for (let i = 0; i < images.length; i++) {
    const orden = i + 1;
    const image = images[i];
    const imageUrl = image.url;
    
    if (!imageUrl) {
      console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} no tiene URL, omitiendo`);
      continue;
    }
    
    // Verificar si la imagen ya existe en la base de datos
    const existingImage = existingImages.find(img => img.url === imageUrl);
    
    // Generar nombre de archivo local
    const fileName = `${propertyRef}_${orden}_${path.basename(imageUrl)}`;
    const localPath = path.join(propertyFolder, fileName);
    
    console.log(`Inmueble #${propertyRef}: Procesando imagen ${orden}/${images.length}: ${imageUrl}`);
    
    // Si la imagen ya existe localmente, no la descargamos de nuevo
    if (fs.existsSync(localPath)) {
      console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} ya existe localmente en ${localPath}`);
    } else {
      // Descargar la imagen
      console.log(`Inmueble #${propertyRef}: Descargando imagen ${orden}/${images.length}...`);
      try {
        // Descargar la imagen
        const response = await axios({
          method: 'GET',
          url: imageUrl,
          responseType: 'stream',
          timeout: 30000 // 30 segundos de timeout
        });
        
        // Guardar la imagen en el sistema de archivos
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        // Optimizar la imagen descargada
        console.log(`Inmueble #${propertyRef}: Optimizando imagen ${orden}/${images.length}...`);
        await optimizeImage(localPath, localPath, {
          quality: 80,
          width: 1200,
          height: 800,
          fit: 'inside'
        });
        
        console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} descargada y optimizada`);
      } catch (downloadError) {
        console.error(`Inmueble #${propertyRef}: Error al descargar imagen ${orden}/${images.length}: ${downloadError.message}`);
        continue;
      }
    }
    
    // Calcular hash MD5 de la imagen
    let hash = '';
    try {
      hash = await calculateImageHash(localPath);
    } catch (hashError) {
      console.error(`Inmueble #${propertyRef}: Error al calcular hash para imagen ${orden}/${images.length}: ${hashError.message}`);
    }
    
    // Preparar datos para la base de datos según la estructura correcta de la tabla
    const imageData = {
      inmueble_id: propertyId,
      url: imageUrl,
      url_local: `inmueble_${propertyRef}/${fileName}`,
      orden: orden,
      hash_md5: hash,
      descargada: 1,
      es_principal: orden === 1 ? 1 : 0 // La primera imagen es la principal
    };
    
    // Obtener información del archivo para tamaño, ancho y alto
    try {
      const stats = fs.statSync(localPath);
      imageData.tamano_bytes = stats.size;
      
      // Obtener dimensiones de la imagen
      const metadata = await sharp(localPath).metadata();
      imageData.ancho = metadata.width;
      imageData.alto = metadata.height;
    } catch (error) {
      console.error(`Inmueble #${propertyRef}: Error al obtener metadatos de la imagen: ${error.message}`);
    }
    
    // Guardar o actualizar en la base de datos
    try {
      if (existingImage) {
        // Actualizar imagen existente
        await db('imagenes')
          .where('id', existingImage.id)
          .update({
            url_local: imageData.url_local,
            orden: imageData.orden,
            hash_md5: imageData.hash_md5,
            descargada: imageData.descargada,
            es_principal: imageData.es_principal,
            tamano_bytes: imageData.tamano_bytes,
            ancho: imageData.ancho,
            alto: imageData.alto,
            updated_at: db.fn.now()
          });
        console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} actualizada en la base de datos`);
      } else {
        // Insertar nueva imagen
        await db('imagenes').insert(imageData);
        console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} insertada en la base de datos`);
      }
      
      results.push(imageData);
    } catch (dbError) {
      console.error(`Inmueble #${propertyRef}: Error al guardar imagen ${orden}/${images.length} en la base de datos: ${dbError.message}`);
    }
  }
  
  console.log(`Inmueble #${propertyRef}: ${results.length} imágenes guardadas en la base de datos`);
  return results;
}

// Función para optimizar una imagen con Sharp
async function optimizeImage(inputPath, outputPath, options = {}) {
  try {
    // Opciones por defecto
    const defaults = {
      quality: 80,
      width: 1200,
      height: 800,
      fit: 'inside'
    };
    
    // Combinar opciones
    const opts = { ...defaults, ...options };
    
    // Procesar la imagen
    await sharp(inputPath)
      .resize(opts.width, opts.height, { fit: opts.fit })
      .jpeg({ quality: opts.quality })
      .toFile(`${outputPath}.tmp`);
    
    // Reemplazar el archivo original
    fs.renameSync(`${outputPath}.tmp`, outputPath);
    
    return true;
  } catch (error) {
    console.error(`Error al optimizar imagen: ${error.message}`);
    return false;
  }
}

// Función para calcular el hash MD5 de una imagen
async function calculateImageHash(imagePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(imagePath);
      
      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    } catch (error) {
      reject(error);
    }
  });
}

// Ejecutar la función principal
main().catch(error => {
  console.error(`Error fatal: ${error.message}`);
  process.exit(1);
});
