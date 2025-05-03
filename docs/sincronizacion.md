# Sistema de Sincronización de SyncOrbis Express

Este documento describe el sistema de sincronización de propiedades inmobiliarias implementado en SyncOrbis Express, incluyendo las mejoras recientes para resolver problemas de sincronizaciones bloqueadas, optimizar el proceso y gestionar estados personalizados y etiquetas.

## Arquitectura del Sistema

El sistema de sincronización está compuesto por los siguientes componentes:

1. **API REST**: Endpoints para iniciar y monitorear sincronizaciones
2. **Scripts de Sincronización**: Procesos independientes para sincronizar datos
3. **Mecanismos de Limpieza**: Herramientas para limpiar sincronizaciones bloqueadas
4. **Base de Datos**: Almacenamiento de datos de inmuebles y registros de sincronización
5. **Sistema de Estados Personalizados**: Mecanismo para mantener estados personalizados entre sincronizaciones
6. **Sistema de Etiquetas**: Gestión de etiquetas para clasificar inmuebles

## Scripts de Sincronización

### 1. Script Principal de Sincronización (JavaScript)

El script `sync-js.js` es la implementación principal del proceso de sincronización, desarrollado en JavaScript puro para evitar problemas de compilación de TypeScript.

**Ubicación**: `/scripts/sync-js.js`

**Características principales**:
- Descarga datos de inmuebles desde la API de Orbis
- Detecta cambios usando hashes MD5
- Procesa y descarga imágenes de forma eficiente
- Gestiona características de inmuebles en la base de datos
- Registra cambios en el historial
- Maneja errores de forma robusta
- Compatible con MySQL y SQLite

**Uso**:
```bash
# Sincronización completa
node scripts/sync-js.js

# Sincronización con límite de inmuebles
node scripts/sync-js.js --limite=10

# Sincronización sin descargar imágenes
node scripts/sync-js.js --no-imagenes

# Sincronización para una ejecución específica
node scripts/sync-js.js --execution-id=15
```

### 2. Script de Limpieza de Sincronizaciones

El script `clean-syncs.js` permite limpiar sincronizaciones bloqueadas o huérfanas.

**Ubicación**: `/scripts/clean-syncs.js`

**Características principales**:
- Identifica sincronizaciones en estado "en_progreso" que llevan demasiado tiempo
- Permite limpiar sincronizaciones específicas por ID
- Configurable por tiempo de timeout

**Uso**:
```bash
# Limpiar todas las sincronizaciones huérfanas (default 30 minutos)
node scripts/clean-syncs.js

# Limpiar sincronizaciones más antiguas que 5 minutos
node scripts/clean-syncs.js --minutes=5

# Limpiar una sincronización específica por ID
node scripts/clean-syncs.js --sync-id=10
```

### 3. Script de Reinicio de Base de Datos

El script `reset-db.js` permite reiniciar la base de datos manteniendo los estados personalizados de los inmuebles.

**Ubicación**: `/scripts/reset-db.js`

**Características principales**:
- Elimina todas las tablas relacionadas con inmuebles
- Recrea las tablas con la estructura correcta
- Elimina todas las imágenes descargadas
- Preserva los estados personalizados (activo, destacado, en_caliente)
- Requiere confirmación para evitar eliminaciones accidentales

**Uso**:
```bash
# Reiniciar la base de datos (requiere confirmación)
node scripts/reset-db.js --confirmar

# Reiniciar la base de datos sin insertar datos de catálogo
node scripts/reset-db.js --confirmar --sin-catalogos
```

**Opciones disponibles**:
- `--confirmar`: Confirma la ejecución del script (obligatorio)
- `--sin-catalogos`: Omite la inserción de datos de catálogo (ciudades, barrios, tipos de inmueble, etc.)

### 4. Script de Reinicio Completo de Base de Datos

El script `reset-db-full.js` permite reiniciar completamente la base de datos eliminando todos los datos, incluyendo estados personalizados y etiquetas.

**Ubicación**: `/scripts/reset-db-full.js`

**Características principales**:
- Elimina TODAS las tablas y datos, incluyendo etiquetas y estados personalizados
- Recrea todas las tablas con la estructura correcta
- Elimina todas las imágenes descargadas
- Inserta datos de catálogo predeterminados
- No está expuesto en ningún endpoint para evitar eliminaciones accidentales

**Uso**:
```bash
# Reiniciar completamente la base de datos
node scripts/reset-db-full.js

# Reiniciar completamente la base de datos sin insertar datos de catálogo
node scripts/reset-db-full.js --sin-catalogos
```

**Opciones disponibles**:
- `--sin-catalogos`: Omite la inserción de datos de catálogo (ciudades, barrios, tipos de inmueble, etc.)

### 5. Script de Gestión de Estados de Inmuebles

El script `update-property-state.js` permite actualizar los estados personalizados de un inmueble (activo, destacado, en_caliente).

**Ubicación**: `/scripts/update-property-state.js`

**Características principales**:
- Permite activar/desactivar inmuebles (activo)
- Permite marcar/desmarcar inmuebles como destacados (destacado)
- Permite marcar/desmarcar inmuebles como en caliente (en_caliente)
- Mantiene estos estados entre sincronizaciones

**Uso**:
```bash
# Marcar un inmueble como destacado
node scripts/update-property-state.js --ref=123 --destacado=true

# Desactivar un inmueble
node scripts/update-property-state.js --ref=123 --activo=false

# Marcar un inmueble como en caliente
node scripts/update-property-state.js --ref=123 --en-caliente=true

# Actualizar múltiples estados a la vez
node scripts/update-property-state.js --ref=123 --destacado=true --en-caliente=true --activo=true
```

### 6. Script de Gestión de Etiquetas

El script `manage-property-tags.js` permite gestionar las etiquetas de los inmuebles.

**Ubicación**: `/scripts/manage-property-tags.js`

**Características principales**:
- Permite añadir etiquetas a inmuebles
- Permite eliminar etiquetas de inmuebles
- Permite listar las etiquetas de un inmueble
- Permite listar los inmuebles con una etiqueta específica
- Permite crear nuevas etiquetas personalizadas

**Uso**:
```bash
# Añadir una etiqueta a un inmueble
node scripts/manage-property-tags.js --add --inmueble=123 --etiqueta=1

# Eliminar una etiqueta de un inmueble
node scripts/manage-property-tags.js --remove --inmueble=123 --etiqueta=1

# Listar las etiquetas de un inmueble
node scripts/manage-property-tags.js --list --inmueble=123

# Listar los inmuebles con una etiqueta específica
node scripts/manage-property-tags.js --list --etiqueta=1

# Crear una nueva etiqueta
node scripts/manage-property-tags.js --create --nombre="Nueva etiqueta" --color="#FF5733" --descripcion="Descripción opcional"
```

## Endpoints de la API

### 1. Iniciar Sincronización

**Endpoint**: `POST /api/sync/start`

**Descripción**: Inicia un nuevo proceso de sincronización.

**Respuesta**:
```json
{
  "success": true,
  "message": "Sincronización iniciada correctamente",
  "syncId": 15
}
```

### 2. Estado de Sincronización

**Endpoint**: `GET /api/sync/status/:id`

**Descripción**: Obtiene el estado de una sincronización específica.

**Respuesta**:
```json
{
  "id": 15,
  "estado": "completado",
  "fecha_inicio": "2025-04-13T10:08:09.720Z",
  "fecha_fin": "2025-04-13T10:08:18.646Z",
  "inmuebles_procesados": 158,
  "inmuebles_nuevos": 0,
  "inmuebles_actualizados": 0,
  "inmuebles_sin_cambios": 158,
  "imagenes_descargadas": 0,
  "errores": 0
}
```

### 3. Limpiar Sincronizaciones

**Endpoint**: `POST /api/sync/clean`

**Descripción**: Limpia sincronizaciones bloqueadas.

**Parámetros**:
- `minutes`: Tiempo en minutos para considerar una sincronización como huérfana (opcional)
- `syncId`: ID de la sincronización a limpiar (opcional)

**Respuesta**:
```json
{
  "success": true,
  "message": "Se limpiaron 2 sincronizaciones bloqueadas"
}
```

## Proceso de Sincronización

### Flujo de Sincronización

1. **Inicio**: Se crea un registro en la tabla `ejecuciones` con estado "en_progreso"
2. **Obtención de datos**: Se descargan los datos de la API de Orbis
3. **Procesamiento de inmuebles**:
   - Para cada inmueble, se verifica si ya existe en la base de datos
   - Si existe, se compara el hash de los datos para detectar cambios
   - Si hay cambios, se actualiza el inmueble y se registra en el historial
   - Si no existe, se crea un nuevo registro
4. **Procesamiento de imágenes**:
   - Se verifica si cada imagen ya existe localmente usando su hash MD5
   - Solo se descargan imágenes nuevas o modificadas
   - Se eliminan imágenes que ya no existen en la API
5. **Finalización**: Se actualiza el registro en la tabla `ejecuciones` con estado "completado" y estadísticas

### Detección de Cambios

El sistema utiliza hashes MD5 para detectar cambios en los datos de los inmuebles y en las imágenes:

1. **Datos de inmuebles**: Se calcula un hash de los campos principales del inmueble
2. **Imágenes**: Se calcula un hash MD5 de cada archivo de imagen

Esto permite sincronizar solo lo que ha cambiado, optimizando el proceso.

### Procesamiento de Características

El sistema procesa las características de cada inmueble de la siguiente manera:

1. **Extracción**: Se extraen las características del inmueble desde la API
2. **Almacenamiento**: Se almacenan en la tabla `caracteristicas` (definición de características)
3. **Relación**: Se crea la relación entre inmuebles y características en la tabla `inmueble_caracteristicas`
4. **Valores**: Los valores de cada característica se almacenan como texto en el campo `valor`

Este proceso permite filtrar y buscar inmuebles por sus características de forma eficiente.

## Manejo de Errores y Recuperación

### Sincronizaciones Bloqueadas

El sistema incluye mecanismos para detectar y limpiar sincronizaciones que se han quedado bloqueadas:

1. **Detección automática**: Las sincronizaciones en estado "en_progreso" por más de un tiempo configurable se consideran huérfanas
2. **Limpieza manual**: El administrador puede limpiar sincronizaciones específicas
3. **Limpieza programada**: Se puede configurar una tarea cron para ejecutar el script de limpieza periódicamente

### Errores en el Proceso

El sistema maneja errores de forma robusta:

1. **Errores en inmuebles individuales**: Si falla el procesamiento de un inmueble, se registra el error y se continúa con el siguiente
2. **Errores en imágenes**: Si falla la descarga de una imagen, se registra el error y se continúa
3. **Errores fatales**: En caso de errores graves, se marca la sincronización como "error" y se registra el mensaje

## Configuración de la Base de Datos

El sistema de sincronización soporta dos tipos de bases de datos: SQLite y MySQL.

### SQLite (Configuración Predeterminada)

Por defecto, el sistema utiliza SQLite como base de datos, lo que facilita la instalación y configuración inicial. Para usar SQLite, configura las siguientes variables de entorno en el archivo `.env`:

```
DB_TYPE=sqlite
SQLITE_PATH=./inmuebles_db.sqlite
```

Ventajas de SQLite:
- No requiere instalación de servidor de base de datos
- Fácil respaldo (solo copiar el archivo de base de datos)
- Ideal para entornos de desarrollo y pruebas
- Funciona bien para sitios con tráfico moderado

### MySQL

Para entornos de producción o cuando se requiere mayor escalabilidad, el sistema también soporta MySQL. El sistema está configurado para usar MySQL en un contenedor Docker con las siguientes características:

- **Puerto**: 3307 (mapeado al 3306 interno del contenedor)
- **Credenciales**: root/rootpassword o syncorbis/password
- **Base de datos**: inmuebles

Para configurar MySQL, establece las siguientes variables de entorno en el archivo `.env`:

```
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3307
MYSQL_USER=syncorbis
MYSQL_PASSWORD=password
MYSQL_DATABASE=inmuebles
```

También puedes usar las credenciales de root:

```
MYSQL_USER=root
MYSQL_PASSWORD=rootpassword
```

Ventajas de MySQL:
- Mayor rendimiento para grandes volúmenes de datos
- Soporte para consultas complejas
- Mejor escalabilidad
- Reutilización de imágenes ya descargadas cuando se cambia entre tipos de base de datos
- Capacidades avanzadas de indexación
- Mejor para entornos de producción y alta concurrencia

## Estructura de la Base de Datos

### Tablas Principales

1. **inmuebles**: Almacena los datos de las propiedades inmobiliarias
2. **imagenes**: Almacena información sobre las imágenes de los inmuebles
3. **caracteristicas**: Catálogo de características de inmuebles
   - Estructura: `id`, `nombre`, `categoria`, `icono`
   - Almacena las definiciones de las características disponibles para los inmuebles
4. **inmueble_caracteristicas**: Relación entre inmuebles y sus características
   - Estructura: `id`, `inmueble_id`, `caracteristica_id`, `valor`
   - El campo `valor` almacena el valor de la característica como texto
5. **ejecuciones**: Registro de las sincronizaciones realizadas
6. **historial_cambios**: Registro de cambios en los inmuebles

## Recomendaciones de Uso

1. **Sincronizaciones regulares**: Programar sincronizaciones periódicas (por ejemplo, cada 6 horas)
2. **Limpieza automática**: Configurar una tarea cron para ejecutar el script de limpieza diariamente
3. **Monitoreo**: Revisar regularmente el estado de las sincronizaciones y los errores registrados
4. **Respaldo**: Realizar respaldos regulares de la base de datos y las imágenes

## Sistema de Estados Personalizados

El sistema implementa un mecanismo para mantener estados personalizados de los inmuebles entre sincronizaciones:

1. **Estados disponibles**:
   - `activo`: Indica si el inmueble está activo (visible) o inactivo (oculto)
   - `destacado`: Indica si el inmueble debe mostrarse como destacado
   - `en_caliente`: Indica si el inmueble está en promoción especial (prioridad sobre destacados)

2. **Funcionamiento**:
   - Los estados personalizados se guardan en la tabla `inmuebles_estados`
   - Durante la sincronización, estos estados se preservan aunque lleguen nuevos datos
   - Si un inmueble tiene valores por defecto (activo=true, destacado=false, en_caliente=false), no se guarda en la tabla
   - Solo se guardan estados personalizados que difieren de los valores por defecto

3. **Gestión**:
   - Utilizar el script `update-property-state.js` para modificar estados
   - Los estados se mantienen incluso después de reiniciar la base de datos con `reset-db.js`
   - Solo se eliminan con un reseteo completo usando `reset-db-full.js`

## Sistema de Etiquetas

El sistema implementa un mecanismo de etiquetas para clasificar los inmuebles:

1. **Características**:
   - Relación muchos a muchos entre inmuebles y etiquetas
   - Las etiquetas tienen nombre, color y descripción
   - Las etiquetas no se modifican durante la sincronización

2. **Etiquetas predeterminadas**:
   - Promoción (rojo): Inmuebles en promoción especial
   - Nuevo (verde): Inmuebles recién añadidos
   - Rebajado (naranja): Inmuebles con precio rebajado
   - Exclusivo (morado): Inmuebles exclusivos
   - Oportunidad (naranja oscuro): Oportunidades de inversión

3. **Gestión**:
   - Utilizar el script `manage-property-tags.js` para gestionar etiquetas
   - Se pueden crear nuevas etiquetas personalizadas
   - Se pueden asignar múltiples etiquetas a un inmueble

## Solución de Problemas Comunes

### Sincronización Bloqueada

**Síntoma**: Una sincronización lleva mucho tiempo en estado "en_progreso".

**Solución**:
```bash
node scripts/clean-syncs.js --sync-id=<ID>
```

### Error en la Base de Datos

**Síntoma**: Errores relacionados con la estructura de la base de datos.

**Solución**:
```bash
node scripts/reset-db.js --confirmar
node scripts/sync-js.js
```

### Errores en Imágenes

**Síntoma**: Errores al descargar o procesar imágenes.

**Solución**:
```bash
# Sincronizar sin descargar imágenes
node scripts/sync-js.js --no-imagenes
```



## Configuración de Base de Datos

### MySQL en Docker

El sistema está configurado para trabajar con MySQL en un contenedor Docker con las siguientes características:

1. **Puerto**: 3307 (mapeado al puerto 3306 interno del contenedor)
2. **Credenciales**:
   - Usuario principal: root / rootpassword
   - Usuario alternativo: syncorbis / password
3. **Base de datos**: inmuebles
4. **Configuración en .env**:
   ```
   DB_TYPE=mysql
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=rootpassword
   MYSQL_DATABASE=inmuebles
   ```

### SQLite (Alternativa)

Como alternativa, el sistema puede utilizar SQLite:

1. **Archivo de base de datos**: ./inmuebles_db.sqlite
2. **Configuración en .env**:
   ```
   DB_TYPE=sqlite
   SQLITE_PATH=./inmuebles_db.sqlite
   ```

## Mejoras y Correcciones Implementadas

### 1. Optimización de Sincronización

- Mejora en la detección de cambios usando hashes MD5
- Procesamiento más eficiente de imágenes
- Reducción de consultas a la base de datos

### 2. Corrección de Sincronizaciones Bloqueadas

- Implementación de script de limpieza
- Mejora en el manejo de errores
- Registro detallado de ejecuciones

### 3. Compatibilidad con MySQL y SQLite

- Soporte para ambos sistemas de base de datos
- Adaptación dinámica según configuración
- Manejo adecuado de tipos de datos específicos
- Reutilización de imágenes ya descargadas cuando se cambia entre tipos de base de datos

### 4. Implementación de Estados Personalizados

- Adición de tres estados personalizados: activo, destacado, en_caliente
- Creación de tabla inmuebles_estados para persistencia
- Desarrollo de script de gestión de estados
- Integración con el proceso de sincronización

### 5. Sistema de Etiquetas

- Implementación de sistema de etiquetas personalizables
- Creación de tablas etiquetas e inmuebles_etiquetas
- Desarrollo de script de gestión de etiquetas
- Configuración de etiquetas predeterminadas

### 6. Correcciones en el Manejo de Imágenes

- Adaptación del script para usar la estructura correcta de la tabla imagenes
- Corrección de nombres de columnas (url, url_local)
- Mejora en la detección y descarga de imágenes nuevas
- Optimización del almacenamiento de imágenes

### 7. Mejoras en la Estructura de la Base de Datos

- Adición de campos para áreas específicas (area_construida, area_privada, area_terreno)
- Adaptación para usar los nombres de columnas correctos en todas las tablas
- Corrección de referencias a campos relacionales (uso_id, estado_actual_id)
- Optimización de tipos de datos para mejor rendimiento

### 8. Mejoras en los Scripts de Gestión

- Creación de script reset-db-full.js para reinicio completo
- Mejora en el script check-db.js para mostrar estados y etiquetas
- Desarrollo de scripts especializados para gestión de estados y etiquetas
- Optimización de comandos y parámetros para mejor usabilidad

## Sistema de Estados Personalizados

El sistema de sincronización incluye un mecanismo para mantener estados personalizados de los inmuebles entre sincronizaciones. Esto permite que ciertos estados definidos por el usuario se mantengan incluso cuando se actualiza un inmueble desde la API.

### Estados Implementados

Se han implementado tres estados personalizados para las propiedades:

1. **activo** (boolean): Determina si la propiedad es visible en el sitio web
   - Valor predeterminado: `true`
   - Cuando es `false`, la propiedad no se muestra en el sitio web pero se mantiene en la base de datos

2. **destacado** (boolean): Marca la propiedad como destacada
   - Valor predeterminado: `false`
   - Cuando es `true`, la propiedad aparece en secciones destacadas del sitio web

3. **en_caliente** (boolean): Indica una propiedad en promoción especial
   - Valor predeterminado: `false`
   - Cuando es `true`, la propiedad se muestra como una oportunidad especial o promoción

### Funcionamiento

1. **Tabla inmuebles_estados**: Almacena los estados personalizados de los inmuebles con la siguiente estructura:
   - `id`: Identificador único
   - `inmueble_ref`: Referencia del inmueble
   - `codigo_sincronizacion`: Código de sincronización del inmueble
   - `activo`: Estado activo/inactivo
   - `destacado`: Estado destacado/no destacado
   - `en_caliente`: Estado en caliente/normal
   - `fecha_modificacion`: Fecha de última modificación
   - `created_at`: Fecha de creación
   - `updated_at`: Fecha de actualización

2. **Preservación durante sincronización**: 
   - El script de sincronización verifica si un inmueble tiene estados personalizados guardados
   - Si existen estados personalizados, se aplican durante la sincronización
   - Si no existen, se utilizan los valores predeterminados (activo=true, destacado=false, en_caliente=false)

3. **Optimización de almacenamiento**:
   - Si un inmueble tiene los valores predeterminados (activo=true, destacado=false, en_caliente=false), no se guarda en la tabla `inmuebles_estados`
   - Solo se guardan los estados personalizados que difieren de los valores predeterminados

4. **Gestión independiente**:
   - Las etiquetas se pueden gestionar independientemente del proceso de sincronización
   - El script `manage-property-tags.js` proporciona todas las funcionalidades necesarias

### Uso del Script de Actualización de Estados

El script `update-property-state.js` permite gestionar manualmente los estados personalizados:

```bash
# Marcar un inmueble como destacado
node scripts/update-property-state.js --ref=123 --destacado=true

# Desactivar un inmueble
node scripts/update-property-state.js --ref=123 --activo=false

# Marcar un inmueble como en caliente
node scripts/update-property-state.js --ref=123 --en-caliente=true

# Actualizar múltiples estados a la vez
node scripts/update-property-state.js --ref=123 --destacado=true --en-caliente=true --activo=true
```

### Verificación de Estados

Para verificar los estados personalizados guardados:

```bash
node scripts/check-db.js
```

Este comando mostrará una tabla con todos los inmuebles y sus estados actuales, así como una tabla con los estados personalizados guardados en la tabla `inmuebles_estados`.

### Persistencia de Estados

- Los estados se mantienen incluso después de reiniciar la base de datos con `reset-db.js`
- Solo se eliminan con un reseteo completo usando `reset-db-full.js`

## Sistema de Etiquetas

Se ha implementado un sistema de etiquetas para clasificar inmuebles según diferentes criterios. Las etiquetas son completamente personalizables y se pueden asignar a cualquier inmueble.

### Características del Sistema de Etiquetas

1. **Etiquetas personalizables**: Cada etiqueta tiene:
   - Nombre: Identificador legible
   - Color: Código hexadecimal para representación visual
   - Descripción: Explicación del propósito de la etiqueta

2. **Relación muchos a muchos**: 
   - Un inmueble puede tener múltiples etiquetas
   - Una etiqueta puede estar asociada a múltiples inmuebles
   - Esta relación se gestiona mediante una tabla intermedia `inmuebles_etiquetas`

3. **Persistencia entre sincronizaciones**:
   - Las etiquetas asignadas a los inmuebles se mantienen entre sincronizaciones
   - La tabla `inmuebles_etiquetas` preserva estas relaciones

4. **Gestión independiente**:
   - Las etiquetas se pueden gestionar independientemente del proceso de sincronización
   - El script `manage-property-tags.js` proporciona todas las funcionalidades necesarias

### Estructura de la Base de Datos

1. **Tabla etiquetas**:
   - `id`: Identificador único
   - `nombre`: Nombre de la etiqueta
   - `color`: Código de color hexadecimal
   - `descripcion`: Descripción de la etiqueta
   - `created_at`: Fecha de creación
   - `updated_at`: Fecha de actualización

2. **Tabla inmuebles_etiquetas**:
   - `id`: Identificador único
   - `inmueble_id`: ID del inmueble
   - `etiqueta_id`: ID de la etiqueta
   - `created_at`: Fecha de creación
   - `updated_at`: Fecha de actualización

### Etiquetas Predeterminadas

El sistema viene con cinco etiquetas predeterminadas:

1. **Promoción** (#e74c3c): Inmuebles en promoción especial
2. **Nuevo** (#2ecc71): Inmuebles recién añadidos
3. **Rebajado** (#f39c12): Inmuebles con precio rebajado
4. **Exclusivo** (#9b59b6): Inmuebles exclusivos
5. **Oportunidad** (#e67e22): Oportunidades de inversión

### Uso del Script de Gestión de Etiquetas

El script `manage-property-tags.js` proporciona todas las funcionalidades necesarias para gestionar etiquetas:

```bash
# Añadir una etiqueta a un inmueble
node scripts/manage-property-tags.js --add --inmueble=123 --etiqueta=1

# Eliminar una etiqueta de un inmueble
node scripts/manage-property-tags.js --remove --inmueble=123 --etiqueta=1

# Listar las etiquetas de un inmueble
node scripts/manage-property-tags.js --list --inmueble=123

# Listar los inmuebles con una etiqueta específica
node scripts/manage-property-tags.js --list --etiqueta=1

# Crear una nueva etiqueta
node scripts/manage-property-tags.js --create --nombre="Nueva etiqueta" --color="#FF5733" --descripcion="Descripción opcional"
```

### Integración con el Frontend

Las etiquetas pueden utilizarse en el frontend para:

1. **Filtrado**: Permitir a los usuarios filtrar inmuebles por etiquetas
2. **Visualización**: Mostrar etiquetas con sus colores en las tarjetas de inmuebles
3. **Categorización**: Agrupar inmuebles por etiquetas en secciones específicas
4. **Búsqueda**: Mejorar las capacidades de búsqueda incluyendo etiquetas como criterio
## Conclusiones

El sistema de sincronización de SyncOrbis Express proporciona una solución robusta y eficiente para mantener actualizada la base de datos de inmuebles desde la API de Orbis. Las mejoras implementadas han resuelto los problemas de sincronizaciones bloqueadas y han optimizado el proceso, reduciendo el tiempo de sincronización y mejorando la fiabilidad del sistema.

La implementación de los sistemas de estados personalizados y etiquetas añade una capa adicional de flexibilidad y funcionalidad, permitiendo una gestión más detallada de los inmuebles y una mejor experiencia para los usuarios finales. Estas características permiten:

1. **Mayor control sobre la visibilidad**: Los estados personalizados permiten controlar qué inmuebles se muestran y cómo se destacan.

2. **Categorización flexible**: El sistema de etiquetas permite clasificar los inmuebles según múltiples criterios simultáneamente.

3. **Persistencia de datos personalizados**: Los estados y etiquetas se mantienen entre sincronizaciones, preservando la información personalizada.

4. **Gestión independiente**: Los scripts dedicados permiten gestionar estados y etiquetas sin interferir con el proceso de sincronización.

5. **Adaptabilidad a diferentes necesidades**: La combinación de estados y etiquetas permite adaptar el sistema a diversos requisitos de negocio.

Las correcciones realizadas en el manejo de imágenes y la estructura de la base de datos han mejorado la estabilidad y fiabilidad del sistema, asegurando que todas las funcionalidades trabajen correctamente juntas.

En resumen, SyncOrbis Express ahora ofrece un sistema completo y robusto para la sincronización y gestión de propiedades inmobiliarias, con características avanzadas que permiten una personalización detallada y una experiencia de usuario mejorada.
