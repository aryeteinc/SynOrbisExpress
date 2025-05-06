# Guía de Reinstalación de SyncOrbisExpress

Esta guía proporciona instrucciones paso a paso para reinstalar completamente SyncOrbisExpress en una nueva máquina o después de borrar la instalación anterior.

## Requisitos Previos

- Node.js (versión 14 o superior)
- MySQL (versión 5.7 o superior) o Docker
- Git

## Proceso de Reinstalación Completa

### 1. Eliminar la Instalación Anterior (si existe)

Si estás reinstalando en una máquina con una instalación anterior:

```bash
# Detener cualquier proceso en ejecución
pm2 stop all  # Si usas PM2
# O
killall node  # Alternativa para detener todos los procesos de Node.js

# Eliminar el directorio de la aplicación
rm -rf /ruta/a/SyncOrbisExpress
```

### 2. Clonar el Repositorio

```bash
git clone https://github.com/aryeteinc/SynOrbisExpress.git
cd SynOrbisExpress
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Configurar el Entorno

Copia el archivo de ejemplo de configuración:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales. Asegúrate de configurar correctamente:

```
# Configuración de la base de datos
DB_TYPE=mysql
DB_HOST=localhost  # O usa 'mysql' si utilizas Docker
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_DATABASE=inmuebles

# Configuración de la API
API_URL=https://tu-api-url.com
API_KEY=tu_api_key

# Configuración de la aplicación
IMAGES_FOLDER=./public/images/inmuebles

# Configuración de Docker (opcional)
USE_DOCKER=false  # Cambia a 'true' si deseas usar Docker
DOCKER_MYSQL_ROOT_PASSWORD=root_password
DOCKER_MYSQL_DATABASE=inmuebles
DOCKER_MYSQL_USER=mysql_user
DOCKER_MYSQL_PASSWORD=mysql_password
```

### 5. Configurar la Base de Datos

#### Opción A: Instalación Estándar (MySQL local)

```bash
# Ejecutar el script de configuración
node scripts/setup.js
```

#### Opción B: Instalación con Docker

```bash
# Asegúrate de que USE_DOCKER=true en tu archivo .env
# Ejecutar el script de configuración de Docker
node scripts/setup-docker.js

# Luego ejecutar el script de configuración general
node scripts/setup.js
```

### 6. Corregir la Estructura de la Base de Datos

Este paso es crucial para asegurar que todas las columnas necesarias existan en la tabla `inmuebles`:

```bash
node scripts/fix-inmuebles-table.js
```

### 7. Optimizar la Base de Datos para Sincronización

```bash
node scripts/optimize-sync.js
```

### 8. Ejecutar la Sincronización Inicial

```bash
node scripts/sync-js.js
```

### 9. Verificar la Instalación

Para verificar que la instalación se ha realizado correctamente:

1. Comprueba que la sincronización se ha completado sin errores
2. Verifica que las imágenes se han descargado correctamente
3. Comprueba que los datos están disponibles en la base de datos

```bash
# Verificar el estado de la base de datos (opcional)
mysql -u tu_usuario -p inmuebles -e "SELECT COUNT(*) FROM inmuebles;"
```

## Solución de Problemas Comunes

### Error de Conexión a la Base de Datos

Si recibes un error de conexión a la base de datos:

1. Verifica que MySQL esté en ejecución
2. Comprueba las credenciales en el archivo `.env`
3. Asegúrate de que la base de datos exista

### Error de Estructura de Tabla

Si recibes errores como "Unknown column" durante la sincronización:

```bash
# Ejecutar nuevamente el script de corrección de tablas
node scripts/fix-inmuebles-table.js
```

### Error de Permisos de Directorio

Si recibes un error de permisos al guardar imágenes:

```bash
# Crear el directorio si no existe
mkdir -p ./public/images/inmuebles

# Asignar permisos adecuados
chmod -R 755 ./public/images/inmuebles
chown -R $(whoami) ./public/images/inmuebles
```

## Notas Importantes

- **Respaldo de Datos**: Si estás reinstalando en una máquina con datos existentes, considera hacer un respaldo de la base de datos antes de comenzar.
- **Archivos de Imágenes**: Si deseas preservar las imágenes ya descargadas, haz una copia del directorio `public/images/inmuebles` antes de eliminar la instalación anterior.
- **Configuración Personalizada**: Si has realizado personalizaciones en archivos de configuración, asegúrate de documentarlas y volver a aplicarlas después de la reinstalación.

## Soporte

Si encuentras algún problema durante la reinstalación, por favor abre un issue en el repositorio de GitHub o contacta al equipo de soporte.
