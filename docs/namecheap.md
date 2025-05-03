# Guía de Despliegue en Namecheap - SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en Namecheap, un proveedor de hosting compartido popular.

## Índice

1. [Verificación de Compatibilidad](#verificación-de-compatibilidad)
2. [Configuración de Node.js en Namecheap](#configuración-de-nodejs-en-namecheap)
3. [Preparación del Bundle de Producción](#preparación-del-bundle-de-producción)
4. [Subir el Bundle a Namecheap](#subir-el-bundle-a-namecheap)
5. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
6. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
7. [Instalación de Dependencias](#instalación-de-dependencias)
8. [Configuración del Cron Job](#configuración-del-cron-job)
9. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Verificación de Compatibilidad

Antes de comenzar, verifica que tu plan de hosting en Namecheap sea compatible con Node.js:

1. Inicia sesión en tu cuenta de Namecheap
2. Ve a "Hosting List" y selecciona tu plan de hosting
3. Haz clic en "Go to cPanel"
4. En cPanel, busca la sección "Software" o "Development"
5. Verifica si existe la opción "Node.js" o "Setup Node.js App"

> **Nota**: No todos los planes de hosting compartido de Namecheap soportan Node.js. Si no encuentras la opción de Node.js en cPanel, es posible que necesites actualizar a un plan que lo soporte o contactar con el soporte de Namecheap para confirmar la compatibilidad.

## Configuración de Node.js en Namecheap

Si tu plan de hosting soporta Node.js, sigue estos pasos para configurar una aplicación Node.js:

### 1. Crear una aplicación Node.js en cPanel

1. En cPanel, busca y haz clic en "Setup Node.js App"
2. Haz clic en "Create Application"
3. Configura la aplicación:
   - **Application Mode**: Production
   - **Application URL**: Elige el dominio o subdominio donde quieres que se ejecute la aplicación
   - **Application Root**: Directorio donde se alojará la aplicación (ej. `syncorbis`)
   - **Application Startup File**: `index.js` (este será el punto de entrada de la aplicación)
   - **Node.js version**: Selecciona la versión 14.x o superior
   - **Passenger log file**: Deja el valor predeterminado
4. Haz clic en "Create"

### 2. Verificar la configuración

Una vez creada la aplicación, Namecheap mostrará una página de confirmación con:

- La URL de la aplicación
- La ruta del directorio donde se alojará la aplicación
- La versión de Node.js seleccionada

Anota esta información, ya que la necesitarás más adelante.

### 3. Entender el entorno de Namecheap

Namecheap utiliza Passenger como servidor de aplicaciones para Node.js. Esto significa que:

- No necesitas ejecutar un servidor HTTP explícitamente en tu código
- Passenger buscará el archivo `app.js` o el archivo especificado como punto de entrada
- Las variables de entorno se configuran a través de cPanel o mediante un archivo `.htaccess`

## Preparación del Bundle de Producción

Ahora que has configurado Node.js en Namecheap, debes crear un bundle optimizado para producción:

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

Una vez completado, comprime la carpeta `dist` para facilitar la subida:

```bash
# Comprimir la carpeta dist
cd /Users/joseflorez/SyncOrbisExpress
zip -r syncorbis-bundle.zip dist/
```

## Subir el Bundle a Namecheap

### 1. Acceder al panel de control de Namecheap

1. Inicia sesión en tu cuenta de Namecheap
2. Ve a "Hosting List" y selecciona tu plan de hosting
3. Haz clic en "cPanel" para acceder al panel de control

### 2. Subir los archivos

En cPanel de Namecheap:

1. Busca la sección "Files" y haz clic en "File Manager"
2. Navega hasta la carpeta que configuraste como "Application Root" al crear la aplicación Node.js (por ejemplo, `/home/usuario/syncorbis` o la ruta que te proporcionó Namecheap)
3. Haz clic en "Upload" y sube el archivo `syncorbis-bundle.zip`
4. Una vez subido, selecciona el archivo y haz clic en "Extract" para descomprimirlo
   - Asegúrate de extraer el contenido directamente (no dentro de otra carpeta `dist`)
5. Después de extraer, puedes eliminar el archivo ZIP

### 3. Configurar el punto de entrada

Namecheap Passenger buscará el archivo que especificaste como "Application Startup File" (normalmente `index.js`). Si tu bundle tiene una estructura diferente, debes asegurarte de que este archivo exista y sea el punto de entrada correcto:

1. Si tu punto de entrada está en una ubicación diferente (por ejemplo, `dist/index.js`), tienes dos opciones:
   
   **Opción A**: Crear un archivo `index.js` en la raíz que redirija al archivo real:
   ```javascript
   // index.js en la raíz
   require('./dist/index.js');
   ```
   
   **Opción B**: Mover o copiar el archivo de la carpeta `dist` a la raíz:
   ```bash
   cp dist/index.js ./index.js
   ```

2. Asegúrate de que el archivo de punto de entrada exporta correctamente la aplicación para Passenger:
   ```javascript
   // Al final de tu index.js
   module.exports = app;  // Si usas Express
   ```

## Configuración de la Base de Datos

### 1. Crear la base de datos y el usuario

1. Regresa al cPanel de Namecheap
2. Busca la sección "Databases" y haz clic en "MySQL Databases"
3. Crea una nueva base de datos:
   - Introduce un nombre para la base de datos (por ejemplo, `syncorbis`)
   - Haz clic en "Create Database"
   - **Nota**: Namecheap añadirá automáticamente tu nombre de usuario de cPanel como prefijo (ej. `usuario_syncorbis`)
4. Crea un nuevo usuario de base de datos:
   - Introduce un nombre de usuario (por ejemplo, `syncuser`)
   - Introduce una contraseña segura
   - Haz clic en "Create User"
   - **Nota**: El nombre de usuario también tendrá el prefijo de tu usuario de cPanel (ej. `usuario_syncuser`)
5. Asigna el usuario a la base de datos:
   - En la sección "Add User To Database", selecciona el usuario y la base de datos que acabas de crear
   - Haz clic en "Add"
   - En la página de privilegios, selecciona "ALL PRIVILEGES" y haz clic en "Make Changes"

### 2. Anotar los detalles de conexión

Anota los siguientes detalles que necesitarás para configurar la conexión:
- Nombre de la base de datos (con prefijo): `usuario_syncorbis`
- Nombre de usuario (con prefijo): `usuario_syncuser`
- Contraseña: la que hayas establecido
- Host: `localhost`
- Puerto: `3306`

## Configuración de Variables de Entorno

En Namecheap, necesitarás configurar las variables de entorno mediante un archivo `.env`:

1. En el File Manager, navega hasta tu carpeta de SyncOrbisExpress
2. Busca el archivo `.env.example` y renómbralo a `.env`
3. Haz clic derecho en el archivo `.env` y selecciona "Edit"
4. Modifica el contenido con tus credenciales:

```
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=usuario_syncuser
MYSQL_PASSWORD=tu_contraseña
MYSQL_DATABASE=usuario_syncorbis
API_URL=https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/
IMAGES_FOLDER=./imagenes_inmuebles
ASESOR_IMAGES_FOLDER=./imagenes_asesores
```

> **Importante**: Reemplaza `usuario_syncuser` y `usuario_syncorbis` con los nombres reales que incluyen el prefijo de tu usuario de cPanel.

## Instalación de Dependencias

En Namecheap, puedes instalar dependencias usando SSH (si está disponible en tu plan) o el Terminal de cPanel:

### Opción A: Usando SSH

```bash
# Conectarse por SSH
ssh usuario@tudominio.com

# Navegar a tu directorio
cd public_html/syncorbis

# Instalar dependencias
npm install --production
```

### Opción B: Usando Terminal en cPanel

1. En cPanel, busca la sección "Advanced" y haz clic en "Terminal"
2. Navega a tu directorio:
   ```bash
   cd public_html/syncorbis
   ```
3. Instala las dependencias:
   ```bash
   npm install --production
   ```

## Ejecución Inicial

Después de instalar las dependencias, ejecuta una sincronización inicial con un límite bajo para probar:

```bash
# Ejecutar con un límite bajo para probar
node scripts/sync-js.js --limite=10
```

Si todo funciona correctamente, puedes ejecutar la sincronización completa:

```bash
node scripts/sync-js.js
```

## Configuración del Cron Job

Para mantener los datos sincronizados automáticamente:

1. En cPanel, busca la sección "Advanced" y haz clic en "Cron Jobs"
2. Configura un nuevo cron job:
   - Selecciona la frecuencia (por ejemplo, "Once a day" o personalizada)
   - Para una ejecución diaria a las 2 AM, puedes usar: `0 2 * * *`
   - En el campo de comando, introduce:
     ```
     cd /home/usuario/public_html/syncorbis && /usr/local/bin/node scripts/sync-js.js >> /home/usuario/logs/sync.log 2>&1
     ```
   - Reemplaza "usuario" con tu nombre de usuario de cPanel
   - Haz clic en "Add New Cron Job"

## Solución de Problemas Comunes en Namecheap

### 1. Error de permisos

Si tienes problemas con los permisos para escribir archivos o crear carpetas:

```bash
# En Terminal o SSH
chmod -R 755 imagenes_inmuebles
chmod -R 755 imagenes_asesores
```

O usando File Manager:
1. Selecciona las carpetas `imagenes_inmuebles` y `imagenes_asesores`
2. Haz clic en "Permissions" y establece los permisos a 755

### 2. Error de versión de Node.js

Namecheap puede tener una versión específica de Node.js. Verifica la versión con:

```bash
node --version
```

Si es menor que v14, tienes varias opciones:
1. Contacta con el soporte de Namecheap para solicitar una actualización
2. Usa Node Version Manager (NVM) si está disponible en tu plan
3. Modifica el código para hacerlo compatible con la versión disponible

### 3. Error de conexión a la base de datos

Si no puedes conectar a la base de datos:
1. Verifica que estás usando el prefijo correcto en el nombre de la base de datos y el usuario
2. Asegúrate de que la contraseña no contiene caracteres especiales que puedan causar problemas
3. Verifica que el usuario tiene todos los privilegios necesarios

### 4. Límite de memoria

Si encuentras errores de memoria, usa la opción `--limite` para procesar menos inmuebles a la vez:

```bash
node scripts/sync-js.js --limite=20
```

También puedes modificar el cron job para usar esta opción.

### 5. Error "Command not found"

Si recibes un error "node: command not found":

```bash
# Encuentra la ruta completa a node
which node

# Usa la ruta completa en tus comandos
/usr/local/bin/node scripts/sync-js.js
```

---

Esta guía te ayudará a desplegar SyncOrbisExpress en Namecheap de manera efectiva. Si encuentras problemas específicos, consulta la documentación de Namecheap o contacta con su soporte técnico.
