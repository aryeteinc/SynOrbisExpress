# Guía de Despliegue en Hosting Premium - SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en servidores VPS o dedicados, donde tienes control total sobre el entorno.

## Índice

1. [Preparación del Bundle de Producción](#preparación-del-bundle-de-producción)
2. [Configuración del Servidor](#configuración-del-servidor)
3. [Despliegue de la Aplicación](#despliegue-de-la-aplicación)
4. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
5. [Configuración de PM2](#configuración-de-pm2)
6. [Configuración de Nginx](#configuración-de-nginx)
7. [Configuración de SSL con Let's Encrypt](#configuración-de-ssl-con-lets-encrypt)
8. [Automatización con Cron Jobs](#automatización-con-cron-jobs)
9. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)

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

## Configuración del Servidor

### 1. Requisitos del servidor

Para un rendimiento óptimo, recomendamos:
- Ubuntu 20.04 LTS o superior
- 2 GB RAM mínimo (4 GB recomendado)
- 2 núcleos de CPU
- 20 GB de almacenamiento SSD

### 2. Actualizar el sistema e instalar dependencias

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas esenciales
sudo apt install -y curl git build-essential

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version  # Debería mostrar v16.x o superior
npm --version   # Debería mostrar v7.x o superior

# Instalar PM2 globalmente para gestión de procesos
sudo npm install -g pm2

# Instalar Nginx como servidor web
sudo apt install -y nginx
```

### 3. Configurar el firewall

```bash
# Permitir SSH, HTTP y HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Despliegue de la Aplicación

### 1. Crear usuario de aplicación (opcional pero recomendado)

```bash
# Crear usuario
sudo adduser syncorbis
sudo usermod -aG sudo syncorbis

# Cambiar al nuevo usuario
su - syncorbis
```

### 2. Transferir y descomprimir el bundle

Opción A: Usando SCP desde tu máquina local:
```bash
# Desde tu máquina local
scp syncorbis-bundle.zip usuario@tu-servidor:/home/syncorbis/
```

Opción B: Usando wget si has subido el archivo a un servidor:
```bash
# En el servidor
cd /home/syncorbis
wget https://tu-servidor.com/syncorbis-bundle.zip
```

Descomprimir el bundle:
```bash
# En el servidor
cd /home/syncorbis
unzip syncorbis-bundle.zip
```

### 3. Configurar la aplicación

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

### 4. Instalar dependencias

```bash
# Instalar dependencias de producción
npm install --production
```

## Configuración de la Base de Datos

### 1. Instalar MySQL

```bash
# Instalar MySQL
sudo apt install -y mysql-server

# Configurar seguridad de MySQL
sudo mysql_secure_installation
```

### 2. Crear base de datos y usuario

```bash
# Acceder a MySQL
sudo mysql

# Crear base de datos y usuario (dentro de MySQL)
CREATE DATABASE inmuebles CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'syncorbis'@'localhost' IDENTIFIED BY 'tu_contraseña_segura';
GRANT ALL PRIVILEGES ON inmuebles.* TO 'syncorbis'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Verificar la conexión

```bash
# Probar la conexión a la base de datos
mysql -u syncorbis -p inmuebles
```

## Configuración de PM2

PM2 es un gestor de procesos para aplicaciones Node.js que facilita la ejecución en segundo plano, el reinicio automático y el monitoreo.

### 1. Crear archivo de configuración de PM2

```bash
# Crear archivo de configuración
cd /home/syncorbis/dist
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

### 2. Iniciar la aplicación con PM2

```bash
# Iniciar la aplicación
pm2 start pm2-config.json

# Configurar PM2 para iniciar automáticamente al reiniciar el servidor
pm2 startup
pm2 save
```

### 3. Verificar el estado de la aplicación

```bash
# Verificar estado
pm2 status

# Ver logs
pm2 logs syncorbis
```

## Configuración de Nginx

Nginx actuará como proxy inverso para tu aplicación Node.js.

### 1. Crear configuración de Nginx

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

    # Configuración para archivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
}
```

### 2. Activar la configuración

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/syncorbis /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

## Configuración de SSL con Let's Encrypt

### 1. Instalar Certbot

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtener certificado SSL

```bash
# Obtener certificado
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

### 3. Verificar renovación automática

```bash
# Probar renovación automática
sudo certbot renew --dry-run
```

## Automatización con Cron Jobs

Aunque PM2 puede manejar la sincronización periódica, también puedes configurar cron jobs adicionales para tareas específicas:

### 1. Editar crontab

```bash
# Editar crontab
crontab -e
```

### 2. Añadir tareas programadas

```
# Ejecutar sincronización completa a las 2 AM todos los días
0 2 * * * cd /home/syncorbis/dist && /usr/bin/node scripts/sync-js.js >> /home/syncorbis/logs/sync.log 2>&1

# Limpiar sincronizaciones antiguas una vez por semana (domingo a las 3 AM)
0 3 * * 0 cd /home/syncorbis/dist && /usr/bin/node scripts/clean-syncs.js >> /home/syncorbis/logs/clean.log 2>&1

# Crear backup de la base de datos diariamente
0 4 * * * mysqldump -u syncorbis -p'tu_contraseña_segura' inmuebles > /home/syncorbis/backups/inmuebles_$(date +\%Y\%m\%d).sql
```

## Monitoreo y Mantenimiento

### 1. Monitoreo con PM2

```bash
# Ver dashboard de monitoreo
pm2 monit

# Ver estadísticas
pm2 status
```

### 2. Logs y depuración

```bash
# Ver logs de la aplicación
pm2 logs syncorbis

# Ver logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 3. Backups regulares

```bash
# Backup de la base de datos
mysqldump -u syncorbis -p inmuebles > /home/syncorbis/backups/inmuebles_$(date +%Y%m%d).sql

# Comprimir backup
gzip /home/syncorbis/backups/inmuebles_$(date +%Y%m%d).sql

# Backup de imágenes (periódicamente)
tar -czf /home/syncorbis/backups/imagenes_$(date +%Y%m%d).tar.gz /home/syncorbis/dist/imagenes_inmuebles /home/syncorbis/dist/imagenes_asesores
```

### 4. Actualización de la aplicación

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

## Optimización de Rendimiento

### 1. Optimización de MySQL

```bash
# Editar configuración de MySQL
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

Añadir/modificar las siguientes líneas:
```
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
innodb_flush_log_at_trx_commit = 2
query_cache_size = 32M
```

Reiniciar MySQL:
```bash
sudo systemctl restart mysql
```

### 2. Optimización de Node.js

Ajustar la memoria asignada a Node.js en el archivo PM2:
```json
"node_args": "--max-old-space-size=1024"
```

### 3. Optimización de Nginx

```bash
# Editar configuración de Nginx
sudo nano /etc/nginx/nginx.conf
```

Ajustar los siguientes parámetros:
```
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
gzip on;
gzip_comp_level 5;
gzip_min_length 256;
gzip_proxied any;
gzip_types application/javascript application/json text/css text/plain text/xml;
```

Reiniciar Nginx:
```bash
sudo systemctl restart nginx
```

---

Esta guía te proporciona una configuración completa y optimizada para desplegar SyncOrbisExpress en un entorno de servidor premium. Con esta configuración, tendrás una aplicación robusta, segura y con alto rendimiento, capaz de manejar grandes volúmenes de datos y tráfico.
