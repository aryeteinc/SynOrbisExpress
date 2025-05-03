# Guía de Despliegue en Railway - SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en Railway, una plataforma moderna de despliegue que ofrece una experiencia simplificada y potente.

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Preparación del Proyecto](#preparación-del-proyecto)
3. [Configuración de Railway](#configuración-de-railway)
4. [Despliegue de la Aplicación](#despliegue-de-la-aplicación)
5. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
6. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
7. [Configuración de Almacenamiento](#configuración-de-almacenamiento)
8. [Configuración de Tareas Programadas](#configuración-de-tareas-programadas)
9. [Monitoreo y Escalado](#monitoreo-y-escalado)
10. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Requisitos Previos

Antes de comenzar, asegúrate de tener:

1. Una cuenta en [Railway](https://railway.app/)
2. Una cuenta de GitHub (Railway se integra directamente con GitHub)
3. El proyecto SyncOrbisExpress en un repositorio de GitHub

## Preparación del Proyecto

### 1. Configurar package.json

Railway detecta automáticamente aplicaciones Node.js, pero necesitamos asegurarnos de que los scripts estén correctamente configurados:

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "npm run clean && tsc && npm run copy-scripts",
    "clean": "rimraf dist",
    "copy-scripts": "mkdir -p dist/scripts && cp scripts/*.js dist/scripts/",
    "postinstall": "npm run build"
  },
  "engines": {
    "node": ">=14.x"
  }
}
```

### 2. Crear archivo railway.json

Railway permite configurar el despliegue a través de un archivo `railway.json` en la raíz del proyecto:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 3. Configurar Procfile para tareas programadas

Crea un archivo `Procfile` en la raíz del proyecto para definir procesos adicionales:

```
web: npm start
worker: node dist/scripts/sync-js.js
```

### 4. Adaptar la aplicación para bases de datos PostgreSQL

Railway ofrece PostgreSQL como servicio de base de datos. Si tu aplicación está configurada para MySQL, necesitarás adaptarla:

```javascript
// Ejemplo de configuración adaptable
const knex = require('knex');

// Determinar configuración de base de datos según variables de entorno
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

const db = knex(dbConfig);
```

### 5. Configurar scripts para PostgreSQL

Modifica los scripts de creación de tablas para que sean compatibles con PostgreSQL:

```javascript
// Ejemplo de creación de tabla compatible con PostgreSQL
async function createInmueblesTable() {
  const exists = await db.schema.hasTable('inmuebles');
  if (!exists) {
    await db.schema.createTable('inmuebles', table => {
      table.string('ref').primary();
      table.string('codigo_sincronizacion');
      table.string('titulo');
      table.decimal('area_construida', 15, 2).nullable();
      table.decimal('area_privada', 15, 2).nullable();
      table.decimal('precio_venta', 15, 2).nullable();
      table.decimal('precio_canon', 15, 2).nullable();
      table.boolean('activo').defaultTo(true);
      table.boolean('destacado').defaultTo(false);
      table.boolean('en_caliente').defaultTo(false);
      // Otras columnas...
      table.timestamps(true, true); // Crea created_at y updated_at
    });
  }
}
```

## Configuración de Railway

### 1. Iniciar sesión en Railway

1. Ve a [Railway](https://railway.app/)
2. Inicia sesión con tu cuenta de GitHub

### 2. Crear un nuevo proyecto

1. Haz clic en "New Project"
2. Selecciona "Deploy from GitHub repo"
3. Selecciona tu repositorio de SyncOrbisExpress
4. Railway detectará automáticamente que es una aplicación Node.js

## Despliegue de la Aplicación

### 1. Configuración inicial

Railway desplegará automáticamente tu aplicación, pero necesitarás configurar algunos aspectos:

1. En el panel del proyecto, haz clic en "Settings"
2. En la sección "Environment", configura las variables de entorno necesarias
3. En la sección "Networking", puedes configurar un dominio personalizado

### 2. Verificar el despliegue

1. Railway mostrará el estado del despliegue en tiempo real
2. Una vez completado, haz clic en "View Logs" para verificar que todo funciona correctamente
3. Haz clic en la URL generada para acceder a tu aplicación

## Configuración de la Base de Datos

### 1. Añadir servicio de PostgreSQL

1. En tu proyecto, haz clic en "New"
2. Selecciona "Database" y luego "PostgreSQL"
3. Railway creará automáticamente una base de datos PostgreSQL y la conectará a tu aplicación

### 2. Obtener credenciales de conexión

1. Haz clic en el servicio de PostgreSQL
2. En la pestaña "Connect", encontrarás la URL de conexión y otras credenciales
3. Railway automáticamente añade la variable `DATABASE_URL` a tu aplicación

### 3. Inicializar la base de datos

Para crear las tablas iniciales, puedes ejecutar:

1. Haz clic en tu servicio de aplicación
2. Ve a la pestaña "Settings"
3. En "Service Commands", haz clic en "Add Command"
4. Añade: `node dist/scripts/reset-db-full.js`
5. Haz clic en "Run Command"

## Configuración de Variables de Entorno

Railway facilita la gestión de variables de entorno a través de su interfaz:

1. Haz clic en tu servicio de aplicación
2. Ve a la pestaña "Variables"
3. Añade las siguientes variables:
   - `NODE_ENV`: `production`
   - `API_URL`: `https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/`
   - `IMAGES_FOLDER`: `./tmp/imagenes_inmuebles`
   - `ASESOR_IMAGES_FOLDER`: `./tmp/imagenes_asesores`

## Configuración de Almacenamiento

Railway tiene un sistema de archivos efímero, lo que significa que los archivos subidos se perderán cuando la aplicación se reinicie. Para imágenes, debes usar un servicio externo como AWS S3:

### 1. Configurar AWS S3

1. Crea un bucket en AWS S3
2. Obtén las credenciales de acceso (Access Key y Secret Key)
3. Añade las siguientes variables de entorno en Railway:
   - `AWS_ACCESS_KEY_ID`: Tu Access Key
   - `AWS_SECRET_ACCESS_KEY`: Tu Secret Key
   - `AWS_REGION`: La región de tu bucket (ej. `us-east-1`)
   - `S3_BUCKET`: El nombre de tu bucket

### 2. Modificar el código para usar S3

```javascript
// Ejemplo de configuración para usar S3
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Función para subir imagen a S3
async function uploadToS3(localPath, fileName) {
  const fileContent = fs.readFileSync(localPath);
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: fileName,
    Body: fileContent,
    ACL: 'public-read'
  };
  
  return s3.upload(params).promise();
}
```

## Configuración de Tareas Programadas

Railway permite configurar servicios adicionales para tareas programadas:

### 1. Añadir un servicio de worker

1. En tu proyecto, haz clic en "New"
2. Selecciona "Service" y luego "Empty Service"
3. En la configuración del servicio:
   - En "Start Command", ingresa: `node dist/scripts/sync-js.js`
   - En "Schedule", selecciona "Cron Job" e ingresa una expresión cron (ej. `0 */6 * * *` para cada 6 horas)

### 2. Compartir variables de entorno

1. Selecciona el nuevo servicio de worker
2. Ve a la pestaña "Variables"
3. Haz clic en "Reference Variables"
4. Selecciona todas las variables de tu servicio principal

## Monitoreo y Escalado

### 1. Monitoreo

Railway proporciona monitoreo integrado:

1. Haz clic en tu servicio
2. Ve a la pestaña "Metrics" para ver el uso de CPU, memoria y red
3. Ve a la pestaña "Logs" para ver los logs en tiempo real

### 2. Escalado

Para escalar tu aplicación:

1. Haz clic en tu servicio
2. Ve a la pestaña "Settings"
3. En la sección "Instance Size", selecciona el tamaño adecuado para tu aplicación

## Solución de Problemas Comunes

### 1. Error en el despliegue

Si el despliegue falla:
1. Verifica los logs para identificar el problema
2. Asegúrate de que los scripts en `package.json` estén correctamente configurados
3. Verifica que todas las dependencias estén incluidas en `package.json`

### 2. Error de conexión a la base de datos

Si no puedes conectar a la base de datos:
1. Verifica que la variable `DATABASE_URL` esté correctamente configurada
2. Asegúrate de que tu código esté adaptado para PostgreSQL
3. Verifica que las tablas se hayan creado correctamente

### 3. Problemas con el almacenamiento de imágenes

Si las imágenes no se guardan correctamente:
1. Verifica las credenciales de AWS S3
2. Asegúrate de que el bucket tenga los permisos adecuados
3. Verifica que tu código esté correctamente configurado para usar S3

### 4. Problemas con las tareas programadas

Si las tareas programadas no se ejecutan:
1. Verifica la expresión cron
2. Asegúrate de que el servicio de worker tenga acceso a todas las variables de entorno necesarias
3. Verifica los logs del servicio de worker

---

Esta guía te ayudará a desplegar SyncOrbisExpress en Railway, una plataforma moderna y fácil de usar que ofrece una excelente experiencia de desarrollo. Railway se integra perfectamente con GitHub y ofrece servicios gestionados como PostgreSQL, lo que facilita el despliegue y mantenimiento de aplicaciones como SyncOrbisExpress.
