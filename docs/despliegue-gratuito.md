# Guía de Despliegue en Plataformas Gratuitas

Esta guía proporciona opciones para desplegar SyncOrbisExpress en plataformas gratuitas, ideal para pruebas y desarrollo antes de migrar a un entorno de producción.

## Opción 1: Despliegue Local con Ngrok

Esta opción te permite ejecutar la aplicación en tu máquina local y exponerla temporalmente a Internet.

### Requisitos:
- Node.js instalado en tu máquina local
- [Ngrok](https://ngrok.com/) (cuenta gratuita)

### Pasos:

1. **Instala Ngrok**:
   - Regístrate en [ngrok.com](https://ngrok.com/)
   - Descarga e instala Ngrok según las instrucciones del sitio

2. **Configura tu aplicación local**:
   - Clona el repositorio: `git clone https://github.com/aryeteinc/SynOrbisExpress.git`
   - Instala dependencias: `npm install`
   - Configura el archivo `.env` con tus credenciales de base de datos local
   - Ejecuta los scripts de configuración:
     ```bash
     node scripts/setup.js
     node scripts/fix-inmuebles-table.js
     node scripts/optimize-sync.js
     ```

3. **Crea un archivo `app.js` en la raíz** para servir la aplicación:
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

4. **Inicia tu aplicación**:
   ```bash
   node app.js
   ```

5. **Expón tu aplicación con Ngrok**:
   - Abre una nueva terminal
   - Ejecuta: `ngrok http 3000`
   - Ngrok te proporcionará una URL pública (por ejemplo, `https://1a2b3c4d.ngrok.io`)
   - Esta URL estará disponible mientras mantengas Ngrok ejecutándose

6. **Limitaciones**:
   - La URL cambia cada vez que reinicias Ngrok (en la versión gratuita)
   - La sesión expira después de algunas horas
   - Ancho de banda limitado

## Opción 2: Despliegue en Render.com (Free Tier)

Render ofrece un nivel gratuito para aplicaciones web Node.js con una base de datos PostgreSQL gratuita.

### Requisitos:
- Cuenta en [Render.com](https://render.com/)
- Repositorio Git (GitHub, GitLab o Bitbucket)

### Pasos:

1. **Prepara tu repositorio**:
   - Asegúrate de que tu repositorio incluya:
     - `package.json` con el script `start` configurado para ejecutar `app.js`
     - Un archivo `app.js` como el de la Opción 1
     - Archivo `.env.example` como referencia

2. **Modifica la aplicación para usar PostgreSQL** (Render ofrece PostgreSQL gratuito):
   - Instala el paquete `pg`: `npm install pg`
   - Adapta las consultas SQL si es necesario para compatibilidad con PostgreSQL

3. **Regístrate en Render.com**:
   - Crea una cuenta gratuita
   - Conecta tu repositorio Git

4. **Crea un nuevo Web Service**:
   - Selecciona tu repositorio
   - Nombre: `syncorbis-express`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node app.js`
   - Plan: Free

5. **Configura variables de entorno**:
   - En la sección "Environment", añade las variables de tu archivo `.env`
   - Para la base de datos, crea una nueva base de datos PostgreSQL en Render y usa esas credenciales

6. **Despliega la aplicación**:
   - Haz clic en "Create Web Service"
   - Render desplegará automáticamente tu aplicación
   - Obtendrás una URL como `https://syncorbis-express.onrender.com`

7. **Limitaciones**:
   - La aplicación gratuita "duerme" después de 15 minutos de inactividad
   - Tiempo de inicio lento después de la inactividad
   - Recursos limitados (CPU/RAM)
   - 500 horas de uso gratuito al mes

## Opción 3: Despliegue en Railway.app

Railway ofrece un nivel gratuito con $5 de crédito mensual, suficiente para pruebas.

### Requisitos:
- Cuenta en [Railway.app](https://railway.app/)
- Repositorio Git (GitHub o GitLab)

### Pasos:

1. **Regístrate en Railway**:
   - Crea una cuenta usando GitHub o GitLab

2. **Crea un nuevo proyecto**:
   - Selecciona "Deploy from GitHub repo"
   - Elige tu repositorio SyncOrbisExpress

3. **Configura el servicio**:
   - Railway detectará automáticamente que es una aplicación Node.js
   - Configura el comando de inicio: `node app.js`

4. **Añade un servicio de base de datos MySQL**:
   - En tu proyecto, haz clic en "New"
   - Selecciona "Database" → "MySQL"
   - Railway creará una base de datos MySQL y te proporcionará las credenciales

5. **Configura variables de entorno**:
   - En la pestaña "Variables", añade las variables de tu archivo `.env`
   - Usa las credenciales de la base de datos MySQL que Railway creó

6. **Despliega la aplicación**:
   - Railway desplegará automáticamente tu aplicación
   - Obtendrás una URL como `https://syncorbis-express-production.up.railway.app`

7. **Limitaciones**:
   - $5 de crédito gratuito al mes
   - Cuando se agota el crédito, el servicio se pausa hasta el próximo mes

## Opción 4: Despliegue en Fly.io (Free Tier)

Fly.io ofrece un nivel gratuito con recursos suficientes para pruebas.

### Requisitos:
- Cuenta en [Fly.io](https://fly.io/) (requiere tarjeta de crédito para verificación, pero no se cobra en el plan gratuito)
- Flyctl CLI instalado

### Pasos:

1. **Instala Flyctl**:
   ```bash
   # Para macOS
   brew install flyctl
   # Para Windows (con PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Inicia sesión en Fly.io**:
   ```bash
   flyctl auth login
   ```

3. **Inicializa tu aplicación**:
   ```bash
   cd SyncOrbisExpress
   flyctl launch
   ```
   - Sigue las instrucciones para configurar tu aplicación
   - Cuando te pregunte si quieres desplegar ahora, selecciona "No"

4. **Configura la base de datos**:
   ```bash
   flyctl postgres create --name syncorbis-db
   ```

5. **Conecta la aplicación a la base de datos**:
   ```bash
   flyctl postgres attach --app syncorbis-express syncorbis-db
   ```

6. **Configura variables de entorno**:
   ```bash
   flyctl secrets set DB_TYPE=mysql DB_HOST=... DB_USER=... DB_PASSWORD=... DB_DATABASE=...
   ```

7. **Despliega la aplicación**:
   ```bash
   flyctl deploy
   ```

8. **Limitaciones**:
   - 3 aplicaciones gratuitas de 256MB RAM
   - 160GB de transferencia gratuita al mes
   - Base de datos PostgreSQL gratuita de 3GB

## Adaptación para PostgreSQL vs. MySQL

La mayoría de las plataformas gratuitas ofrecen PostgreSQL en lugar de MySQL. Aquí te explicamos cómo manejar esta situación:

### Opción 1: Adaptar SyncOrbisExpress para PostgreSQL

1. **Instala el paquete de PostgreSQL**:
   ```bash
   npm install pg knex
   ```

2. **Modifica la configuración de la base de datos** en `scripts/database.js` o archivo similar:
   ```javascript
   // Configuración para PostgreSQL
   const knex = require('knex');
   
   const db = knex({
     client: process.env.DB_TYPE === 'postgres' ? 'pg' : 'mysql',
     connection: {
       host: process.env.DB_HOST,
       port: process.env.DB_PORT,
       user: process.env.DB_USER,
       password: process.env.DB_PASSWORD,
       database: process.env.DB_DATABASE,
       ssl: process.env.DB_SSL === 'true' ? {rejectUnauthorized: false} : false
     },
     pool: { min: 0, max: 7 }
   });
   ```

3. **Ajusta las consultas SQL** para compatibilidad con PostgreSQL:
   - Cambia comillas invertidas (\`) por comillas dobles (") para nombres de tablas/columnas
   - Reemplaza `AUTO_INCREMENT` por `SERIAL`
   - Ajusta funciones específicas de MySQL (como `CONCAT`)
   - Modifica la sintaxis de `INSERT` para retornar IDs

4. **Ejemplo de script de migración** para crear tablas en PostgreSQL:
   ```javascript
   // Ejemplo para la tabla inmuebles
   await db.schema.createTable('inmuebles', table => {
     table.increments('id').primary();
     table.string('ref').notNullable().unique();
     table.string('codigo_sincronizacion');
     // ... resto de columnas
     table.timestamps(true, true); // Equivalente a created_at y updated_at
   });
   ```

### Opción 2: Usar MySQL en Plataformas Gratuitas

1. **PlanetScale** - Ofrece un plan gratuito de MySQL:
   - Regístrate en [PlanetScale](https://planetscale.com/)
   - Crea una base de datos gratuita
   - Usa las credenciales proporcionadas en tu aplicación
   - Ventaja: Compatible 100% con MySQL
   - Limitación: 5GB de almacenamiento en el plan gratuito

2. **Railway con MySQL**:
   - Railway soporta MySQL nativamente
   - Al crear un nuevo servicio, selecciona MySQL en lugar de PostgreSQL
   - Configura las variables de entorno para conectar con esta base de datos

3. **Clever Cloud**:
   - Ofrece un plan gratuito de MySQL
   - 5 conexiones simultáneas y 10MB de almacenamiento (suficiente para pruebas)
   - Regístrate en [Clever Cloud](https://www.clever-cloud.com/)

4. **AWS RDS** con capa gratuita:
   - Requiere tarjeta de crédito para registro
   - Ofrece 12 meses de MySQL gratuito
   - 20GB de almacenamiento
   - Más complejo de configurar pero más potente

### Opción 3: Base de Datos Local + Túnel

Si prefieres mantener MySQL localmente:

1. **Configura MySQL en tu máquina local**

2. **Usa ngrok para exponer el puerto MySQL**:
   ```bash
   ngrok tcp 3306
   ```

3. **Configura tu aplicación** para conectarse a la URL proporcionada por ngrok

4. **Limitaciones**:
   - Requiere que tu máquina esté encendida
   - La URL cambia cada vez (en la versión gratuita)
   - Posibles problemas de seguridad

## Consideraciones Importantes para Todas las Opciones

1. **Seguridad**:
   - No almacenes credenciales sensibles en el código
   - Usa variables de entorno para configuración
   - Limita el acceso a endpoints sensibles (como `/sync`)

2. **Persistencia de datos**:
   - Las plataformas gratuitas suelen tener almacenamiento efímero
   - Considera usar un servicio de base de datos externo más estable

3. **Limitaciones de recursos**:
   - Las opciones gratuitas tienen límites de CPU, RAM y ancho de banda
   - La sincronización de muchas propiedades podría exceder estos límites

4. **Migración a producción**:
   - Cuando estés listo para migrar a producción, exporta los datos de la base de datos
   - Configura copias de seguridad regulares

## Recomendación Final

### Para mantener MySQL (recomendado)

1. **Railway.app con MySQL**: La opción más sencilla que soporta MySQL nativamente. Simplemente selecciona MySQL al crear tu servicio de base de datos.

2. **PlanetScale**: Ofrece un plan gratuito de MySQL con 5GB de almacenamiento, más que suficiente para pruebas.

3. **Local + Ngrok**: Si prefieres mantener todo bajo tu control, ejecuta MySQL localmente y usa Ngrok para exponer tanto la aplicación como la base de datos.

### Si estás dispuesto a adaptar a PostgreSQL

Render.com o Fly.io ofrecen entornos más completos con PostgreSQL incluido, pero requerirán modificar las consultas SQL de la aplicación.

### Ruta de evolución recomendada

1. **Desarrollo inicial**: Local con MySQL
2. **Pruebas con acceso externo**: Local + Ngrok
3. **Pruebas más estables**: Railway.app con MySQL
4. **Producción**: Hosting compartido (Namecheap) o VPS económico (DigitalOcean, Linode)
