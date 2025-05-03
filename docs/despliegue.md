# Guía de Despliegue - SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en diferentes entornos, incluyendo hosting compartido y servidores premium (VPS/dedicados).

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Preparación del Bundle de Producción](#preparación-del-bundle-de-producción)
3. [Despliegue en Hosting Compartido](#despliegue-en-hosting-compartido)
4. [Despliegue en Hosting Premium/VPS](#despliegue-en-hosting-premium)
5. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
6. [Configuración del Cron Job](#configuración-del-cron-job)
7. [Solución de Problemas Comunes](#solución-de-problemas-comunes)
8. [Mantenimiento y Actualización](#mantenimiento-y-actualización)

## Requisitos Previos

Antes de comenzar el despliegue, asegúrate de tener:

- Node.js v14.x o superior instalado en el servidor
- Acceso a MySQL (versión 5.7 o superior)
- Acceso SSH al servidor (recomendado, pero no obligatorio para hosting compartido)
- Git (opcional, para clonar el repositorio)

## Preparación del Bundle de Producción

Antes de desplegar la aplicación, es recomendable crear un bundle de producción optimizado. Para instrucciones detalladas sobre cómo crear este bundle, consulta el documento [bundle_produccion.md](./bundle_produccion.md).

En resumen, el proceso incluye:

1. **Limpiar archivos temporales**
2. **Generar el bundle usando el script de construcción**
3. **Verificar el contenido del bundle**
4. **Comprimir el bundle para su transferencia**

Una vez que tengas el bundle de producción listo, puedes proceder con el despliegue siguiendo las instrucciones a continuación.

## Despliegue en Hosting Compartido

Los hostings compartidos suelen tener limitaciones en cuanto a recursos y configuración. Sigue estos pasos para desplegar SyncOrbisExpress:

### 1. Preparar los archivos

**Opción A: Subir mediante FTP**

1. Comprime todo el proyecto en un archivo ZIP (excluyendo `node_modules` y cualquier archivo de imagen descargado)
2. Sube el archivo ZIP a tu hosting mediante FTP
3. Descomprime el archivo en el directorio deseado (ej. `/public_html/syncorbis`)

**Opción B: Usar Git (si está disponible)**

```bash
# Conéctate a tu hosting por SSH (si está disponible)
ssh usuario@tudominio.com

# Navega al directorio deseado
cd public_html

# Clona el repositorio
git clone https://github.com/tuusuario/SyncOrbisExpress.git syncorbis

# Entra al directorio
cd syncorbis
```

### 2. Instalar dependencias

```bash
# Instalar dependencias de Node.js
npm install --production
```

Si tu hosting no permite instalar paquetes globalmente, usa:
```bash
npm install --production --prefix ./
```

### 3. Configurar variables de entorno

La mayoría de los hostings compartidos no soportan archivos `.env`. En este caso, crea un archivo `config.js` en la raíz del proyecto:

```javascript
// config.js
process.env.DB_TYPE = 'mysql';
process.env.MYSQL_HOST = 'localhost'; // O la dirección proporcionada por tu hosting
process.env.MYSQL_PORT = '3306';
process.env.MYSQL_USER = 'tu_usuario_mysql';
process.env.MYSQL_PASSWORD = 'tu_contraseña_mysql';
process.env.MYSQL_DATABASE = 'nombre_de_tu_base_de_datos';
process.env.API_URL = 'https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/';
process.env.IMAGES_FOLDER = './imagenes_inmuebles';
process.env.ASESOR_IMAGES_FOLDER = './imagenes_asesores';
```

Luego, modifica el inicio de los scripts para cargar este archivo:

```javascript
// Al inicio de sync-js.js (después de los requires)
try {
  require('./config.js');
} catch (e) {
  // Si no existe config.js, usar dotenv
  require('dotenv').config();
}
```

### 4. Crear carpetas necesarias

Asegúrate de que las siguientes carpetas tengan permisos de escritura:
```bash
mkdir -p imagenes_inmuebles
mkdir -p imagenes_asesores
chmod 755 imagenes_inmuebles
chmod 755 imagenes_asesores
```

### 5. Ejecutar la sincronización inicial

```bash
# Ejecutar la sincronización inicial con un límite bajo para probar
node scripts/sync-js.js --limite=10

# Si todo funciona correctamente, ejecutar la sincronización completa
node scripts/sync-js.js
```

## Despliegue en Hosting Premium/VPS

En un servidor VPS o hosting premium tienes más control y flexibilidad:

### 1. Configurar el servidor

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js (si no está instalado)
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar MySQL (si no está instalado)
sudo apt install -y mysql-server

# Configurar MySQL
sudo mysql_secure_installation

# Instalar PM2 para gestionar procesos de Node.js
sudo npm install -g pm2
```

### 2. Clonar el repositorio

```bash
# Navegar al directorio donde quieres instalar la aplicación
cd /var/www

# Clonar el repositorio
git clone https://github.com/tuusuario/SyncOrbisExpress.git syncorbis

# Entrar al directorio
cd syncorbis

# Instalar dependencias
npm install --production
```

### 3. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar el archivo .env
nano .env
```

Configura las variables en el archivo `.env`:
```
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=tu_usuario_mysql
MYSQL_PASSWORD=tu_contraseña_mysql
MYSQL_DATABASE=inmuebles
API_URL=https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/
IMAGES_FOLDER=./imagenes_inmuebles
ASESOR_IMAGES_FOLDER=./imagenes_asesores
```

### 4. Configurar PM2 para gestionar el proceso

```bash
# Crear un archivo de configuración para PM2
echo '{
  "apps": [{
    "name": "syncorbis",
    "script": "./scripts/sync-js.js",
    "cwd": "/var/www/syncorbis",
    "instances": 1,
    "autorestart": false,
    "watch": false,
    "max_memory_restart": "1G",
    "env": {
      "NODE_ENV": "production"
    }
  }]
}' > pm2-config.json

# Iniciar la aplicación con PM2
pm2 start pm2-config.json

# Configurar PM2 para iniciar automáticamente al reiniciar el servidor
pm2 startup
pm2 save
```

## Configuración de la Base de Datos

### 1. Crear la base de datos

**En hosting compartido (a través de cPanel):**

1. Accede a cPanel
2. Busca la sección "Bases de datos" y haz clic en "MySQL Databases"
3. Crea una nueva base de datos (ej. `usuario_inmuebles`)
4. Crea un nuevo usuario de base de datos
5. Asigna todos los privilegios al usuario para la base de datos creada

**En VPS/hosting premium:**

```sql
CREATE DATABASE inmuebles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'syncorbis'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON inmuebles.* TO 'syncorbis'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Ejecutar la sincronización inicial

La primera vez que ejecutes el script, creará automáticamente todas las tablas necesarias:

```bash
# En hosting compartido
node scripts/sync-js.js

# En VPS/hosting premium (usando PM2)
pm2 start syncorbis
```

### 3. Características de la base de datos

SyncOrbisExpress incluye un sistema para mantener el estado de los inmuebles entre sincronizaciones:

- La tabla `inmuebles_estados` almacena los estados personalizados (activo, destacado, en_caliente)
- El script preserva el valor de estos campos cuando se actualiza un inmueble existente
- También preserva el campo `asesor_id` entre sincronizaciones

Esto permite personalizar los inmuebles en la base de datos y mantener estos cambios incluso después de sincronizar con la API externa.

## Configuración del Cron Job

Para mantener los datos sincronizados automáticamente, configura un cron job:

### En hosting compartido (cPanel)

1. Accede a cPanel
2. Busca la sección "Avanzado" y haz clic en "Tareas Cron"
3. Configura una nueva tarea cron:
   - Minuto: 0
   - Hora: */6 (cada 6 horas)
   - Día: *
   - Mes: *
   - Día de la semana: *
   - Comando: `cd /home/usuario/public_html/syncorbis && /usr/local/bin/node scripts/sync-js.js >> /home/usuario/logs/sync.log 2>&1`

### En VPS/hosting premium

```bash
# Editar el archivo crontab
crontab -e

# Añadir la siguiente línea para ejecutar la sincronización cada 6 horas
0 */6 * * * cd /var/www/syncorbis && /usr/bin/node scripts/sync-js.js >> /var/log/syncorbis.log 2>&1
```

## Solución de Problemas Comunes

### 1. Error de conexión a la base de datos

**Problema**: El script no puede conectarse a la base de datos.

**Solución**: 
- Verifica que las credenciales en el archivo `.env` o `config.js` sean correctas
- Asegúrate de que el usuario tenga permisos para acceder a la base de datos
- En hosting compartido, verifica si necesitas usar un prefijo para el nombre de la base de datos (ej. `usuario_inmuebles`)

### 2. Error de permisos al crear carpetas o descargar imágenes

**Problema**: El script no puede crear carpetas o guardar imágenes.

**Solución**:
```bash
# Asegúrate de que las carpetas tengan los permisos adecuados
chmod -R 755 imagenes_inmuebles
chmod -R 755 imagenes_asesores
```

### 3. Error "Command not found" al ejecutar Node.js

**Problema**: El sistema no encuentra el comando `node`.

**Solución**:
- En hosting compartido, usa la ruta completa al binario de Node.js:
  ```bash
  /usr/local/bin/node scripts/sync-js.js
  ```
- O crea un enlace simbólico:
  ```bash
  ln -s /usr/local/bin/node /usr/bin/node
  ```

### 4. Memoria insuficiente

**Problema**: El script se detiene por falta de memoria.

**Solución**:
- Limita el número de inmuebles procesados por lote:
  ```bash
  node scripts/sync-js.js --limite=50
  ```
- En VPS, aumenta la memoria asignada en PM2:
  ```bash
  pm2 stop syncorbis
  pm2 delete syncorbis
  pm2 start pm2-config.json --node-args="--max-old-space-size=2048"
  ```

## Mantenimiento y Actualización

### Actualización del código

Para actualizar el código a una nueva versión:

```bash
# En hosting compartido (con acceso SSH)
cd /home/usuario/public_html/syncorbis
git pull
npm install --production

# En VPS/hosting premium
cd /var/www/syncorbis
git pull
npm install --production
pm2 restart syncorbis
```

### Copias de seguridad

Es recomendable realizar copias de seguridad regulares de la base de datos y las imágenes:

**Base de datos (MySQL):**
```bash
# Exportar la base de datos
mysqldump -u usuario -p inmuebles > backup_inmuebles_$(date +%Y%m%d).sql

# Comprimir el archivo
gzip backup_inmuebles_$(date +%Y%m%d).sql
```

**Imágenes:**
```bash
# Comprimir las carpetas de imágenes
tar -czf backup_imagenes_$(date +%Y%m%d).tar.gz imagenes_inmuebles imagenes_asesores
```

### Monitoreo

En servidores VPS/dedicados, puedes monitorear la aplicación con PM2:

```bash
# Ver el estado de la aplicación
pm2 status

# Ver los logs en tiempo real
pm2 logs syncorbis

# Ver estadísticas de uso de recursos
pm2 monit
```

---

Esta guía te ayudará a desplegar SyncOrbisExpress tanto en un hosting compartido como en un servidor VPS o hosting premium. El sistema está diseñado para ser flexible y adaptarse a diferentes entornos, creando automáticamente las tablas y carpetas necesarias si no existen.

Si tienes alguna pregunta o problema durante el despliegue, consulta la documentación adicional o contacta al equipo de soporte.
