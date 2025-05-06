# SyncOrbis Express - Sincronización de Inmuebles

Aplicación Express.js para sincronizar datos de propiedades inmobiliarias desde la API de Orbis a una base de datos local (SQLite o MySQL).

## Novedades y Mejoras

### Mayo 2025
- **Instalación Simplificada**: Nuevo script `setup.js` para verificar y configurar automáticamente el entorno
- **Soporte para Docker** (opcional): Nuevo script `setup-docker.js` para configurar la base de datos en Docker (ideal para desarrollo)
- **Optimización de Rendimiento**: Script `optimize-sync.js` para mejorar la velocidad de sincronización
- **Corrección de Estructura de BD**: Añadidas columnas faltantes en la tabla `inmuebles`
- **Documentación Mejorada**: Nuevas guías de instalación, optimización y solución de problemas

## Características Implementadas

- Sincronización automatizada con la API de propiedades inmobiliarias
- Detección eficiente de cambios mediante verificación de hash MD5
- Descarga y gestión de imágenes de propiedades
- Registro detallado de cambios y estadísticas de sincronización
- Manejo robusto de errores y mecanismos de recuperación
- Limpieza automática de procesos de sincronización huérfanos
- Herramientas para reinicio y limpieza manual del sistema
- Soporte para múltiples bases de datos (SQLite y MySQL)
- Opciones de despliegue flexibles (local, hosting compartido, Docker)

## Instalación

SyncOrbisExpress ofrece dos opciones de instalación para adaptarse a diferentes entornos:

### Opción 1: Instalación Estándar (Recomendada para Producción)

1. Clonar el repositorio
2. Instalar dependencias:

```bash
npm install
```

3. Configurar variables de entorno:

```bash
cp .env.example .env
# Editar el archivo .env con tus credenciales
```

4. Ejecutar el script de instalación y verificación:

```bash
npm run setup
```

Este script verificará el entorno, la estructura de la base de datos y realizará las correcciones necesarias automáticamente.

5. Optimizar la sincronización (opcional pero recomendado):

```bash
npm run optimize
```

### Opción 2: Instalación con Docker (Opcional, Recomendada para Desarrollo)

1. Clonar el repositorio e instalar dependencias:

```bash
git clone https://github.com/aryeteinc/SynOrbisExpress.git
cd SynOrbisExpress
npm install
```

2. Configurar MySQL en Docker (opcional):

```bash
npm run setup:docker
```

3. Ejecutar el script de instalación con la opción de Docker:

```bash
npm run setup -- --docker
```

4. Optimizar la sincronización:

```bash
npm run optimize
```

> **IMPORTANTE**: El uso de Docker es completamente opcional y está pensado principalmente para entornos de desarrollo. En producción, se recomienda usar la instalación estándar con MySQL instalado directamente en el servidor.

## Configuración

### Archivo .env

El archivo `.env` contiene todas las variables de entorno necesarias para configurar el sistema. Puedes crear este archivo copiando el archivo `.env.example` y modificando los valores según tus necesidades:

```bash
cp .env.example .env
```

Principales variables de configuración:

```
# Configuración de la API
API_URL=https://tu-api-url.com

# Configuración de la base de datos
DB_TYPE=mysql            # mysql o sqlite

# MySQL (si DB_TYPE=mysql)
MYSQL_HOST=localhost     # o 'mysql' si usas Docker
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=tu_contraseña
MYSQL_DATABASE=inmuebles

# SQLite (si DB_TYPE=sqlite)
SQLITE_PATH=./inmuebles_db.sqlite

# Almacenamiento de imágenes
IMAGES_FOLDER=./public/images/inmuebles

# Docker (opcional, solo si usas Docker)
DOCKER_NETWORK=syncorbis-network
DOCKER_MYSQL_CONTAINER=syncorbis-mysql
DOCKER_MYSQL_ROOT_PASSWORD=syncorbis
```

4. Iniciar la aplicación en modo desarrollo:

```bash
npm run dev
```

## Configuración de la Base de Datos

El sistema soporta dos tipos de bases de datos:

### SQLite (predeterminado)

Para usar SQLite, configura las siguientes variables de entorno:
```
DB_TYPE=sqlite
SQLITE_PATH=./inmuebles_db.sqlite
```

### MySQL

Para usar MySQL, configura las siguientes variables de entorno:
```
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=tu_contraseña
MYSQL_DATABASE=inmuebles
```

Asegúrate de crear la base de datos en MySQL antes de ejecutar la aplicación:
```sql
CREATE DATABASE inmuebles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Estructura de la Base de Datos

### Tablas Principales

- `inmuebles`: Propiedades inmobiliarias con sus detalles
- `imagenes`: Imágenes de las propiedades
- `caracteristicas`: Características de las propiedades
- `inmueble_caracteristicas`: Relación entre propiedades y características
- `historial_cambios`: Historial de cambios en las propiedades
- `ejecuciones`: Registros de ejecuciones de sincronización

## API Endpoints Implementados

### Endpoints de Sincronización

#### Iniciar sincronización
```
POST /api/sync/start
```

Inicia un proceso de sincronización manual con la API de Orbis.

**Autenticación:** Requiere rol de administrador

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "message": "Sincronización iniciada correctamente",
  "data": {
    "sync_id": 15
  }
}
```

#### Obtener estado de sincronización actual
```
GET /api/sync/current
```

Devuelve el estado del proceso de sincronización actual, si existe.

**Autenticación:** Requiere rol de administrador

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 15,
    "fecha_inicio": "2025-04-13T10:08:09.720Z",
    "fecha_fin": null,
    "estado": "en_progreso",
    "tipo": "manual",
    "usuario": "admin",
    "total_inmuebles": 158,
    "nuevos": 0,
    "actualizados": 0,
    "sin_cambios": 0,
    "errores": 0,
    "runtime_seconds": 5
  }
}
```

#### Limpiar sincronizaciones bloqueadas
```
POST /api/sync/clean
```

Limpia sincronizaciones que se han quedado bloqueadas en estado "en_progreso".

**Autenticación:** Requiere rol de administrador

**Parámetros:**
- `minutes`: Tiempo en minutos para considerar una sincronización como huérfana (opcional)
- `syncId`: ID de la sincronización a limpiar (opcional)

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "message": "Se limpiaron 2 sincronizaciones bloqueadas"
}
```

## Scripts de Sincronización

### Cómo Funciona

1. **Obtención de Datos**:
   - El sistema se conecta a la API de Orbis para obtener datos de propiedades
   - La respuesta de la API se procesa y normaliza para coincidir con el esquema de la base de datos

2. **Detección de Cambios**:
   - Para cada propiedad, el sistema calcula un hash MD5 de los campos clave
   - Este hash se compara con el hash almacenado para detectar cambios
   - Solo se actualizan las propiedades con cambios, optimizando el proceso

3. **Sincronización de Imágenes**:
   - Las imágenes de cada propiedad se descargan y almacenan localmente
   - La verificación de hash MD5 evita descargar nuevamente imágenes sin cambios
   - Las imágenes se almacenan en una estructura de directorios organizada por ID de propiedad

### Scripts Disponibles

1. **Script de Sincronización en JavaScript**:
   ```bash
   node scripts/sync-js.js [--limite=N] [--no-imagenes] [--execution-id=ID]
   ```
   Este script realiza la sincronización completa de datos e imágenes.

2. **Script de Limpieza**:
   ```bash
   node scripts/clean-syncs.js [--minutes=N] [--sync-id=ID]
   ```
   Este script limpia los procesos de sincronización huérfanos o bloqueados.

3. **Script de Reinicio de Base de Datos**:
   ```bash
   node scripts/reset-db.js --confirmar
   ```
   Este script reinicia completamente la base de datos y elimina todas las imágenes.

## Autenticación

La API utiliza JWT (JSON Web Token) para la autenticación. Para acceder a los endpoints protegidos, debes incluir el token JWT en el encabezado de Autorización:

```
Authorization: Bearer <token>
```

Para obtener un token, utiliza el endpoint de inicio de sesión:

```
POST /api/auth/login
```

Con el siguiente cuerpo:

```json
{
  "username": "admin",
  "password": "tu_contraseña"
}
```

## Solución de Problemas Comunes

1. **Sincronización bloqueada**:
   - Utiliza el script de limpieza para resolver sincronizaciones bloqueadas
   - `node scripts/clean-syncs.js --sync-id=<ID>`

2. **Errores en la base de datos**:
   - Reinicia la base de datos para resolver problemas estructurales
   - `node scripts/reset-db.js --confirmar`
   - Para errores de columnas faltantes como "Unknown column 'area_construida' in 'field list'"
   - `node scripts/fix-inmuebles-table.js`

3. **Errores en imágenes**:
   - Verifica que el directorio de imágenes exista y tenga permisos de escritura
   - `mkdir -p ./public/images/inmuebles`
   - `chmod -R 755 ./public/images/inmuebles`

4. **Sincronización lenta**:
   - Optimiza la base de datos y el rendimiento
   - `node scripts/optimize-sync.js`

5. **Instalación en nueva máquina**:
   - Utiliza el script de instalación y verificación
   - `node scripts/setup.js`

## Comandos Rápidos

SyncOrbisExpress incluye varios scripts NPM para facilitar su uso:

```bash
# Instalación y configuración
npm run setup              # Configuración estándar
npm run setup -- --docker  # Configuración con Docker
npm run setup:docker       # Configurar MySQL en Docker (opcional)

# Sincronización
npm run sync:js            # Sincronización completa
npm run sync:js -- --limite=100  # Sincronización con límite

# Optimización y mantenimiento
npm run optimize           # Optimizar la base de datos
npm run fix-inmuebles      # Corregir tabla inmuebles
```

Para más detalles, consulta la [Guía Rápida](docs/guia-rapida.md).

## Documentación Adicional

- [Guía Rápida](docs/guia-rapida.md) - Comandos y operaciones más comunes
- [Guía de Instalación Estándar](docs/instalacion.md) - Instrucciones detalladas para instalar y configurar SyncOrbisExpress
- [Guía de Instalación con Docker](docs/instalacion-docker.md) - Configuración opcional con Docker para desarrollo
- [Guía de Reinstalación](docs/reinstalacion.md) - Proceso completo para reinstalar desde cero en una nueva máquina
- [Guía de Optimización](docs/optimizacion.md) - Técnicas para mejorar el rendimiento de la sincronización
- [Solución de Problemas](docs/solucion-problemas.md) - Soluciones para los problemas más comunes
- [Sincronización](docs/sincronizacion.md) - Detalles sobre el proceso de sincronización
- [Documentación General](docs/README.md) - Índice completo de documentación
