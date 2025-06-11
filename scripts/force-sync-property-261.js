// Script para forzar la sincronización del inmueble con referencia 261
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise'); // Usando mysql2 en lugar de mysql para compatibilidad con autenticación
const { performance } = require('perf_hooks');
const sharp = require('sharp');
const crypto = require('crypto');

// Configuración
const API_URL = process.env.API_URL;
const REF_TO_SYNC = '261';

// Carpeta de imágenes
const imagesFolder = process.env.IMAGES_FOLDER || path.join(__dirname, '../public/images/inmuebles');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
  user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'inmuebles'
};

// Estadísticas
const stats = {
  inicio: performance.now(),
  imagenesTotal: 0,
  imagenesDescargadas: 0,
  imagenesOptimizadas: 0,
  errores: 0,
  ahorroEspacio: 0
};

// Función para descargar y procesar una imagen
async function downloadAndProcessImage(url, filePath) {
  try {
    // Crear directorio si no existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.log(`Descargando imagen desde: ${url}`);
    
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
          await sharp(tempFilePath)
            .resize(1200) // Redimensionar al ancho máximo
            .jpeg({ quality: 80 }) // Comprimir con calidad 80%
            .toFile(filePath);
          
          // Obtener tamaños
          const originalSize = fs.statSync(tempFilePath).size;
          const optimizedSize = fs.statSync(filePath).size;
          const savings = originalSize - optimizedSize;
          stats.ahorroEspacio += savings;
          
          console.log(`Imagen optimizada: ${path.basename(filePath)}`);
          console.log(`  - Tamaño original: ${(originalSize / 1024).toFixed(2)} KB`);
          console.log(`  - Tamaño optimizado: ${(optimizedSize / 1024).toFixed(2)} KB`);
          console.log(`  - Ahorro: ${(savings / 1024).toFixed(2)} KB (${((savings / originalSize) * 100).toFixed(2)}%)`);
          
          stats.imagenesOptimizadas++;
          
          // Eliminar el archivo temporal
          fs.unlinkSync(tempFilePath);
          
          stats.imagenesDescargadas++;
          resolve(true);
        } catch (error) {
          console.error(`Error al optimizar imagen: ${error.message}`);
          
          // Si hay error en la optimización, usar la imagen original
          fs.copyFileSync(tempFilePath, filePath);
          fs.unlinkSync(tempFilePath);
          
          stats.imagenesDescargadas++;
          resolve(true);
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

// Función principal
async function syncProperty261() {
  console.log(`\n🔄 Iniciando sincronización forzada para inmueble con referencia: ${REF_TO_SYNC}`);
  console.log('===========================================================');
  
  let connection;
  
  try {
    // 1. Conectar a la base de datos
    console.log('\n1️⃣ Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión a la base de datos establecida correctamente.');
    
    // 2. Obtener datos de la API
    console.log('\n2️⃣ Obteniendo datos de la API...');
    const response = await axios.get(API_URL);
    
    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('La respuesta de la API no tiene el formato esperado.');
    }
    
    const property = response.data.find(p => p.ref == REF_TO_SYNC);
    
    if (!property) {
      throw new Error(`No se encontró el inmueble con referencia ${REF_TO_SYNC} en la API.`);
    }
    
    console.log('✅ Inmueble encontrado en la API:');
    console.log(`   - Título: ${property.titulo || 'No disponible'}`);
    console.log(`   - Tipo: ${property.tipo_inmueble_nombre || 'No disponible'}`);
    console.log(`   - Uso: ${property.uso_inmueble_nombre || 'No disponible'}`);
    
    // Verificar imágenes en la API
    if (!property.imagenes || !Array.isArray(property.imagenes) || property.imagenes.length === 0) {
      throw new Error('El inmueble no tiene imágenes en la API.');
    }
    
    console.log(`   - Imágenes disponibles en API: ${property.imagenes.length}`);
    stats.imagenesTotal = property.imagenes.length;
    
    // 3. Verificar si el inmueble existe en la base de datos
    console.log('\n3️⃣ Verificando existencia en la base de datos...');
    
    const [rows] = await connection.execute('SELECT * FROM inmuebles WHERE ref = ?', [REF_TO_SYNC]);
    let propertyId;
    
    if (rows.length === 0) {
      console.log('❌ El inmueble NO existe en la base de datos. Creando registro...');
      
      // Asignar valores predeterminados para campos relacionales
      const ciudad_id = 1; // ID predeterminado para ciudad
      const barrio_id = 1; // ID predeterminado para barrio
      
      // Asignar tipo_inmueble_id basado en el nombre
      let tipo_inmueble_id = 1; // Valor predeterminado
      if (property.tipo_inmueble_nombre) {
        if (property.tipo_inmueble_nombre.includes('Casa')) tipo_inmueble_id = 2;
        else if (property.tipo_inmueble_nombre.includes('Apartamento')) tipo_inmueble_id = 1;
        else if (property.tipo_inmueble_nombre.includes('Local')) tipo_inmueble_id = 3;
        else if (property.tipo_inmueble_nombre.includes('Oficina')) tipo_inmueble_id = 4;
        else if (property.tipo_inmueble_nombre.includes('Bodega')) tipo_inmueble_id = 5;
        else if (property.tipo_inmueble_nombre.includes('Lote')) tipo_inmueble_id = 6;
      }
      
      // Asignar uso_inmueble_id basado en el nombre
      let uso_inmueble_id = 1; // Valor predeterminado
      if (property.uso_inmueble_nombre) {
        if (property.uso_inmueble_nombre.includes('Residencial')) uso_inmueble_id = 1;
        else if (property.uso_inmueble_nombre.includes('Comercial')) uso_inmueble_id = 2;
        else if (property.uso_inmueble_nombre.includes('Industrial')) uso_inmueble_id = 3;
      }
      
      // Asignar estado_inmueble_id basado en el nombre
      let estado_inmueble_id = 1; // Valor predeterminado
      if (property.estado_inmueble_nombre) {
        if (property.estado_inmueble_nombre.includes('Venta')) estado_inmueble_id = 1;
        else if (property.estado_inmueble_nombre.includes('Arriendo')) estado_inmueble_id = 2;
        else if (property.estado_inmueble_nombre.includes('Venta/Arriendo')) estado_inmueble_id = 3;
      }
      
      // Insertar el inmueble en la base de datos
      const [result] = await connection.execute(
        `INSERT INTO inmuebles (
          ref, titulo, descripcion, descripcion_corta, area, habitaciones, banos, garajes, 
          estrato, precio_venta, precio_canon, precio_administracion, latitud, longitud, 
          direccion, ciudad_id, barrio_id, tipo_inmueble_id, uso_inmueble_id, estado_inmueble_id, 
          slug, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          property.ref,
          property.titulo || `Inmueble Ref. ${property.ref}`,
          property.descripcion || '',
          property.descripcion_corta || '',
          property.area || 0,
          property.habitaciones || 0,
          property.banos || 0,
          property.garajes || 0,
          property.estrato || 0,
          property.precio_venta || 0,
          property.precio_canon || 0,
          property.precio_administracion || 0,
          property.latitud || 0,
          property.longitud || 0,
          property.direccion || '',
          ciudad_id,
          barrio_id,
          tipo_inmueble_id,
          uso_inmueble_id,
          estado_inmueble_id,
          property.slug || `inmueble-${property.ref}`
        ]
      );
      
      propertyId = result.insertId;
      console.log(`✅ Inmueble creado con ID: ${propertyId}`);
    } else {
      propertyId = rows[0].id;
      console.log('✅ El inmueble SÍ existe en la base de datos:');
      console.log(`   - ID interno: ${propertyId}`);
      console.log(`   - Título: ${rows[0].titulo || 'No disponible'}`);
    }
    
    // 4. Procesar imágenes
    console.log('\n4️⃣ Procesando imágenes...');
    
    // Verificar imágenes existentes en la base de datos
    const [existingImages] = await connection.execute(
      'SELECT id, archivo, orden, hash FROM imagenes_inmueble WHERE inmueble_id = ? ORDER BY orden',
      [propertyId]
    );
    
    console.log(`Imágenes existentes en BD: ${existingImages.length}`);
    
    // Crear un mapa de imágenes existentes por orden para búsqueda rápida
    const existingImagesByOrder = {};
    existingImages.forEach(img => {
      existingImagesByOrder[img.orden] = img;
    });
    
    // Procesar cada imagen
    for (let i = 0; i < property.imagenes.length; i++) {
      const image = property.imagenes[i];
      const orden = i + 1; // El orden comienza en 1
      
      // Verificar si ya existe una imagen con este orden
      const existingImage = existingImagesByOrder[orden];
      
      // Calcular hash de la URL para detectar cambios
      const urlHash = crypto.createHash('md5').update(image.url).digest('hex');
      
      // Crear nombre de archivo basado en la referencia del inmueble y el orden
      const fileExtension = path.extname(image.url) || '.jpg';
      const fileName = `${property.ref}_${orden}${fileExtension}`;
      const filePath = path.join(imagesFolder, fileName);
      
      // Verificar si necesitamos descargar esta imagen
      const needsDownload = !existingImage || 
                            existingImage.hash !== urlHash || 
                            !fs.existsSync(path.join(imagesFolder, existingImage.archivo || ''));
      
      if (needsDownload) {
        console.log(`Procesando imagen ${orden}/${property.imagenes.length} para inmueble #${property.ref}`);
        
        try {
          // Descargar y procesar la imagen
          await downloadAndProcessImage(image.url, filePath);
          
          // Actualizar o insertar en la base de datos
          if (existingImage) {
            await connection.execute(
              'UPDATE imagenes_inmueble SET archivo = ?, hash = ?, updated_at = NOW() WHERE id = ?',
              [fileName, urlHash, existingImage.id]
            );
            console.log(`Imagen ${orden} actualizada en la base de datos (ID: ${existingImage.id})`);
          } else {
            await connection.execute(
              'INSERT INTO imagenes_inmueble (inmueble_id, archivo, orden, hash, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
              [propertyId, fileName, orden, urlHash]
            );
            console.log(`Imagen ${orden} insertada en la base de datos`);
          }
        } catch (error) {
          console.error(`Error procesando imagen ${orden}: ${error.message}`);
          stats.errores++;
        }
      } else {
        console.log(`Imagen ${orden} ya existe y está actualizada`);
      }
    }
    
    // 5. Verificar resultados finales
    console.log('\n5️⃣ Verificando resultados finales...');
    
    const [finalImages] = await connection.execute(
      'SELECT id, archivo, orden FROM imagenes_inmueble WHERE inmueble_id = ? ORDER BY orden',
      [propertyId]
    );
    
    console.log(`✅ El inmueble tiene ${finalImages.length} imágenes en la base de datos.`);
    
    // Verificar archivos físicos
    let missingFiles = 0;
    for (const img of finalImages) {
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
    
    // 6. Mostrar estadísticas
    const tiempoTotal = (performance.now() - stats.inicio) / 1000;
    
    console.log('\n📊 Estadísticas:');
    console.log(`   - Tiempo total: ${tiempoTotal.toFixed(2)} segundos`);
    console.log(`   - Imágenes totales: ${stats.imagenesTotal}`);
    console.log(`   - Imágenes descargadas: ${stats.imagenesDescargadas}`);
    console.log(`   - Imágenes optimizadas: ${stats.imagenesOptimizadas}`);
    console.log(`   - Ahorro de espacio: ${(stats.ahorroEspacio / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Errores: ${stats.errores}`);
    
    console.log('\n✅ Sincronización forzada completada con éxito.');
    return true;
  } catch (error) {
    console.error(`\n❌ Error general: ${error.message}`);
    stats.errores++;
    return false;
  } finally {
    // Cerrar conexión a la base de datos
    if (connection) {
      await connection.end();
      console.log('Conexión a la base de datos cerrada.');
    }
  }
}

// Ejecutar la función principal
syncProperty261()
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
