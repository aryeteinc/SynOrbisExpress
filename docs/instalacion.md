# Guía de Instalación de SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para instalar y configurar SyncOrbisExpress en un nuevo entorno.

## Requisitos Previos

- Node.js (versión 14 o superior)
- MySQL (versión 5.7 o superior)
- Git

## Pasos de Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/SyncOrbisExpress.git
cd SyncOrbisExpress
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar el Entorno

Copia el archivo de ejemplo de configuración:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```
# Configuración de la base de datos
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_DATABASE=inmuebles

# Configuración de la API
API_URL=https://tu-api-url.com
API_KEY=tu_api_key

# Configuración de la aplicación
IMAGES_FOLDER=./public/images/inmuebles
```

### 4. Ejecutar el Script de Instalación y Verificación

Este script verificará el entorno, la estructura de la base de datos y realizará las correcciones necesarias:

```bash
node scripts/setup.js
```

Si deseas forzar la instalación (por ejemplo, para recrear las tablas):

```bash
node scripts/setup.js --force
```

### 5. Optimizar la Sincronización

Para mejorar el rendimiento de la sincronización:

```bash
node scripts/optimize-sync.js
```

### 6. Ejecutar la Sincronización

```bash
node scripts/sync-js.js
```

## Estructura de Directorios

- `scripts/`: Scripts para la sincronización y administración
- `public/`: Archivos públicos (imágenes, etc.)
- `docs/`: Documentación
- `node_modules/`: Dependencias de Node.js (generado automáticamente)

## Verificación de la Instalación

Para verificar que la instalación se ha realizado correctamente:

1. Comprueba que la base de datos se ha creado correctamente
2. Verifica que las tablas se han creado con la estructura correcta
3. Ejecuta una sincronización de prueba con un límite pequeño:

```bash
node scripts/sync-js.js --limite=5
```

## Solución de Problemas Comunes

### Error de Conexión a la Base de Datos

Si recibes un error de conexión a la base de datos:

1. Verifica que MySQL esté en ejecución
2. Comprueba las credenciales en el archivo `.env`
3. Asegúrate de que la base de datos exista

### Error de Estructura de Tabla

Si recibes un error como "Unknown column 'area_construida' in 'field list'":

1. Ejecuta el script de corrección de la tabla:

```bash
node scripts/fix-inmuebles-table.js
```

### Error de Permisos de Directorio

Si recibes un error de permisos al guardar imágenes:

1. Verifica que el directorio de imágenes exista
2. Asegúrate de que el usuario tenga permisos de escritura:

```bash
chmod -R 755 ./public/images/inmuebles
chown -R $(whoami) ./public/images/inmuebles
```

### Error de API

Si recibes un error al conectar con la API:

1. Verifica la URL y la clave de API en el archivo `.env`
2. Comprueba que la API esté en línea y accesible

## Actualizaciones

Para actualizar SyncOrbisExpress a la última versión:

```bash
git pull
npm install
node scripts/setup.js
```

## Soporte

Si encuentras algún problema que no puedes resolver, por favor abre un issue en el repositorio de GitHub o contacta al equipo de soporte.
