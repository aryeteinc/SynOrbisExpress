# Guía de Optimización de SyncOrbisExpress

Esta guía proporciona técnicas y recomendaciones para optimizar el rendimiento de SyncOrbisExpress, especialmente en lo que respecta a la velocidad de sincronización.

## Optimización de la Base de Datos

### Índices

Los índices son cruciales para mejorar el rendimiento de las consultas. El script `optimize-sync.js` crea los siguientes índices:

- En la tabla `inmuebles`:
  - `idx_inmuebles_ref`
  - `idx_inmuebles_codigo_sincronizacion`
  - `idx_inmuebles_slug`
  - `idx_inmuebles_ciudad_id`
  - `idx_inmuebles_barrio_id`
  - `idx_inmuebles_tipo_inmueble_id`
  - `idx_inmuebles_uso_id`
  - `idx_inmuebles_estado_actual_id`

- En la tabla `imagenes`:
  - `idx_imagenes_inmueble_id`
  - `idx_imagenes_es_principal`

- En la tabla `inmueble_caracteristicas`:
  - `idx_inmueble_caracteristicas_inmueble_id`
  - `idx_inmueble_caracteristicas_caracteristica_id`

Para crear estos índices manualmente:

```bash
node scripts/optimize-sync.js
```

### Optimización de Tablas

La optimización de tablas ayuda a mejorar el rendimiento general:

```sql
OPTIMIZE TABLE inmuebles, imagenes, inmueble_caracteristicas;
```

### Configuración de MySQL

Ajustar la configuración de MySQL puede mejorar significativamente el rendimiento:

```sql
-- Aumentar el tamaño del buffer de consultas
SET GLOBAL innodb_buffer_pool_size = 268435456; -- 256MB

-- Aumentar el tamaño del buffer de consultas
SET GLOBAL query_cache_size = 67108864; -- 64MB

-- Configurar el tiempo máximo de ejecución de consultas
SET GLOBAL max_execution_time = 30000; -- 30 segundos

-- Configurar el tamaño máximo de paquetes
SET GLOBAL max_allowed_packet = 67108864; -- 64MB
```

## Optimización del Código

### Procesamiento por Lotes (Batch Processing)

Implementar procesamiento por lotes puede reducir significativamente el tiempo de sincronización:

```javascript
// Ejemplo de procesamiento por lotes
const batchSize = 50;
const totalItems = items.length;
const batches = Math.ceil(totalItems / batchSize);

for (let i = 0; i < batches; i++) {
  const start = i * batchSize;
  const end = Math.min(start + batchSize, totalItems);
  const batch = items.slice(start, end);
  
  // Procesar el lote
  await processBatch(batch);
  
  console.log(`Procesado lote ${i + 1}/${batches} (${end}/${totalItems})`);
}
```

### Uso de Transacciones

Las transacciones pueden mejorar el rendimiento y la integridad de los datos:

```javascript
// Ejemplo de uso de transacciones
await db.transaction(async (trx) => {
  // Realizar operaciones dentro de la transacción
  await trx('inmuebles').insert(data);
  await trx('imagenes').insert(imageData);
  
  // La transacción se confirma automáticamente si no hay errores
});
```

### Consultas Preparadas

Las consultas preparadas pueden mejorar el rendimiento al reutilizar planes de consulta:

```javascript
// Ejemplo de consulta preparada
const stmt = await db.prepare('INSERT INTO inmuebles (ref, titulo) VALUES (?, ?)');

for (const item of items) {
  await stmt.run(item.ref, item.titulo);
}

await stmt.finalize();
```

### Caché

Implementar un sistema de caché puede reducir las consultas a la base de datos:

```javascript
// Ejemplo simple de caché en memoria
const cache = new Map();

function getFromCacheOrDb(key, fetchFn) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const data = fetchFn();
  cache.set(key, data);
  return data;
}
```

## Optimización de Imágenes

### Procesamiento Asíncrono

Procesar imágenes de forma asíncrona puede mejorar significativamente el rendimiento:

```javascript
// Ejemplo de procesamiento asíncrono de imágenes
const promises = images.map(image => processImage(image));
await Promise.all(promises);
```

### Compresión de Imágenes

Comprimir imágenes antes de guardarlas puede reducir el espacio de almacenamiento y mejorar el rendimiento:

```javascript
// Ejemplo de compresión de imágenes con sharp
const sharp = require('sharp');

async function compressImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(800) // Redimensionar a un máximo de 800px de ancho
    .jpeg({ quality: 80 }) // Comprimir con calidad 80%
    .toFile(outputPath);
}
```

## Monitoreo y Diagnóstico

### Registro de Tiempos

Registrar los tiempos de ejecución puede ayudar a identificar cuellos de botella:

```javascript
// Ejemplo de registro de tiempos
const startTime = Date.now();
await performOperation();
const endTime = Date.now();
console.log(`Operación completada en ${(endTime - startTime) / 1000} segundos`);
```

### Perfilado de Consultas

Perfilar consultas puede ayudar a identificar consultas lentas:

```sql
-- Activar el perfilado de consultas
SET profiling = 1;

-- Ejecutar la consulta
SELECT * FROM inmuebles WHERE ciudad_id = 1;

-- Ver el perfil de la consulta
SHOW PROFILE;
```

## Consejos Adicionales

1. **Limitar el número de inmuebles** en cada sincronización para reducir la carga:
   ```bash
   node scripts/sync-js.js --limite=100
   ```

2. **Sincronizar por ciudad o tipo de inmueble** para distribuir la carga:
   ```bash
   node scripts/sync-js.js --ciudad=1
   ```

3. **Programar sincronizaciones incrementales** en lugar de sincronizaciones completas:
   ```bash
   node scripts/sync-js.js --incremental
   ```

4. **Limpiar datos antiguos** regularmente para mantener la base de datos optimizada:
   ```bash
   node scripts/clean-syncs.js --days=30
   ```

5. **Monitorear el uso de memoria** para evitar problemas de rendimiento:
   ```javascript
   console.log(`Uso de memoria: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
   ```

## Herramientas de Optimización

- **MySQL Workbench**: Para analizar y optimizar consultas SQL
- **Node.js Profiler**: Para identificar cuellos de botella en el código JavaScript
- **PM2**: Para gestionar y monitorear procesos Node.js

## Conclusión

La optimización es un proceso continuo. Monitorea regularmente el rendimiento de tu aplicación y realiza ajustes según sea necesario. Utiliza el script `optimize-sync.js` para aplicar automáticamente muchas de estas optimizaciones:

```bash
node scripts/optimize-sync.js
```
