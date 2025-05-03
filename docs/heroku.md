# Guía de Despliegue en Heroku - SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en Heroku, una plataforma como servicio (PaaS) que facilita el despliegue de aplicaciones.

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Preparación del Proyecto](#preparación-del-proyecto)
3. [Configuración de Heroku](#configuración-de-heroku)
4. [Despliegue de la Aplicación](#despliegue-de-la-aplicación)
5. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
6. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
7. [Configuración de Tareas Programadas](#configuración-de-tareas-programadas)
8. [Escalado y Monitoreo](#escalado-y-monitoreo)
9. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Requisitos Previos

Antes de comenzar, asegúrate de tener:

1. Una cuenta en [Heroku](https://signup.heroku.com/)
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) instalado en tu máquina local
3. Git instalado en tu máquina local
4. El proyecto SyncOrbisExpress en tu máquina local

## Preparación del Proyecto

### 1. Crear archivo Procfile

Heroku necesita un archivo `Procfile` para saber cómo ejecutar tu aplicación. Crea este archivo en la raíz del proyecto:

```bash
# Crear Procfile
echo "web: node dist/index.js" > Procfile
echo "worker: node dist/scripts/sync-js.js" >> Procfile
```

### 2. Ajustar package.json

Asegúrate de que tu `package.json` incluya los scripts necesarios y especifique la versión de Node.js:

```bash
# Editar package.json para añadir la configuración de Heroku
```

Añade o modifica las siguientes secciones:

```json
{
  "engines": {
    "node": "16.x"
  },
  "scripts": {
    "start": "node dist/index.js",
    "build": "npm run clean && tsc && npm run copy-scripts",
    "clean": "rimraf dist",
    "copy-scripts": "mkdir -p dist/scripts && cp scripts/*.js dist/scripts/",
    "postinstall": "npm run build"
  }
}
```

### 3. Configurar la aplicación para usar variables de entorno de Heroku

Heroku utiliza la variable de entorno `DATABASE_URL` para la conexión a la base de datos. Modifica tu archivo de configuración para soportar esto:

```javascript
// Ejemplo de modificación en config.js o similar
const dbConfig = process.env.DATABASE_URL ? {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : {
  client: process.env.DB_TYPE || 'mysql',
  connection: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  }
};
```

### 4. Crear archivo .gitignore

Asegúrate de tener un archivo `.gitignore` adecuado para no subir archivos innecesarios a Heroku:

```
node_modules
.env
imagenes_inmuebles/*
imagenes_asesores/*
!imagenes_inmuebles/.gitkeep
!imagenes_asesores/.gitkeep
```

### 5. Inicializar repositorio Git (si aún no lo has hecho)

```bash
git init
git add .
git commit -m "Preparación para despliegue en Heroku"
```

## Configuración de Heroku

### 1. Iniciar sesión en Heroku CLI

```bash
heroku login
```

### 2. Crear una nueva aplicación en Heroku

```bash
heroku create syncorbis-app
```

### 3. Añadir buildpack de Node.js

```bash
heroku buildpacks:set heroku/nodejs
```

## Despliegue de la Aplicación

### 1. Desplegar la aplicación

```bash
git push heroku main
```

Si estás trabajando en una rama diferente:

```bash
git push heroku tu-rama:main
```

### 2. Asegurarte de que al menos una instancia esté ejecutándose

```bash
heroku ps:scale web=1
```

## Configuración de la Base de Datos

### 1. Añadir complemento de PostgreSQL

Heroku ofrece PostgreSQL como servicio de base de datos:

```bash
heroku addons:create heroku-postgresql:hobby-dev
```

### 2. Verificar la conexión a la base de datos

```bash
heroku pg:info
```

### 3. Ejecutar migraciones iniciales

Para inicializar la base de datos, puedes ejecutar:

```bash
heroku run node dist/scripts/reset-db-full.js
```

## Configuración de Variables de Entorno

### 1. Configurar variables de entorno necesarias

```bash
heroku config:set API_URL=https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/
heroku config:set IMAGES_FOLDER=./imagenes_inmuebles
heroku config:set ASESOR_IMAGES_FOLDER=./imagenes_asesores
```

### 2. Verificar las variables configuradas

```bash
heroku config
```

## Configuración de Tareas Programadas

### 1. Añadir complemento Heroku Scheduler

```bash
heroku addons:create scheduler:standard
```

### 2. Configurar tareas programadas

```bash
heroku addons:open scheduler
```

En la interfaz web que se abre, añade una nueva tarea:
- Comando: `node dist/scripts/sync-js.js`
- Frecuencia: Daily (o la que prefieras)
- Hora: Selecciona una hora de baja carga

## Almacenamiento de Imágenes

Heroku tiene un sistema de archivos efímero, lo que significa que los archivos subidos se perderán cuando la aplicación se reinicie. Para imágenes, debes usar un servicio externo:

### 1. Añadir complemento de Amazon S3

```bash
heroku addons:create bucketeer:hobbyist
```

### 2. Configurar la aplicación para usar S3

Modifica tu código para usar las variables de entorno proporcionadas por Bucketeer:

```javascript
// Ejemplo de configuración para usar S3
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.BUCKETEER_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.BUCKETEER_AWS_SECRET_ACCESS_KEY,
  region: process.env.BUCKETEER_AWS_REGION
});

// Función para subir imagen a S3
async function uploadToS3(localPath, fileName) {
  const fileContent = fs.readFileSync(localPath);
  const params = {
    Bucket: process.env.BUCKETEER_BUCKET_NAME,
    Key: fileName,
    Body: fileContent
  };
  
  return s3.upload(params).promise();
}
```

## Escalado y Monitoreo

### 1. Escalar la aplicación

```bash
# Escalar el proceso web
heroku ps:scale web=2

# Escalar el proceso worker
heroku ps:scale worker=1
```

### 2. Monitorear la aplicación

```bash
# Ver logs en tiempo real
heroku logs --tail

# Ver el estado de los procesos
heroku ps
```

### 3. Configurar alertas de rendimiento

```bash
heroku addons:create librato:development
```

## Solución de Problemas Comunes

### 1. Error H10 (App crashed)

Verifica los logs para identificar el problema:
```bash
heroku logs --tail
```

Causas comunes:
- Error en la configuración de la base de datos
- Error en el código de la aplicación
- Falta de variables de entorno necesarias

### 2. Error R14 (Memory quota exceeded)

Optimiza el uso de memoria de tu aplicación o escala a un plan con más recursos:
```bash
# Optimizar uso de memoria en Node.js
heroku config:set NODE_OPTIONS="--max-old-space-size=460"

# Escalar a un plan con más recursos
heroku ps:resize web=standard-1x
```

### 3. Error H12 (Request timeout)

Si las sincronizaciones tardan demasiado:
```bash
# Ajustar el timeout de la aplicación
heroku config:set WEB_CONCURRENCY=1
heroku config:set NODE_OPTIONS="--max-old-space-size=460"

# Usar la opción --limite en el script de sincronización
heroku run node dist/scripts/sync-js.js --limite=20
```

### 4. Problemas con el almacenamiento de imágenes

Si las imágenes no se guardan correctamente:
- Verifica la configuración de S3
- Asegúrate de que las credenciales son correctas
- Verifica los permisos del bucket

```bash
# Ver variables de entorno de S3
heroku config | grep BUCKETEER
```

---

Esta guía te ayudará a desplegar SyncOrbisExpress en Heroku. Recuerda que Heroku tiene un sistema de archivos efímero, por lo que es importante usar servicios externos para almacenamiento persistente como bases de datos y archivos. Para aplicaciones con muchas imágenes como SyncOrbisExpress, considera usar un servicio de almacenamiento en la nube como Amazon S3.
