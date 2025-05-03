# Guía de Despliegue en Render - SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en Render, una plataforma de nube unificada que ofrece servicios gestionados para aplicaciones web, APIs, bases de datos y más.

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Preparación del Proyecto](#preparación-del-proyecto)
3. [Configuración de Render](#configuración-de-render)
4. [Despliegue de la Aplicación Web](#despliegue-de-la-aplicación-web)
5. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
6. [Configuración de Almacenamiento](#configuración-de-almacenamiento)
7. [Configuración de Tareas Programadas](#configuración-de-tareas-programadas)
8. [Configuración de Dominio Personalizado](#configuración-de-dominio-personalizado)
9. [Monitoreo y Escalado](#monitoreo-y-escalado)
10. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Requisitos Previos

Antes de comenzar, asegúrate de tener:

1. Una cuenta en [Render](https://render.com/)
2. Una cuenta de GitHub, GitLab o Bitbucket (Render se integra con estos servicios)
3. El proyecto SyncOrbisExpress en un repositorio Git

## Preparación del Proyecto

### 1. Configurar package.json

Render detecta automáticamente aplicaciones Node.js, pero necesitamos asegurarnos de que los scripts estén correctamente configurados:

```json
{
  "scripts": {
    "start": "node dist/index.js",
    "build": "npm run clean && tsc && npm run copy-scripts",
    "clean": "rimraf dist",
    "copy-scripts": "mkdir -p dist/scripts && cp scripts/*.js dist/scripts/"
  },
  "engines": {
    "node": ">=14.x"
  }
}
```

### 2. Crear archivo render.yaml (opcional)

Render permite configurar el despliegue a través de un archivo `render.yaml` en la raíz del proyecto:

```yaml
services:
  - type: web
    name: syncorbis
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: API_URL
        value: https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/
      - key: IMAGES_FOLDER
        value: ./tmp/imagenes_inmuebles
      - key: ASESOR_IMAGES_FOLDER
        value: ./tmp/imagenes_asesores
      - key: DATABASE_URL
        fromDatabase:
          name: syncorbis-db
          property: connectionString

  - type: cron
    name: syncorbis-sync
    env: node
    schedule: "0 */6 * * *"
    buildCommand: npm install && npm run build
    startCommand: node dist/scripts/sync-js.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: API_URL
        value: https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/
      - key: IMAGES_FOLDER
        value: ./tmp/imagenes_inmuebles
      - key: ASESOR_IMAGES_FOLDER
        value: ./tmp/imagenes_asesores
      - key: DATABASE_URL
        fromDatabase:
          name: syncorbis-db
          property: connectionString

databases:
  - name: syncorbis-db
    plan: starter
    databaseName: syncorbis
    user: syncorbis
```

### 3. Adaptar la aplicación para PostgreSQL

Render ofrece PostgreSQL como servicio de base de datos. Si tu aplicación está configurada para MySQL, necesitarás adaptarla:

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

### 4. Configurar scripts para PostgreSQL

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

## Configuración de Render

### 1. Iniciar sesión en Render

1. Ve a [Render](https://render.com/)
2. Inicia sesión con tu cuenta o regístrate si aún no tienes una

### 2. Conectar repositorio

1. Haz clic en "New" y selecciona "Web Service"
2. Conecta tu cuenta de GitHub, GitLab o Bitbucket
3. Selecciona el repositorio de SyncOrbisExpress

## Despliegue de la Aplicación Web

### 1. Configurar el servicio web

1. Nombre: `syncorbis`
2. Entorno: `Node`
3. Región: Selecciona la más cercana a tus usuarios
4. Branch: `main` (o la rama que desees desplegar)
5. Build Command: `npm install && npm run build`
6. Start Command: `npm start`
7. Plan: Selecciona el plan adecuado (Free para pruebas, Standard para producción)
8. Haz clic en "Create Web Service"

### 2. Configurar variables de entorno

Una vez creado el servicio, ve a la pestaña "Environment" y añade las siguientes variables:

- `NODE_ENV`: `production`
- `API_URL`: `https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/`
- `IMAGES_FOLDER`: `./tmp/imagenes_inmuebles`
- `ASESOR_IMAGES_FOLDER`: `./tmp/imagenes_asesores`

## Configuración de la Base de Datos

### 1. Crear base de datos PostgreSQL

1. En el dashboard de Render, haz clic en "New" y selecciona "PostgreSQL"
2. Configura la base de datos:
   - Nombre: `syncorbis-db`
   - Base de datos: `syncorbis`
   - Usuario: `syncorbis`
   - Región: La misma que tu servicio web
   - Plan: Selecciona el plan adecuado
3. Haz clic en "Create Database"

### 2. Conectar la base de datos al servicio web

1. Una vez creada la base de datos, copia la "Internal Connection String"
2. Ve a tu servicio web, a la pestaña "Environment"
3. Añade una nueva variable de entorno:
   - `DATABASE_URL`: Pega la cadena de conexión interna

### 3. Inicializar la base de datos

Para crear las tablas iniciales, puedes usar la consola de Render:

1. Ve a tu servicio web
2. Haz clic en la pestaña "Shell"
3. Ejecuta: `node dist/scripts/reset-db-full.js`

## Configuración de Almacenamiento

Render tiene un sistema de archivos efímero, lo que significa que los archivos subidos se perderán cuando la aplicación se reinicie. Para imágenes, debes usar un servicio externo como AWS S3:

### 1. Configurar AWS S3

1. Crea un bucket en AWS S3
2. Obtén las credenciales de acceso (Access Key y Secret Key)
3. Añade las siguientes variables de entorno en tu servicio web de Render:
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

Render ofrece servicios de Cron Job para tareas programadas:

### 1. Crear un Cron Job

1. En el dashboard de Render, haz clic en "New" y selecciona "Cron Job"
2. Configura el job:
   - Nombre: `syncorbis-sync`
   - Entorno: `Node`
   - Branch: `main` (o la rama que desees)
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/scripts/sync-js.js`
   - Schedule: `0 */6 * * *` (cada 6 horas)
   - Plan: Selecciona el plan adecuado
3. Haz clic en "Create Cron Job"

### 2. Configurar variables de entorno para el Cron Job

1. Una vez creado el Cron Job, ve a la pestaña "Environment"
2. Añade las mismas variables de entorno que configuraste para el servicio web, incluyendo `DATABASE_URL`

## Configuración de Dominio Personalizado

### 1. Añadir dominio personalizado

1. Ve a tu servicio web
2. Haz clic en la pestaña "Settings"
3. En la sección "Custom Domain", haz clic en "Add"
4. Introduce tu dominio y haz clic en "Save"

### 2. Configurar DNS

Render te proporcionará instrucciones específicas para configurar los registros DNS de tu dominio:

1. Añade un registro CNAME para tu dominio apuntando al dominio proporcionado por Render
2. Si usas el dominio raíz, configura un registro ALIAS o ANAME según las instrucciones

### 3. Certificado SSL

Render proporciona certificados SSL automáticamente para todos los dominios personalizados.

## Monitoreo y Escalado

### 1. Monitoreo

Render proporciona monitoreo integrado:

1. Ve a tu servicio web
2. Haz clic en la pestaña "Metrics" para ver el uso de CPU, memoria y red
3. Haz clic en la pestaña "Logs" para ver los logs en tiempo real

### 2. Escalado

Para escalar tu aplicación:

1. Ve a tu servicio web
2. Haz clic en la pestaña "Settings"
3. En la sección "Instance Type", selecciona un plan con más recursos

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

Si el Cron Job no se ejecuta:
1. Verifica la expresión cron
2. Asegúrate de que el Cron Job tenga acceso a todas las variables de entorno necesarias
3. Verifica los logs del Cron Job

---

Esta guía te ayudará a desplegar SyncOrbisExpress en Render, una plataforma moderna y fácil de usar que ofrece una excelente experiencia de desarrollo. Render proporciona servicios gestionados como PostgreSQL y Cron Jobs, lo que facilita el despliegue y mantenimiento de aplicaciones como SyncOrbisExpress. Además, su plan gratuito es perfecto para pruebas y proyectos pequeños, mientras que sus planes de pago ofrecen recursos adicionales para aplicaciones en producción.
