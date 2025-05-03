# Guía de Despliegue en Hostinger - SyncOrbisExpress

Esta guía proporciona instrucciones detalladas para desplegar SyncOrbisExpress en Hostinger, un proveedor de hosting con planes compartidos y VPS.

## Índice

1. [Preparación del Bundle de Producción](#preparación-del-bundle-de-producción)
2. [Subir el Bundle a Hostinger](#subir-el-bundle-a-hostinger)
3. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)
4. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
5. [Instalación de Dependencias](#instalación-de-dependencias)
6. [Configuración del Cron Job](#configuración-del-cron-job)
7. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Preparación del Bundle de Producción

Antes de subir la aplicación a Hostinger, debes crear un bundle optimizado para producción:

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

## Subir el Bundle a Hostinger

### 1. Acceder al panel de control de Hostinger

1. Inicia sesión en tu cuenta de Hostinger
2. Ve a "Hosting" y selecciona tu plan
3. Haz clic en "hPanel" para acceder al panel de control

### 2. Subir los archivos

En hPanel de Hostinger:

1. Busca la sección "Files" y haz clic en "File Manager"
2. Navega hasta la carpeta `public_html` o crea una subcarpeta específica (por ejemplo, `public_html/syncorbis`)
3. Haz clic en "Upload" y sube el archivo `syncorbis-bundle.zip`
4. Una vez subido, selecciona el archivo y haz clic en "Extract" para descomprimirlo
   - Asegúrate de extraer el contenido directamente (no dentro de otra carpeta `dist`)
5. Después de extraer, puedes eliminar el archivo ZIP

## Configuración de la Base de Datos

### 1. Crear la base de datos y el usuario

1. Regresa al hPanel de Hostinger
2. Busca la sección "Databases" y haz clic en "MySQL Databases"
3. Crea una nueva base de datos:
   - Introduce un nombre para la base de datos (por ejemplo, `syncorbis`)
   - Haz clic en "Create"
4. Crea un nuevo usuario de base de datos:
   - Introduce un nombre de usuario (por ejemplo, `syncuser`)
   - Introduce una contraseña segura
   - Haz clic en "Create"
5. Asigna el usuario a la base de datos:
   - En la sección "Add User To Database", selecciona el usuario y la base de datos que acabas de crear
   - Haz clic en "Add"
   - Asegúrate de otorgar todos los privilegios

### 2. Anotar los detalles de conexión

Anota los siguientes detalles que necesitarás para configurar la conexión:
- Nombre de la base de datos: `usuario_syncorbis` (donde "usuario" es tu nombre de usuario en Hostinger)
- Nombre de usuario: `usuario_syncuser`
- Contraseña: la que hayas establecido
- Host: `localhost` (o la dirección proporcionada por Hostinger)
- Puerto: `3306`

## Configuración de Variables de Entorno

En Hostinger, necesitarás configurar las variables de entorno mediante un archivo `.env`:

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

> **Importante**: Reemplaza `usuario_syncuser` y `usuario_syncorbis` con los nombres reales que incluyen el prefijo de tu usuario de Hostinger.

## Instalación de Dependencias

Hostinger ofrece acceso SSH en la mayoría de sus planes, lo que facilita la instalación de dependencias:

### Usando SSH

```bash
# Conectarse por SSH (los detalles se encuentran en el hPanel)
ssh usuario@tudominio.com

# Navegar a tu directorio
cd public_html/syncorbis

# Instalar dependencias
npm install --production
```

### Verificar la versión de Node.js

Hostinger suele tener versiones actualizadas de Node.js, pero es bueno verificar:

```bash
node --version
```

Si la versión es menor que v14, puedes solicitar una actualización al soporte o usar Node Version Manager (NVM) si está disponible.

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

Hostinger ofrece una interfaz sencilla para configurar cron jobs:

1. En hPanel, busca la sección "Advanced" y haz clic en "Cron Jobs"
2. Configura un nuevo cron job:
   - Selecciona la frecuencia (por ejemplo, "Once a day" o personalizada)
   - Para una ejecución diaria a las 2 AM, puedes usar: `0 2 * * *`
   - En el campo de comando, introduce:
     ```
     cd /home/usuario/public_html/syncorbis && /usr/bin/node scripts/sync-js.js >> /home/usuario/logs/sync.log 2>&1
     ```
   - Reemplaza "usuario" con tu nombre de usuario de Hostinger
   - Haz clic en "Create"

## Solución de Problemas Comunes en Hostinger

### 1. Error de permisos

Si tienes problemas con los permisos para escribir archivos o crear carpetas:

```bash
# En SSH
chmod -R 755 imagenes_inmuebles
chmod -R 755 imagenes_asesores
```

O usando File Manager:
1. Selecciona las carpetas `imagenes_inmuebles` y `imagenes_asesores`
2. Haz clic en "Permissions" y establece los permisos a 755

### 2. Límites de recursos

Hostinger tiene diferentes límites según el plan contratado. Si encuentras problemas de rendimiento:

1. Limita el número de inmuebles procesados por lote:
   ```bash
   node scripts/sync-js.js --limite=20
   ```

2. Considera actualizar a un plan con más recursos si la aplicación lo requiere

### 3. Error de conexión a la base de datos

Si no puedes conectar a la base de datos:
1. Verifica que estás usando el nombre correcto de la base de datos y el usuario (incluyendo prefijos)
2. Asegúrate de que la contraseña es correcta
3. Verifica que el usuario tiene todos los privilegios necesarios
4. Comprueba si Hostinger utiliza un host diferente a `localhost` para las conexiones MySQL

### 4. Problemas con Node.js

Hostinger suele tener buena compatibilidad con Node.js, pero si encuentras problemas:

1. Verifica la versión instalada:
   ```bash
   node --version
   ```

2. Si necesitas una versión específica, puedes usar NVM (si está disponible) o contactar con el soporte

### 5. Límite de tiempo de ejecución

Si la sincronización se interrumpe por límite de tiempo:

1. Modifica el script para procesar menos inmuebles por lote
2. Considera dividir la sincronización en múltiples cron jobs
3. Contacta con el soporte de Hostinger para aumentar el límite de tiempo de ejecución

---

Esta guía te ayudará a desplegar SyncOrbisExpress en Hostinger de manera efectiva. Hostinger ofrece un buen equilibrio entre facilidad de uso y rendimiento, lo que lo hace adecuado para aplicaciones como SyncOrbisExpress. Si encuentras problemas específicos, consulta la documentación de Hostinger o contacta con su soporte técnico.
