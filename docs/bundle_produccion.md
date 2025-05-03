# Guía para Crear el Bundle de Producción - SyncOrbisExpress

Esta guía detalla el proceso para crear un paquete de producción optimizado de SyncOrbisExpress, listo para ser desplegado en cualquier entorno.

## Índice

1. [Preparación del Entorno](#preparación-del-entorno)
2. [Generación del Bundle](#generación-del-bundle)
3. [Estructura del Bundle](#estructura-del-bundle)
4. [Optimizaciones](#optimizaciones)
5. [Verificación](#verificación)

## Preparación del Entorno

Antes de generar el bundle de producción, asegúrate de tener:

1. Node.js v14.x o superior instalado
2. Todas las dependencias del proyecto instaladas
3. Configuración correcta en el archivo `.env` o `config.js`

```bash
# Verificar versión de Node.js
node --version

# Instalar dependencias (si no lo has hecho ya)
npm install
```

## Generación del Bundle

SyncOrbisExpress ya incluye scripts para generar un bundle optimizado para producción, con la opción de ofuscar el código para mayor seguridad.

### 1. Generar bundle estándar

Para crear un bundle estándar para producción, ejecuta:

```bash
# Crear el bundle de producción estándar
npm run build:bundle
```

Este comando ejecuta el script `build-prod.sh` que realiza las siguientes acciones:

1. Instala las dependencias necesarias
2. Limpia la carpeta `dist/`
3. Compila el código TypeScript
4. Copia los scripts JavaScript a la carpeta `dist/scripts/`
5. Copia los archivos estáticos y de configuración
6. Crea las carpetas necesarias para imágenes
7. Optimiza el archivo `package.json` para producción

### 2. Generar bundle con ofuscación

Si deseas mayor seguridad, puedes generar un bundle con el código ofuscado:

```bash
# Crear el bundle de producción con ofuscación
npm run build:bundle:obfuscate
```

Este comando ejecuta el mismo script `build-prod.sh` con la opción `--obfuscate`, que además de los pasos anteriores:

1. Verifica si `javascript-obfuscator` está instalado (y lo instala si es necesario)
2. Ejecuta el script `obfuscate.js` que ofusca todos los archivos JavaScript en la carpeta `dist/`
3. Aplica técnicas avanzadas de ofuscación como:
   - Control flow flattening
   - Dead code injection
   - Identifier renaming
   - String encryption
   - Y otras protecciones

> **Nota**: La ofuscación hace que el código sea más difícil de entender y modificar por terceros, pero también puede afectar ligeramente el rendimiento. Úsala solo cuando la protección del código sea una prioridad.

```javascript
// scripts/build.js
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Carpeta de destino
const DIST_FOLDER = path.resolve(__dirname, '../dist');

// Crear carpeta dist si no existe
fs.ensureDirSync(DIST_FOLDER);

// Limpiar carpeta dist
fs.emptyDirSync(DIST_FOLDER);

console.log('🔨 Creando bundle de producción...');

// Copiar archivos necesarios
const filesToCopy = [
  'scripts/sync-js.js',
  'scripts/reset-db.js',
  'scripts/reset-db-full.js',
  'package.json',
  'package-lock.json',
  '.env.example',
  'README.md',
  'docs'
];

filesToCopy.forEach(file => {
  const src = path.resolve(__dirname, '../', file);
  const dest = path.resolve(DIST_FOLDER, file);
  
  if (fs.existsSync(src)) {
    if (fs.lstatSync(src).isDirectory()) {
      fs.copySync(src, dest);
      console.log(`📁 Carpeta copiada: ${file}`);
    } else {
      fs.copySync(src, dest);
      console.log(`📄 Archivo copiado: ${file}`);
    }
  }
});

// Crear carpetas para imágenes
fs.ensureDirSync(path.resolve(DIST_FOLDER, 'imagenes_inmuebles'));
fs.ensureDirSync(path.resolve(DIST_FOLDER, 'imagenes_asesores'));

// Crear archivo .env de ejemplo si no existe
const envExamplePath = path.resolve(DIST_FOLDER, '.env.example');
if (!fs.existsSync(envExamplePath)) {
  const envContent = `DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=syncorbis
MYSQL_PASSWORD=password
MYSQL_DATABASE=inmuebles
API_URL=https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/
IMAGES_FOLDER=./imagenes_inmuebles
ASESOR_IMAGES_FOLDER=./imagenes_asesores`;

  fs.writeFileSync(envExamplePath, envContent);
  console.log('📄 Archivo .env.example creado');
}

// Instalar dependencias de producción
console.log('📦 Instalando dependencias de producción...');
execSync('npm install --production', { cwd: DIST_FOLDER, stdio: 'inherit' });

// Crear archivo ZIP del bundle
console.log('🗜️ Comprimiendo bundle...');
const zipFileName = `syncorbis-bundle-${new Date().toISOString().split('T')[0]}.zip`;
execSync(`cd ${DIST_FOLDER} && zip -r ../${zipFileName} .`, { stdio: 'inherit' });

console.log(`✅ Bundle creado exitosamente: ${zipFileName}`);
console.log('📂 Contenido disponible en la carpeta dist/');
```

## Estructura del Bundle

El bundle de producción generado por el script `build-prod.sh` tendrá la siguiente estructura:

```
dist/
├── scripts/
│   ├── sync-js.js
│   ├── reset-db.js
│   ├── reset-db-full.js
│   ├── clean-syncs.js
│   ├── fix-nulls.js
│   └── fix-relational-fields.js
├── docs/
│   ├── despliegue.md
│   └── bundle_produccion.md
├── imagenes_inmuebles/
├── imagenes_asesores/
├── index.js           # Punto de entrada principal
├── package.json      # Optimizado para producción
├── .env.example      # Plantilla de configuración
└── node_modules/     # Solo dependencias de producción (si se ejecutó npm install)
```

Además, si has ejecutado el script completo, encontrarás un archivo ZIP en la raíz del proyecto que contiene todo el bundle listo para ser desplegado.

## Optimizaciones

El bundle de producción incluye varias optimizaciones:

1. **Solo dependencias de producción**: No incluye dependencias de desarrollo
2. **Archivos mínimos**: Solo contiene los archivos necesarios para ejecutar la aplicación
3. **Estructura organizada**: Mantiene la estructura de carpetas para facilitar el despliegue
4. **Configuración de ejemplo**: Incluye un archivo `.env.example` como referencia

## Verificación

Antes de desplegar el bundle, es recomendable verificar su correcto funcionamiento:

### 1. Verificar la estructura del bundle

```bash
# Verificar la estructura de la carpeta dist
ls -la dist/
ls -la dist/scripts/
```

### 2. Probar el bundle en un entorno local

```bash
# Entrar en la carpeta dist
cd dist

# Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores correctos para pruebas

# Instalar dependencias de producción (si no se han instalado)
npm install --production

# Probar la sincronización con un límite bajo
node scripts/sync-js.js --limite=5
```

### 3. Verificar la ofuscación (si se aplicó)

Si generaste el bundle con ofuscación, puedes verificar que el código esté efectivamente ofuscado:

```bash
# Ver las primeras líneas de un archivo JavaScript ofuscado
head -n 20 dist/scripts/sync-js.js
```

El código ofuscado será difícil de leer, con nombres de variables y funciones transformados, y posiblemente con cadenas de texto codificadas.

Si todas las verificaciones son exitosas, el bundle está listo para ser desplegado en producción siguiendo las instrucciones del documento [despliegue.md](./despliegue.md).

---

## Notas Adicionales

### Personalización del Bundle

Puedes personalizar el contenido del bundle modificando el array `filesToCopy` en el script `build.js`. Esto te permite incluir o excluir archivos según tus necesidades específicas.

### Versiones de Dependencias

El bundle incluirá las versiones exactas de las dependencias especificadas en `package-lock.json`, lo que garantiza la consistencia entre entornos.

### Seguridad

El bundle no incluye archivos sensibles como `.env` o credenciales. Asegúrate de configurar adecuadamente las variables de entorno en el servidor de producción.

### Tamaño del Bundle

Para reducir el tamaño del bundle, considera excluir documentación no esencial, archivos de prueba y otros recursos que no sean necesarios en producción.
