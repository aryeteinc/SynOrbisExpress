# Guía de Solución de Problemas de SyncOrbisExpress

Esta guía proporciona soluciones para los problemas más comunes que pueden surgir al utilizar SyncOrbisExpress.

## Problemas de Instalación

### Error: No se puede conectar a la base de datos

**Síntoma**: Mensaje de error "Error conectando a la base de datos" al ejecutar cualquier script.

**Soluciones**:

1. Verifica que MySQL esté en ejecución:
   ```bash
   # En sistemas basados en Linux
   sudo systemctl status mysql
   
   # En macOS
   brew services list
   ```

2. Comprueba las credenciales en el archivo `.env`:
   ```
   DB_HOST=localhost
   DB_USER=tu_usuario
   DB_PASSWORD=tu_contraseña
   DB_DATABASE=inmuebles
   ```

3. Verifica que la base de datos exista:
   ```bash
   mysql -u tu_usuario -p -e "SHOW DATABASES;"
   ```

4. Crea la base de datos si no existe:
   ```bash
   mysql -u tu_usuario -p -e "CREATE DATABASE inmuebles;"
   ```

### Error: No se pueden instalar las dependencias

**Síntoma**: Errores al ejecutar `npm install`.

**Soluciones**:

1. Verifica que Node.js esté instalado correctamente:
   ```bash
   node -v
   ```

2. Limpia la caché de npm:
   ```bash
   npm cache clean --force
   ```

3. Elimina el directorio `node_modules` y vuelve a instalar:
   ```bash
   rm -rf node_modules
   npm install
   ```

## Problemas de Sincronización

### Error: Unknown column 'area_construida' in 'field list'

**Síntoma**: Error al ejecutar la sincronización con mensaje "Unknown column 'area_construida' in 'field list'".

**Soluciones**:

1. Ejecuta el script de corrección de la tabla:
   ```bash
   node scripts/fix-inmuebles-table.js
   ```

2. Reinicia la base de datos (esto eliminará todos los datos):
   ```bash
   node scripts/reset-db.js --confirmar
   ```

3. Modifica manualmente la tabla:
   ```sql
   ALTER TABLE inmuebles 
   ADD COLUMN area_construida DECIMAL(10,2) DEFAULT NULL,
   ADD COLUMN area_privada DECIMAL(10,2) DEFAULT NULL,
   ADD COLUMN area_terreno DECIMAL(10,2) DEFAULT NULL;
   ```

### Error: No se pueden descargar imágenes

**Síntoma**: La sincronización se completa, pero no se descargan las imágenes.

**Soluciones**:

1. Verifica que el directorio de imágenes exista y tenga permisos de escritura:
   ```bash
   mkdir -p ./public/images/inmuebles
   chmod -R 755 ./public/images/inmuebles
   ```

2. Comprueba la configuración de la API en el archivo `.env`:
   ```
   API_URL=https://tu-api-url.com
   API_KEY=tu_api_key
   ```

3. Verifica la conexión a internet:
   ```bash
   ping api.example.com
   ```

4. Habilita el modo de depuración para ver más detalles:
   ```bash
   node scripts/sync-js.js --debug
   ```

### Error: La sincronización es muy lenta

**Síntoma**: La sincronización tarda mucho tiempo en completarse.

**Soluciones**:

1. Ejecuta el script de optimización:
   ```bash
   node scripts/optimize-sync.js
   ```

2. Limita el número de inmuebles a sincronizar:
   ```bash
   node scripts/sync-js.js --limite=100
   ```

3. Verifica la conexión a internet:
   ```bash
   speedtest-cli
   ```

4. Optimiza la base de datos:
   ```sql
   OPTIMIZE TABLE inmuebles, imagenes, inmueble_caracteristicas;
   ```

## Problemas de Base de Datos

### Error: Tabla no existe

**Síntoma**: Error "Table 'inmuebles.inmuebles' doesn't exist" al ejecutar la sincronización.

**Soluciones**:

1. Ejecuta el script de instalación y verificación:
   ```bash
   node scripts/setup.js --force
   ```

2. Crea la tabla manualmente:
   ```sql
   CREATE TABLE inmuebles (
     id INT AUTO_INCREMENT PRIMARY KEY,
     ref INT NOT NULL UNIQUE,
     codigo_sincronizacion VARCHAR(255),
     -- Otros campos...
   );
   ```

### Error: Duplicado de clave primaria

**Síntoma**: Error "Duplicate entry for key 'PRIMARY'" al ejecutar la sincronización.

**Soluciones**:

1. Verifica si hay registros duplicados:
   ```sql
   SELECT ref, COUNT(*) FROM inmuebles GROUP BY ref HAVING COUNT(*) > 1;
   ```

2. Elimina los registros duplicados:
   ```sql
   DELETE t1 FROM inmuebles t1
   INNER JOIN inmuebles t2
   WHERE t1.id > t2.id AND t1.ref = t2.ref;
   ```

3. Reinicia la base de datos (esto eliminará todos los datos):
   ```bash
   node scripts/reset-db.js --confirmar
   ```

## Problemas de API

### Error: No se pueden obtener datos de la API

**Síntoma**: Error "Error al obtener datos de la API" al ejecutar la sincronización.

**Soluciones**:

1. Verifica la URL y la clave de API en el archivo `.env`:
   ```
   API_URL=https://tu-api-url.com
   API_KEY=tu_api_key
   ```

2. Comprueba que la API esté en línea y accesible:
   ```bash
   curl -H "Authorization: Bearer tu_api_key" https://tu-api-url.com
   ```

3. Verifica la conexión a internet:
   ```bash
   ping api.example.com
   ```

4. Contacta al proveedor de la API para verificar el estado del servicio.

## Problemas de Permisos

### Error: EACCES: permission denied

**Síntoma**: Error "EACCES: permission denied" al ejecutar la sincronización.

**Soluciones**:

1. Verifica los permisos del directorio de imágenes:
   ```bash
   ls -la ./public/images/inmuebles
   ```

2. Corrige los permisos:
   ```bash
   chmod -R 755 ./public/images/inmuebles
   chown -R $(whoami) ./public/images/inmuebles
   ```

3. Ejecuta el script con permisos elevados (no recomendado para producción):
   ```bash
   sudo node scripts/sync-js.js
   ```

## Problemas de Memoria

### Error: JavaScript heap out of memory

**Síntoma**: Error "JavaScript heap out of memory" al ejecutar la sincronización.

**Soluciones**:

1. Aumenta la memoria disponible para Node.js:
   ```bash
   node --max-old-space-size=4096 scripts/sync-js.js
   ```

2. Limita el número de inmuebles a sincronizar:
   ```bash
   node scripts/sync-js.js --limite=100
   ```

3. Implementa procesamiento por lotes en el script de sincronización.

4. Optimiza el uso de memoria en el código.

## Herramientas de Diagnóstico

### Verificar la Estructura de la Base de Datos

```bash
node scripts/check-table-structure.js
```

### Verificar la Conexión a la API

```bash
node scripts/check-api-connection.js
```

### Verificar los Permisos de Directorio

```bash
node scripts/check-permissions.js
```

## Contacto y Soporte

Si después de intentar estas soluciones todavía tienes problemas, puedes:

1. Abrir un issue en el repositorio de GitHub
2. Contactar al equipo de soporte en support@example.com
3. Consultar la documentación adicional en la carpeta `docs/`
