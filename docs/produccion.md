# Guía de Compilación y Despliegue para Producción

Esta guía proporciona instrucciones detalladas para compilar y desplegar SyncOrbis Express en un entorno de producción.

## Índice

1. [Requisitos Previos](#requisitos-previos)
2. [Scripts de Compilación](#scripts-de-compilación)
3. [Proceso de Compilación](#proceso-de-compilación)
4. [Ofuscación de Código](#ofuscación-de-código)
5. [Estructura de Archivos para Producción](#estructura-de-archivos-para-producción)
6. [Despliegue en Diferentes Entornos](#despliegue-en-diferentes-entornos)
7. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
8. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Requisitos Previos

Antes de compilar SyncOrbis Express para producción, asegúrate de tener:

- Node.js v16.x o superior
- NPM v7.x o superior
- Todas las dependencias instaladas (`npm install`)
- Configuración adecuada en el archivo `.env`

## Scripts de Compilación

SyncOrbis Express proporciona varios scripts para facilitar la compilación y el despliegue:

### Scripts en package.json

```json
{
  "scripts": {
    "build": "tsc",
    "build:prod": "NODE_ENV=production npm run clean && tsc && npm run copy-scripts",
    "copy-scripts": "mkdir -p dist/scripts && cp scripts/*.js dist/scripts/",
    "start": "node dist/index.js",
    "start:prod": "NODE_ENV=production node dist/index.js",
    "clean": "rimraf dist",
    "rebuild": "npm run clean && npm run build"
  }
}
```

### Script de Shell para Compilación

El script `scripts/build-prod.sh` automatiza todo el proceso de compilación para producción:

```bash
# Ejecutar desde la raíz del proyecto
./scripts/build-prod.sh
```

Este script realiza las siguientes acciones:
1. Instala las dependencias
2. Limpia la carpeta `dist/`
3. Compila el código TypeScript
4. Copia los scripts JavaScript
5. Copia los archivos estáticos
6. Optimiza el `package.json` para producción

### Script de JavaScript para Despliegue

También puedes usar el script `scripts/deploy.js` para un proceso más detallado:

```bash
# Ejecutar desde la raíz del proyecto
node scripts/deploy.js
```

## Proceso de Compilación

Para compilar manualmente la aplicación para producción:

1. **Limpiar la carpeta de distribución**:
   ```bash
   npm run clean
   ```

2. **Compilar el código TypeScript**:
   ```bash
   npm run build:prod
   ```

3. **Verificar la compilación**:
   ```bash
   ls -la dist/
   ```

### Usando el Script de Compilación Automatizado

Para una compilación más completa, puedes usar el script automatizado:

```bash
# Compilación estándar
./scripts/build-prod.sh

# Compilación con ofuscación de código
./scripts/build-prod.sh --obfuscate
```

## Ofuscación de Código

La ofuscación de código es una técnica que transforma el código JavaScript en una versión más difícil de entender y analizar, lo que proporciona una capa adicional de protección para tu propiedad intelectual.

### Beneficios de la Ofuscación

- **Protección de la Propiedad Intelectual**: Dificulta la ingeniería inversa de tu código
- **Seguridad Mejorada**: Oculta detalles de implementación y posibles vulnerabilidades
- **Prevención de Manipulación**: Hace más difícil modificar el código para fines maliciosos

### Cómo Ofuscar el Código

1. **Usando el Script de Compilación**:
   ```bash
   ./scripts/build-prod.sh --obfuscate
   ```

2. **Ofuscación Manual** (después de la compilación):
   ```bash
   # Primero compila normalmente
   npm run build:prod
   
   # Luego ofusca el código
   node scripts/obfuscate.js
   ```

### Configuración de la Ofuscación

Puedes personalizar las opciones de ofuscación editando el archivo `scripts/obfuscate.js`. Algunas opciones disponibles son:

- **controlFlowFlattening**: Dificulta el seguimiento del flujo de control
- **deadCodeInjection**: Añade código muerto para confundir a los analizadores
- **stringArray**: Mueve las cadenas de texto a un array protegido
- **selfDefending**: Hace que el código sea resistente a la reformateación

### Consideraciones Importantes

- La ofuscación aumenta ligeramente el tamaño del código
- El rendimiento puede verse afectado mínimamente en código muy complejo
- Guarda siempre una copia del código original sin ofuscar para futuras actualizaciones

## Estructura de Archivos para Producción

Después de la compilación, la carpeta `dist/` contendrá la siguiente estructura:

```
dist/
├── index.js           # Punto de entrada principal
├── routes/            # Rutas de la API
├── controllers/       # Controladores
├── models/            # Modelos de datos
├── database/          # Configuración de la base de datos
├── middlewares/       # Middlewares
├── scripts/           # Scripts de sincronización
│   ├── sync-js.js
│   ├── clean-syncs.js
│   ├── reset-db.js
│   ├── fix-nulls.js
│   └── fix-relational-fields.js
├── docs/              # Documentación
├── .env.example       # Ejemplo de configuración
└── package.json       # Dependencias y scripts
```

## Despliegue en Diferentes Entornos

### Servidor Dedicado o VPS

1. **Transferir archivos**:
   ```bash
   # Desde la raíz del proyecto
   scp -r dist/ usuario@servidor:/ruta/destino/
   ```

2. **Configurar en el servidor**:
   ```bash
   cd /ruta/destino/
   cp .env.example .env
   # Editar .env con la configuración adecuada
   npm install --production
   npm start
   ```

### Usando PM2 para Gestión de Procesos

Para mantener la aplicación en ejecución y gestionar reinicios:

1. **Instalar PM2**:
   ```bash
   npm install -g pm2
   ```

2. **Iniciar la aplicación**:
   ```bash
   cd /ruta/destino/
   pm2 start index.js --name "syncorbis-express"
   ```

3. **Configurar inicio automático**:
   ```bash
   pm2 startup
   pm2 save
   ```

4. **Comandos útiles de PM2**:
   ```bash
   pm2 list                    # Ver procesos en ejecución
   pm2 logs syncorbis-express  # Ver logs
   pm2 restart syncorbis-express # Reiniciar
   pm2 stop syncorbis-express  # Detener
   ```

### Despliegue con Docker

Si prefieres usar Docker (consulta [docs/despliegue.md](./despliegue.md) para más detalles):

1. **Construir la imagen**:
   ```bash
   docker build -t syncorbis-express .
   ```

2. **Ejecutar el contenedor**:
   ```bash
   docker run -d -p 3001:3001 --name syncorbis-app syncorbis-express
   ```

## Configuración de Variables de Entorno

Para producción, es importante configurar correctamente las siguientes variables:

```
# Configuración general
NODE_ENV=production
PORT=3001

# Configuración de la API
API_URL=https://tu-api-url/
IMAGES_FOLDER=./imagenes_inmuebles

# Configuración de la base de datos (MySQL recomendado para producción)
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=usuario_db
MYSQL_PASSWORD=contraseña_segura
MYSQL_DATABASE=inmuebles

# Configuración de seguridad
JWT_SECRET=tu_secreto_jwt_muy_seguro
```

### Recomendaciones de Seguridad

- Usa contraseñas fuertes y únicas para la base de datos
- Genera un JWT_SECRET aleatorio y complejo
- No compartas el archivo `.env` en repositorios públicos
- Considera usar un gestor de secretos para entornos críticos
- Utiliza la opción de ofuscación de código para protección adicional
- Implementa HTTPS para todas las comunicaciones

## Solución de Problemas Comunes

### Error: Cannot find module

Si aparece un error del tipo "Cannot find module", verifica:

1. Que todas las dependencias estén instaladas:
   ```bash
   npm install --production
   ```

2. Que la estructura de carpetas sea correcta:
   ```bash
   ls -la
   ```

### Problemas de Conexión a la Base de Datos

1. Verifica las credenciales en el archivo `.env`
2. Asegúrate de que el servidor de base de datos esté en ejecución
3. Comprueba que el usuario tenga los permisos adecuados

### Errores de Sincronización

Si hay problemas con la sincronización:

1. Ejecuta el script de limpieza:
   ```bash
   node scripts/clean-syncs.js
   ```

2. Verifica la conectividad con la API externa:
   ```bash
   curl -I https://tu-api-url/
   ```

### Optimización de Rendimiento

Para mejorar el rendimiento en producción:

1. Usa MySQL en lugar de SQLite para bases de datos grandes
2. Configura un servidor proxy inverso como Nginx
3. Implementa un sistema de caché para respuestas frecuentes
4. Considera usar un CDN para servir imágenes
