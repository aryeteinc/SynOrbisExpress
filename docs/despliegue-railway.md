# Guía Completa de Despliegue en Railway

Railway es una plataforma moderna de despliegue que ofrece una experiencia sencilla para aplicaciones web, APIs y bases de datos. Esta guía te mostrará cómo desplegar tanto aplicaciones Node.js (como SyncOrbisExpress) como aplicaciones Laravel en Railway.

## Índice

1. [Introducción a Railway](#introducción-a-railway)
2. [Registro y Configuración Inicial](#registro-y-configuración-inicial)
3. [Despliegue de SyncOrbisExpress (Node.js)](#despliegue-de-syncorbisexpress-nodejs)
4. [Despliegue de Aplicaciones Laravel](#despliegue-de-aplicaciones-laravel)
5. [Configuración de Base de Datos MySQL](#configuración-de-base-de-datos-mysql)
6. [Variables de Entorno](#variables-de-entorno)
7. [Dominios Personalizados](#dominios-personalizados)
8. [Monitoreo y Logs](#monitoreo-y-logs)
9. [Escalado y Límites](#escalado-y-límites)
10. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Introducción a Railway

Railway es una plataforma de despliegue que simplifica el proceso de puesta en producción de aplicaciones web. Ofrece:

- **Despliegue desde GitHub**: Conecta tu repositorio y despliega automáticamente
- **Bases de datos integradas**: MySQL, PostgreSQL, MongoDB, Redis
- **Entornos de desarrollo**: Desarrollo, staging y producción
- **Dominios personalizados**: Conecta tu propio dominio
- **Monitoreo y logs**: Visualiza el rendimiento y los logs en tiempo real
- **Plan gratuito**: $5 de crédito mensual gratuito

## Registro y Configuración Inicial

### 1. Crear una cuenta

1. Visita [Railway.app](https://railway.app/)
2. Haz clic en "Login" o "Get Started"
3. Regístrate con GitHub, GitLab o Google

### 2. Instalar CLI (opcional pero recomendado)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Iniciar sesión
railway login
```

### 3. Configurar método de pago (opcional)

Aunque Railway ofrece un plan gratuito con $5 de crédito mensual, es recomendable configurar un método de pago para:
- Recibir $10 adicionales de crédito al verificar tu cuenta
- Evitar interrupciones si necesitas más recursos
- Acceder a características adicionales

## Despliegue de SyncOrbisExpress (Node.js)

### 1. Preparar el Repositorio

Antes de desplegar, asegúrate de que tu repositorio SyncOrbisExpress incluya:

1. **Archivo `app.js`** en la raíz del proyecto:
   ```javascript
   // app.js
   const express = require('express');
   const path = require('path');
   const { exec } = require('child_process');
   const fs = require('fs');
   
   // Crear la aplicación Express
   const app = express();
   const port = process.env.PORT || 3000;
   
   // Configurar directorio de archivos estáticos
   app.use(express.static(path.join(__dirname, 'public')));
   
   // Ruta principal
   app.get('/', (req, res) => {
     res.send('SyncOrbisExpress está funcionando correctamente.');
   });
   
   // Ruta para verificar el estado
   app.get('/status', (req, res) => {
     res.json({
       status: 'online',
       version: require('./package.json').version,
       timestamp: new Date()
     });
   });
   
   // Ruta para ejecutar sincronización manual (protegida)
   app.get('/sync/:key', (req, res) => {
     const apiKey = process.env.API_KEY || 'clave_predeterminada';
     
     if (req.params.key !== apiKey) {
       return res.status(403).json({ error: 'Acceso no autorizado' });
     }
     
     // Registrar inicio de sincronización
     const logFile = path.join(__dirname, 'logs', `sync-${Date.now()}.log`);
     
     // Asegurarse de que el directorio de logs exista
     if (!fs.existsSync(path.join(__dirname, 'logs'))) {
       fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
     }
     
     res.json({ 
       status: 'Sincronización iniciada',
       logFile: logFile
     });
     
     // Ejecutar sincronización en segundo plano
     exec(`node scripts/sync-js.js > ${logFile} 2>&1`, (error, stdout, stderr) => {
       if (error) {
         fs.appendFileSync(logFile, `\nError: ${error.message}`);
         return;
       }
       fs.appendFileSync(logFile, '\nSincronización completada con éxito');
     });
   });
   
   // Iniciar el servidor
   app.listen(port, () => {
     console.log(`SyncOrbisExpress ejecutándose en el puerto ${port}`);
   });
   ```

2. **Actualiza `package.json`** para incluir el script de inicio:
   ```json
   {
     "name": "syncorbis-express",
     "version": "1.0.0",
     "scripts": {
       "start": "node app.js",
       "setup": "node scripts/setup.js",
       "sync": "node scripts/sync-js.js"
     },
     "dependencies": {
       // Dependencias existentes
     }
   }
   ```

3. **Crea un archivo `.gitignore`** si no existe:
   ```
   node_modules/
   .env
   logs/
   ```

4. **Asegúrate de que los cambios estén subidos a GitHub/GitLab**

### 2. Crear un Nuevo Proyecto en Railway

1. Inicia sesión en [Railway.app](https://railway.app/)
2. Haz clic en "New Project"
3. Selecciona "Deploy from GitHub repo"
4. Elige tu repositorio SyncOrbisExpress
5. Railway detectará automáticamente que es una aplicación Node.js

### 3. Configurar el Servicio

1. En la página del proyecto, haz clic en el servicio desplegado
2. Ve a la pestaña "Settings"
3. Verifica que la configuración sea correcta:
   - **Root Directory**: `/` (o la carpeta donde se encuentra package.json)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 4. Añadir Base de Datos MySQL

1. En la página del proyecto, haz clic en "New"
2. Selecciona "Database" → "MySQL"
3. Railway creará una base de datos MySQL y te proporcionará las credenciales
4. Las variables de entorno se configurarán automáticamente en tu servicio

### 5. Configurar Variables de Entorno

1. En tu servicio, ve a la pestaña "Variables"
2. Añade las variables necesarias para SyncOrbisExpress:
   - `API_URL=https://tu-api-url.com`
   - `API_KEY=tu_api_key`
   - `IMAGES_FOLDER=./public/images/inmuebles`
   - `DB_TYPE=mysql`
   - Las variables de conexión a la base de datos (DB_HOST, DB_USER, etc.) se configuran automáticamente

### 6. Configurar la Base de Datos

1. Abre la terminal de Railway haciendo clic en "Connect" → "Terminal" en tu servicio
2. Ejecuta los scripts de configuración:
   ```bash
   node scripts/setup.js
   node scripts/fix-inmuebles-table.js
   node scripts/optimize-sync.js
   ```

### 7. Verificar el Despliegue

1. Haz clic en "Settings" → "Domains" para ver la URL generada
2. Visita la URL para verificar que la aplicación está en línea
3. Prueba la ruta `/status` para verificar el estado de la API

## Despliegue de Aplicaciones Laravel

### 1. Preparar el Repositorio Laravel

Antes de desplegar, asegúrate de que tu repositorio Laravel incluya:

1. **Archivo `Procfile`** en la raíz del proyecto:
   ```
   web: vendor/bin/heroku-php-apache2 public/
   ```

2. **Actualiza `.env.example`** para incluir configuraciones de Railway:
   ```
   APP_NAME=Laravel
   APP_ENV=production
   APP_KEY=
   APP_DEBUG=false
   APP_URL=https://tu-app.railway.app
   
   LOG_CHANNEL=stack
   
   DB_CONNECTION=mysql
   DB_HOST=${MYSQLHOST}
   DB_PORT=${MYSQLPORT}
   DB_DATABASE=${MYSQLDATABASE}
   DB_USERNAME=${MYSQLUSER}
   DB_PASSWORD=${MYSQLPASSWORD}
   ```

3. **Crea un archivo `railway.json`** en la raíz:
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "php artisan migrate --force && php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan serve --host=0.0.0.0 --port=$PORT",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

4. **Asegúrate de que los cambios estén subidos a GitHub/GitLab**

### 2. Crear un Nuevo Proyecto en Railway

1. Inicia sesión en [Railway.app](https://railway.app/)
2. Haz clic en "New Project"
3. Selecciona "Deploy from GitHub repo"
4. Elige tu repositorio Laravel
5. Railway detectará automáticamente que es una aplicación PHP/Laravel

### 3. Configurar el Servicio

1. En la página del proyecto, haz clic en el servicio desplegado
2. Ve a la pestaña "Settings"
3. Verifica que la configuración sea correcta:
   - **Root Directory**: `/` (o la carpeta donde se encuentra composer.json)
   - **Build Command**: `composer install --no-dev && npm install && npm run build`
   - **Start Command**: `php artisan serve --host=0.0.0.0 --port=$PORT`

### 4. Añadir Base de Datos MySQL

1. En la página del proyecto, haz clic en "New"
2. Selecciona "Database" → "MySQL"
3. Railway creará una base de datos MySQL y te proporcionará las credenciales
4. Las variables de entorno se configurarán automáticamente en tu servicio

### 5. Configurar Variables de Entorno

1. En tu servicio, ve a la pestaña "Variables"
2. Añade las variables necesarias para Laravel:
   - `APP_KEY=` (genera con `php artisan key:generate --show`)
   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - Las variables de conexión a la base de datos se configuran automáticamente

### 6. Ejecutar Migraciones

Las migraciones se ejecutarán automáticamente gracias al comando de inicio configurado en `railway.json`. Si necesitas ejecutarlas manualmente:

1. Abre la terminal de Railway haciendo clic en "Connect" → "Terminal" en tu servicio
2. Ejecuta:
   ```bash
   php artisan migrate --force
   ```

### 7. Verificar el Despliegue

1. Haz clic en "Settings" → "Domains" para ver la URL generada
2. Visita la URL para verificar que la aplicación Laravel está en línea

## Configuración de Base de Datos MySQL

Railway ofrece bases de datos MySQL completamente gestionadas que son ideales para aplicaciones web.

### 1. Crear una Base de Datos MySQL

1. En tu proyecto, haz clic en "New"
2. Selecciona "Database" → "MySQL"
3. Railway creará automáticamente:
   - Una instancia de MySQL
   - Un usuario con privilegios completos
   - Una base de datos vacía

### 2. Conectar a la Base de Datos

Railway proporciona varias formas de conectarse a la base de datos:

#### Conexión desde tu Aplicación

Las variables de entorno se configuran automáticamente en tu servicio:
- `MYSQLHOST`: Host de la base de datos
- `MYSQLPORT`: Puerto de la base de datos
- `MYSQLDATABASE`: Nombre de la base de datos
- `MYSQLUSER`: Usuario de la base de datos
- `MYSQLPASSWORD`: Contraseña de la base de datos

#### Conexión con MySQL CLI

1. Haz clic en tu base de datos MySQL
2. Selecciona "Connect" → "Terminal"
3. Ejecuta:
   ```bash
   mysql -u $MYSQLUSER -p$MYSQLPASSWORD -h $MYSQLHOST -P $MYSQLPORT $MYSQLDATABASE
   ```

#### Conexión con GUI (MySQL Workbench, etc.)

1. Haz clic en tu base de datos MySQL
2. Selecciona "Connect" → "Data"
3. Copia las credenciales de conexión

### 3. Importar Datos Existentes

Si necesitas importar datos desde una base de datos existente:

1. Exporta los datos de tu base de datos actual:
   ```bash
   mysqldump -u usuario -p base_de_datos > backup.sql
   ```

2. En Railway, abre la terminal de tu base de datos
3. Importa los datos:
   ```bash
   mysql -u $MYSQLUSER -p$MYSQLPASSWORD -h $MYSQLHOST -P $MYSQLPORT $MYSQLDATABASE < backup.sql
   ```

## Variables de Entorno

Las variables de entorno son cruciales para configurar tus aplicaciones en Railway sin exponer información sensible.

### 1. Configurar Variables

1. En tu servicio, ve a la pestaña "Variables"
2. Haz clic en "New Variable"
3. Ingresa el nombre y valor de la variable
4. Haz clic en "Add"

### 2. Variables Predefinidas

Railway proporciona automáticamente algunas variables:
- `PORT`: Puerto en el que debe ejecutarse tu aplicación
- `RAILWAY_STATIC_URL`: URL base para activos estáticos
- `RAILWAY_PUBLIC_DOMAIN`: Dominio público de tu aplicación

### 3. Variables de Base de Datos

Al conectar una base de datos MySQL, Railway configura automáticamente:
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLDATABASE`
- `MYSQLUSER`
- `MYSQLPASSWORD`

### 4. Variables Secretas

Para información sensible (API keys, tokens, etc.):
1. Haz clic en el icono de "ojo" junto a la variable
2. Esto ocultará el valor en la interfaz

## Dominios Personalizados

Railway proporciona dominios temporales, pero puedes configurar tu propio dominio.

### 1. Añadir Dominio Personalizado

1. En tu servicio, ve a "Settings" → "Domains"
2. Haz clic en "Custom Domain"
3. Ingresa tu dominio (ej. `app.tudominio.com`)
4. Sigue las instrucciones para configurar los registros DNS

### 2. Configurar Registros DNS

Railway te proporcionará:
- Un registro CNAME para configurar en tu proveedor DNS
- Instrucciones específicas según tu proveedor

### 3. Verificar Configuración

1. Una vez configurados los registros DNS, haz clic en "Verify"
2. Railway verificará la configuración y activará el dominio
3. Railway gestionará automáticamente los certificados SSL

## Monitoreo y Logs

Railway proporciona herramientas para monitorear el rendimiento y ver los logs de tu aplicación.

### 1. Ver Logs

1. En tu servicio, ve a la pestaña "Deployments"
2. Selecciona el despliegue activo
3. Haz clic en "View Logs"
4. Puedes filtrar los logs por nivel (info, error, etc.)

### 2. Monitoreo de Recursos

1. En tu servicio, ve a la pestaña "Metrics"
2. Verás gráficos de:
   - Uso de CPU
   - Uso de memoria
   - Uso de disco
   - Tráfico de red

### 3. Alertas (Plan de Pago)

Con un plan de pago, puedes configurar alertas para:
- Uso excesivo de recursos
- Tiempo de inactividad
- Errores frecuentes

## Escalado y Límites

### Plan Gratuito

- $5 de crédito mensual gratuito
- Cuando se agota el crédito, el servicio se pausa hasta el próximo mes
- Recursos limitados (CPU/RAM)

### Escalado Vertical (Más Recursos)

1. En tu servicio, ve a "Settings" → "Resources"
2. Ajusta los recursos asignados:
   - CPU (hasta 2 vCPU)
   - Memoria (hasta 4 GB)
   - Disco (hasta 10 GB)

### Escalado Horizontal (Más Instancias)

1. En tu servicio, ve a "Settings" → "Resources"
2. Aumenta el número de instancias
3. Railway distribuirá automáticamente el tráfico

## Solución de Problemas Comunes

### Error: Application Error

**Síntoma**: La aplicación muestra "Application Error" o "We're sorry, but something went wrong"

**Soluciones**:
1. Verifica los logs para identificar el error
2. Asegúrate de que el comando de inicio sea correcto
3. Verifica que las variables de entorno estén configuradas correctamente
4. Para Laravel, verifica que APP_KEY esté configurado

### Error: Database Connection Failed

**Síntoma**: La aplicación no puede conectarse a la base de datos

**Soluciones**:
1. Verifica que la base de datos esté en ejecución
2. Comprueba las variables de entorno de conexión
3. Asegúrate de que la aplicación esté utilizando las variables de entorno correctas
4. Verifica que no haya restricciones de IP para la conexión

### Error: Build Failed

**Síntoma**: El despliegue falla durante la fase de construcción

**Soluciones**:
1. Verifica los logs de construcción
2. Asegúrate de que todas las dependencias estén listadas en package.json/composer.json
3. Verifica que el comando de construcción sea correcto
4. Para Laravel, asegúrate de que composer.json no tenga dependencias incompatibles

### Error: Memory Limit Exceeded

**Síntoma**: La aplicación se cierra inesperadamente o muestra errores de memoria

**Soluciones**:
1. Aumenta la asignación de memoria en la configuración de recursos
2. Optimiza tu aplicación para usar menos memoria
3. Para PHP, ajusta memory_limit en php.ini

### Error: Port Already in Use

**Síntoma**: La aplicación no puede iniciarse porque el puerto ya está en uso

**Soluciones**:
1. Asegúrate de que tu aplicación esté utilizando el puerto proporcionado por Railway (`process.env.PORT` o `$PORT`)
2. Verifica que no haya múltiples procesos intentando usar el mismo puerto

## Recursos Adicionales

- [Documentación oficial de Railway](https://docs.railway.app/)
- [Blog de Railway](https://blog.railway.app/)
- [Comunidad de Railway en Discord](https://discord.com/invite/railway)
- [Ejemplos de despliegue](https://github.com/railwayapp/examples)

---

Esta guía te proporciona toda la información necesaria para desplegar aplicaciones Node.js (como SyncOrbisExpress) y Laravel en Railway. Si encuentras algún problema específico, consulta la documentación oficial o contacta al soporte de Railway.
