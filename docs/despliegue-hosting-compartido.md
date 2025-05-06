# Guía de Despliegue en Hosting Compartido (Namecheap)

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en un hosting compartido como Namecheap, donde no es posible utilizar Docker y se requiere una configuración específica para aplicaciones Node.js.

## Requisitos Previos

- Una cuenta en un servicio de hosting compartido que soporte Node.js (como Namecheap)
- Acceso SSH al servidor (opcional pero recomendado)
- Acceso a cPanel o panel de control similar
- Cliente FTP (como FileZilla) o acceso a administrador de archivos web
- Cliente de base de datos MySQL (como phpMyAdmin, generalmente incluido en cPanel)

## Paso 1: Preparar la Base de Datos en el Hosting

1. **Accede al panel de control** (cPanel) de tu hosting.

2. **Crea una nueva base de datos MySQL**:
   - Busca la sección "Bases de datos MySQL" o similar.
   - Crea una nueva base de datos (por ejemplo, `usuario_inmuebles`).
   - Crea un nuevo usuario de base de datos.
   - Asigna todos los privilegios al usuario para la base de datos creada.
   - Anota el nombre de la base de datos, nombre de usuario, contraseña y host (generalmente `localhost`).

## Paso 2: Configurar Node.js en el Hosting

La mayoría de los hostings compartidos requieren configuración específica para aplicaciones Node.js:

### En Namecheap:

1. **Accede a cPanel** y busca "Setup Node.js App" o "Configurar aplicación Node.js".

2. **Crea una nueva aplicación Node.js**:
   - Nombre de la aplicación: `syncorbis` (o el nombre que prefieras)
   - Versión de Node.js: Selecciona la versión 14.x o superior
   - Modo de inicio de la aplicación: Selecciona "Desarrollo" para pruebas iniciales
   - Ruta de la aplicación: `/home/usuario/public_html/syncorbis` (ajusta según tu estructura)
   - Punto de entrada de la aplicación: `app.js` (crearemos este archivo más adelante)
   - Guarda la configuración

3. **Anota el puerto asignado** a tu aplicación Node.js. Este puerto se muestra claramente en la página de configuración de Node.js después de crear la aplicación. Generalmente aparece como:
   - "Application port: XXXX" (donde XXXX es un número de puerto, por ejemplo `3000`, `49123`, etc.)
   - También puedes encontrarlo en la sección "Application URL" que mostrará algo como `https://tudominio.com:XXXX`
   - Si no ves el puerto asignado, contacta al soporte de Namecheap para obtener esta información.

## Paso 3: Preparar los Archivos para Subir

En tu máquina local:

1. **Clona el repositorio** si aún no lo has hecho:
   ```bash
   git clone https://github.com/aryeteinc/SynOrbisExpress.git
   cd SynOrbisExpress
   ```

2. **Instala las dependencias**:
   ```bash
   npm install
   ```

3. **Crea un archivo `app.js`** en la raíz del proyecto para que sirva como punto de entrada:
   ```javascript
   // app.js - Punto de entrada para hosting compartido
   const express = require('express');
   const path = require('path');
   const { exec } = require('child_process');
   const fs = require('fs');
   
   // Crear la aplicación Express
   const app = express();
   // IMPORTANTE: Reemplaza 3000 con el puerto que te asignó Namecheap
   // Este puerto se muestra en la configuración de la aplicación Node.js en cPanel
   // Por ejemplo: const port = process.env.PORT || 49123;
   const port = process.env.PORT || 3000; // El puerto asignado por el hosting
   
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

4. **Crea un archivo `.env`** basado en el ejemplo, ajustando los valores para el entorno de producción:
   ```
   # Configuración de la base de datos
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=usuario_db
   DB_PASSWORD=contraseña_db
   DB_DATABASE=usuario_inmuebles
   
   # Configuración de la API
   API_URL=https://tu-api-url.com
   API_KEY=tu_api_key
   
   # Configuración de la aplicación
   IMAGES_FOLDER=./public/images/inmuebles
   
   # Configuración del servidor
   PORT=3000  # Debe coincidir con el puerto asignado por el hosting
   
   # Configuración de Docker (no se usa en hosting compartido)
   USE_DOCKER=false
   ```

5. **Crea un archivo `package.json`** modificado para hosting compartido:
   ```json
   {
     "name": "syncorbis-express",
     "version": "1.0.0",
     "description": "Sincronización de datos inmobiliarios desde API Orbis",
     "main": "app.js",
     "scripts": {
       "start": "node app.js",
       "setup": "node scripts/setup.js",
       "sync": "node scripts/sync-js.js",
       "optimize": "node scripts/optimize-sync.js",
       "fix-tables": "node scripts/fix-inmuebles-table.js"
     },
     "engines": {
       "node": ">=14.0.0"
     },
     "dependencies": {
       // Mantén las dependencias originales del package.json
     }
   }
   ```

6. **Prepara los archivos para subir**:
   - Elimina la carpeta `node_modules` (se instalará en el servidor)
   - Elimina archivos innecesarios como `.git`, `.gitignore`, etc.

## Paso 4: Subir los Archivos al Hosting

### Usando FTP:

1. **Conéctate a tu servidor** mediante FTP usando las credenciales proporcionadas por tu proveedor de hosting.

2. **Navega al directorio** configurado para tu aplicación Node.js (por ejemplo, `/home/usuario/public_html/syncorbis`).

3. **Sube todos los archivos** del proyecto excepto los que eliminaste en el paso anterior.

### Usando el Administrador de Archivos de cPanel:

1. **Accede a cPanel** y busca "Administrador de Archivos".

2. **Navega al directorio** configurado para tu aplicación Node.js.

3. **Sube los archivos** usando la función de carga del administrador de archivos.

## Paso 5: Identificar el Puerto Asignado por Namecheap

Es crucial identificar correctamente el puerto que Namecheap ha asignado a tu aplicación Node.js:

1. **En el Panel de Control de Node.js**:
   - Después de crear la aplicación, regresa a la lista de aplicaciones Node.js
   - Busca tu aplicación en la lista y observa la columna "Port" o "Puerto"
   - Este número (por ejemplo, `49123`) es el que debes usar en tu archivo `app.js`

2. **En la Página de Detalles de la Aplicación**:
   - Haz clic en el nombre de tu aplicación para ver sus detalles
   - Busca una sección llamada "Application Information" o "Información de la Aplicación"
   - El puerto se mostrará como "Application Port: XXXX"

3. **En la URL de Acceso**:
   - En la página de detalles, busca "Application URL" o "URL de la Aplicación"
   - La URL tendrá el formato: `https://tudominio.com:XXXX`
   - El número después de los dos puntos es el puerto asignado

4. **Si No Encuentras el Puerto**:
   - Revisa la documentación de Namecheap sobre aplicaciones Node.js
   - Contacta al soporte técnico de Namecheap
   - Temporalmente, puedes intentar con puertos comunes como `3000`, `8080` o `49152` hasta `65535`

> **IMPORTANTE**: Debes actualizar el valor del puerto en tu archivo `app.js` para que coincida exactamente con el puerto asignado por Namecheap. De lo contrario, la aplicación no será accesible.

## Paso 6: Configurar la Aplicación en el Servidor

### Si tienes acceso SSH:

1. **Conéctate al servidor** mediante SSH:
   ```bash
   ssh usuario@tudominio.com
   ```

2. **Navega al directorio** de la aplicación:
   ```bash
   cd public_html/syncorbis
   ```

3. **Instala las dependencias**:
   ```bash
   npm install
   ```

4. **Configura la estructura de la base de datos**:
   ```bash
   node scripts/setup.js
   ```

5. **Corrige la estructura de tablas**:
   ```bash
   node scripts/fix-inmuebles-table.js
   ```

6. **Optimiza la base de datos**:
   ```bash
   node scripts/optimize-sync.js
   ```

### Si no tienes acceso SSH (usando cPanel):

1. **Accede a cPanel** y busca "Terminal" o "Node.js App Manager".

2. **Ejecuta los comandos** mencionados anteriormente en la terminal web.

3. **Alternativamente**, configura "Trabajos Cron" para ejecutar estos scripts:
   - Accede a "Trabajos Cron" en cPanel
   - Añade un nuevo trabajo:
     ```
     cd /home/usuario/public_html/syncorbis && /usr/local/bin/node scripts/setup.js
     ```
   - Configúralo para ejecutarse una vez (ejecutar ahora)
   - Repite para los otros scripts (`fix-inmuebles-table.js` y `optimize-sync.js`)

## Paso 6: Configurar la Sincronización Automática

Para ejecutar la sincronización automáticamente:

1. **Accede a "Trabajos Cron"** en cPanel.

2. **Añade un nuevo trabajo** para la sincronización diaria:
   ```
   cd /home/usuario/public_html/syncorbis && /usr/local/bin/node scripts/sync-js.js >> /home/usuario/logs/sync-$(date +\%Y\%m\%d).log 2>&1
   ```

3. **Configura la frecuencia** (por ejemplo, diariamente a las 2 AM):
   ```
   0 2 * * * cd /home/usuario/public_html/syncorbis && /usr/local/bin/node scripts/sync-js.js >> /home/usuario/logs/sync-$(date +\%Y\%m\%d).log 2>&1
   ```

## Paso 7: Iniciar la Aplicación

1. **Accede al panel de control** de Node.js en cPanel.

2. **Inicia la aplicación** que configuraste anteriormente.

3. **Verifica que la aplicación esté funcionando** visitando:
   ```
   https://tudominio.com/syncorbis
   ```
   o la URL específica asignada por tu proveedor de hosting.

## Paso 8: Verificar la Instalación

1. **Comprueba que la aplicación está en línea** visitando la URL de la aplicación.

2. **Verifica el estado** visitando:
   ```
   https://tudominio.com/syncorbis/status
   ```

3. **Ejecuta una sincronización manual** (solo si tienes la clave API correcta):
   ```
   https://tudominio.com/syncorbis/sync/tu_api_key
   ```

## Solución de Problemas Comunes en Hosting Compartido

### Error: Cannot find module

Si recibes un error como "Cannot find module 'express'":

1. **Verifica que las dependencias están instaladas**:
   ```bash
   cd /home/usuario/public_html/syncorbis
   npm install
   ```

2. **Comprueba la versión de Node.js** configurada en el hosting:
   ```bash
   node -v
   ```

### Error: EACCES: permission denied

Si encuentras errores de permisos:

1. **Ajusta los permisos de los directorios**:
   ```bash
   chmod -R 755 /home/usuario/public_html/syncorbis
   chmod -R 777 /home/usuario/public_html/syncorbis/public/images/inmuebles
   ```

### Error de Conexión a la Base de Datos

1. **Verifica las credenciales** en el archivo `.env`.

2. **Comprueba si la base de datos existe** usando phpMyAdmin.

3. **Verifica los privilegios del usuario** de la base de datos.

### La Aplicación No Inicia

1. **Revisa los logs de la aplicación** en el panel de control de Node.js.

2. **Verifica que el puerto** configurado en `app.js` coincide con el asignado por el hosting.

3. **Comprueba que el punto de entrada** (`app.js`) está correctamente configurado.

## Notas Importantes

- **Respaldos**: Configura respaldos regulares de la base de datos a través de cPanel.
- **Logs**: Revisa regularmente los archivos de log para detectar problemas.
- **Actualizaciones**: Para actualizar la aplicación, sube los nuevos archivos y reinicia la aplicación Node.js.
- **Seguridad**: Asegúrate de que la ruta `/sync/:key` esté protegida con una clave API segura.
- **Recursos**: Los hostings compartidos suelen tener limitaciones de recursos. Monitorea el uso de CPU y memoria.

## Soporte

Si encuentras problemas específicos con el despliegue en tu proveedor de hosting, consulta su documentación o contacta a su soporte técnico para obtener ayuda específica sobre la configuración de aplicaciones Node.js.
