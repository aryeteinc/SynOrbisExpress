# Guía de Despliegue en DigitalOcean - SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en DigitalOcean, una plataforma de infraestructura en la nube que ofrece Droplets (servidores virtuales) y servicios gestionados.

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Preparación del Bundle de Producción](#preparación-del-bundle-de-producción)
3. [Opciones de Despliegue en DigitalOcean](#opciones-de-despliegue-en-digitalocean)
4. [Despliegue en Droplet (VPS)](#despliegue-en-droplet-vps)
5. [Despliegue con App Platform](#despliegue-con-app-platform)
6. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
7. [Configuración de Espacios para Almacenamiento](#configuración-de-espacios-para-almacenamiento)
8. [Configuración de Dominio y SSL](#configuración-de-dominio-y-ssl)
9. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)

## Requisitos Previos

Antes de comenzar, asegúrate de tener:

1. Una cuenta en [DigitalOcean](https://cloud.digitalocean.com/registrations/new)
2. [doctl](https://github.com/digitalocean/doctl) (CLI de DigitalOcean) instalado (opcional pero recomendado)
3. SSH configurado en tu máquina local
4. El proyecto SyncOrbisExpress en tu máquina local

## Preparación del Bundle de Producción

Antes de desplegar la aplicación, crea un bundle optimizado para producción:

```bash
# Desde la raíz del proyecto en tu máquina local
npm run build:bundle
```

Este comando ejecutará el script `build-prod.sh` que:
1. Limpia la carpeta `dist/`
2. Compila el código TypeScript
3. Copia los scripts JavaScript necesarios
4. Crea las carpetas para imágenes
5. Optimiza el archivo `package.json` para producción

Si deseas una mayor seguridad con código ofuscado, puedes usar:

```bash
npm run build:bundle:obfuscate
```

Una vez completado, comprime la carpeta `dist` para facilitar la transferencia:

```bash
# Comprimir la carpeta dist
cd /Users/joseflorez/SyncOrbisExpress
zip -r syncorbis-bundle.zip dist/
```

## Opciones de Despliegue en DigitalOcean

DigitalOcean ofrece varias opciones para desplegar aplicaciones:

1. **Droplets**: Servidores virtuales donde tienes control total sobre el entorno
2. **App Platform**: Plataforma como servicio (PaaS) similar a Heroku
3. **Kubernetes**: Para aplicaciones más complejas que requieren orquestación de contenedores

Para SyncOrbisExpress, recomendamos Droplets o App Platform, dependiendo de tus necesidades de personalización y gestión.

## Despliegue en Droplet (VPS)

### 1. Crear un Droplet

1. Inicia sesión en tu cuenta de DigitalOcean
2. Haz clic en "Create" y selecciona "Droplets"
3. Selecciona la imagen: Ubuntu 20.04 LTS
4. Elige el plan: Basic (2GB RAM / 1 CPU mínimo recomendado)
5. Selecciona una región cercana a tus usuarios
6. Añade tu clave SSH o configura una contraseña
7. Haz clic en "Create Droplet"

### 2. Conectarse al Droplet

```bash
ssh root@tu-ip-del-droplet
```

### 3. Configurar el servidor

```bash
# Actualizar el sistema
apt update && apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt install -y nodejs

# Verificar instalación
node --version  # Debería mostrar v16.x o superior
npm --version   # Debería mostrar v7.x o superior

# Instalar PM2 globalmente para gestión de procesos
npm install -g pm2

# Instalar Nginx como servidor web
apt install -y nginx

# Configurar firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 4. Crear usuario para la aplicación

```bash
# Crear usuario
adduser syncorbis
usermod -aG sudo syncorbis

# Cambiar al nuevo usuario
su - syncorbis
```

### 5. Transferir y descomprimir el bundle

Desde tu máquina local:
```bash
scp syncorbis-bundle.zip syncorbis@tu-ip-del-droplet:/home/syncorbis/
```

En el Droplet:
```bash
cd /home/syncorbis
unzip syncorbis-bundle.zip
```

### 6. Configurar la aplicación

```bash
# Entrar en la carpeta de la aplicación
cd /home/syncorbis/dist

# Copiar el archivo de configuración
cp .env.example .env

# Editar el archivo de configuración
nano .env
```

Configura las variables en el archivo `.env`:
```
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=syncorbis
MYSQL_PASSWORD=tu_contraseña_segura
MYSQL_DATABASE=inmuebles
API_URL=https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/
IMAGES_FOLDER=./imagenes_inmuebles
ASESOR_IMAGES_FOLDER=./imagenes_asesores
```

### 7. Instalar dependencias

```bash
# Instalar dependencias de producción
npm install --production
```

### 8. Configurar PM2

```bash
# Crear archivo de configuración
nano pm2-config.json
```

Añade el siguiente contenido:
```json
{
  "apps": [
    {
      "name": "syncorbis",
      "script": "index.js",
      "cwd": "/home/syncorbis/dist",
      "instances": 1,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "1G",
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "syncorbis-sync",
      "script": "scripts/sync-js.js",
      "cwd": "/home/syncorbis/dist",
      "instances": 1,
      "autorestart": false,
      "watch": false,
      "cron_restart": "0 */6 * * *",
      "env": {
        "NODE_ENV": "production"
      }
    }
  ]
}
```

```bash
# Iniciar la aplicación
pm2 start pm2-config.json

# Configurar PM2 para iniciar automáticamente al reiniciar el servidor
pm2 startup
pm2 save
```

### 9. Configurar Nginx

```bash
# Crear archivo de configuración
sudo nano /etc/nginx/sites-available/syncorbis
```

Añade el siguiente contenido:
```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Configuración para servir imágenes directamente
    location /imagenes_inmuebles/ {
        alias /home/syncorbis/dist/imagenes_inmuebles/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    location /imagenes_asesores/ {
        alias /home/syncorbis/dist/imagenes_asesores/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
}
```

```bash
# Activar la configuración
sudo ln -s /etc/nginx/sites-available/syncorbis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Despliegue con App Platform

App Platform es una solución PaaS de DigitalOcean que simplifica el despliegue de aplicaciones.

### 1. Preparar el repositorio

App Platform se integra con GitHub, GitLab o repositorios de DigitalOcean. Asegúrate de tener tu código en uno de estos servicios.

Añade un archivo `app.yaml` a la raíz de tu proyecto:

```yaml
name: syncorbis
services:
- name: web
  github:
    repo: tu-usuario/syncorbis
    branch: main
  build_command: npm run build:bundle
  run_command: node dist/index.js
  envs:
  - key: NODE_ENV
    value: production
  - key: DB_TYPE
    value: mysql
  - key: MYSQL_HOST
    value: ${db.HOSTNAME}
  - key: MYSQL_PORT
    value: ${db.PORT}
  - key: MYSQL_USER
    value: ${db.USERNAME}
  - key: MYSQL_PASSWORD
    value: ${db.PASSWORD}
  - key: MYSQL_DATABASE
    value: ${db.DATABASE}
  - key: API_URL
    value: https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/
  - key: IMAGES_FOLDER
    value: ./imagenes_inmuebles
  - key: ASESOR_IMAGES_FOLDER
    value: ./imagenes_asesores

databases:
- name: db
  engine: MYSQL
  version: "8"
  production: false
```

### 2. Crear la aplicación en App Platform

1. Inicia sesión en tu cuenta de DigitalOcean
2. Haz clic en "Create" y selecciona "Apps"
3. Conecta tu repositorio (GitHub, GitLab, etc.)
4. Selecciona el repositorio y la rama
5. DigitalOcean detectará automáticamente la configuración de tu aplicación
6. Configura las variables de entorno adicionales si es necesario
7. Haz clic en "Next" y selecciona el plan (Basic o Professional)
8. Haz clic en "Create Resources"

### 3. Configurar trabajos programados

Para la sincronización periódica:

1. En el panel de App Platform, selecciona tu aplicación
2. Haz clic en "Create Component" y selecciona "Job"
3. Configura el trabajo:
   - Nombre: sync-job
   - Comando: node dist/scripts/sync-js.js
   - Programación: Cron expression (por ejemplo, `0 */6 * * *` para cada 6 horas)
4. Haz clic en "Create Job"

## Configuración de la Base de Datos

### 1. Opción A: Base de datos gestionada por DigitalOcean

1. Inicia sesión en tu cuenta de DigitalOcean
2. Haz clic en "Create" y selecciona "Databases"
3. Selecciona MySQL
4. Elige el plan (Starter o más, dependiendo de tus necesidades)
5. Selecciona una región cercana a tu Droplet
6. Haz clic en "Create Database Cluster"
7. Una vez creado, obtén las credenciales de conexión

### 2. Opción B: Instalar MySQL en el Droplet

```bash
# Instalar MySQL
apt install -y mysql-server

# Configurar seguridad
mysql_secure_installation

# Acceder a MySQL
mysql

# Crear base de datos y usuario (dentro de MySQL)
CREATE DATABASE inmuebles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'syncorbis'@'localhost' IDENTIFIED BY 'tu_contraseña_segura';
GRANT ALL PRIVILEGES ON inmuebles.* TO 'syncorbis'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Configuración de Espacios para Almacenamiento

DigitalOcean Spaces es un servicio de almacenamiento compatible con S3 que puedes usar para almacenar imágenes de propiedades.

### 1. Crear un Space

1. Inicia sesión en tu cuenta de DigitalOcean
2. Haz clic en "Create" y selecciona "Spaces"
3. Selecciona una región
4. Configura el nombre del Space (por ejemplo, `syncorbis-images`)
5. Haz clic en "Create Space"

### 2. Crear claves de acceso

1. Ve a API en el panel de control
2. En la sección "Spaces access keys", haz clic en "Generate New Key"
3. Asigna un nombre a la clave y haz clic en "Generate Key"
4. Guarda el Key y Secret (solo se mostrarán una vez)

### 3. Configurar la aplicación para usar Spaces

Instala las dependencias necesarias:

```bash
npm install aws-sdk
```

Modifica tu código para usar Spaces:

```javascript
// Ejemplo de configuración para usar DigitalOcean Spaces
const AWS = require('aws-sdk');
const spacesEndpoint = new AWS.Endpoint('nyc3.digitaloceanspaces.com'); // Cambia la región según corresponda

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: 'tu-access-key',
  secretAccessKey: 'tu-secret-key'
});

// Función para subir imagen a Spaces
async function uploadToSpaces(localPath, fileName) {
  const fileContent = fs.readFileSync(localPath);
  const params = {
    Bucket: 'syncorbis-images',
    Key: fileName,
    Body: fileContent,
    ACL: 'public-read'
  };
  
  return s3.upload(params).promise();
}
```

## Configuración de Dominio y SSL

### 1. Añadir dominio en DigitalOcean

1. Ve a "Networking" en el panel de control
2. Haz clic en "Domains"
3. Añade tu dominio
4. Configura los registros DNS para apuntar a tu Droplet

### 2. Configurar SSL con Certbot

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obtener certificado
certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Verificar renovación automática
certbot renew --dry-run
```

## Monitoreo y Mantenimiento

### 1. Configurar monitoreo

DigitalOcean ofrece monitoreo integrado para Droplets:

1. Ve a tu Droplet en el panel de control
2. Haz clic en "Monitoring"
3. Configura alertas para CPU, memoria y disco

### 2. Backups automáticos

1. Ve a tu Droplet en el panel de control
2. Haz clic en "Backups"
3. Habilita los backups semanales

### 3. Monitoreo con PM2 (para Droplets)

```bash
# Ver dashboard de monitoreo
pm2 monit

# Ver estadísticas
pm2 status

# Ver logs
pm2 logs syncorbis
```

### 4. Actualización de la aplicación

Para Droplets:
```bash
# Detener la aplicación
pm2 stop all

# Hacer backup de la configuración
cp /home/syncorbis/dist/.env /home/syncorbis/.env.backup

# Desplegar nueva versión
# (Subir y descomprimir nuevo bundle)

# Restaurar configuración
cp /home/syncorbis/.env.backup /home/syncorbis/dist/.env

# Instalar dependencias
cd /home/syncorbis/dist
npm install --production

# Reiniciar la aplicación
pm2 restart all
```

Para App Platform:
1. Haz push de los cambios a tu repositorio
2. App Platform detectará los cambios y desplegará automáticamente

---

Esta guía te proporciona las instrucciones necesarias para desplegar SyncOrbisExpress en DigitalOcean, ya sea usando Droplets para un control total o App Platform para una experiencia más gestionada. DigitalOcean ofrece una excelente relación calidad-precio y una interfaz fácil de usar, lo que lo convierte en una buena opción para aplicaciones como SyncOrbisExpress.
