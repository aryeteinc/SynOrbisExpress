# Guía Rápida de SyncOrbisExpress

Esta guía proporciona instrucciones rápidas para las operaciones más comunes de SyncOrbisExpress.

## Instalación Rápida

### Instalación Estándar (Recomendada para Producción)

```bash
# Clonar el repositorio
git clone https://github.com/aryeteinc/SynOrbisExpress.git
cd SynOrbisExpress

# Instalar dependencias
npm install

# Configurar el entorno
cp .env.example .env
# Editar .env con tus credenciales

# Verificar y configurar el sistema
npm run setup
```

### Instalación con Docker (Opcional, para Desarrollo)

```bash
# Clonar el repositorio
git clone https://github.com/aryeteinc/SynOrbisExpress.git
cd SynOrbisExpress

# Instalar dependencias
npm install

# Configurar Docker (opcional)
npm run setup:docker

# Verificar y configurar el sistema con Docker
npm run setup -- --docker
```

## Comandos Principales

### Sincronización

```bash
# Sincronización completa
npm run sync:js

# Sincronización con límite
npm run sync:js -- --limite=100

# Sincronización sin imágenes
npm run sync:js -- --no-imagenes
```

### Optimización

```bash
# Optimizar la base de datos y el rendimiento
npm run optimize
```

### Solución de Problemas

```bash
# Corregir tabla inmuebles (columnas faltantes)
npm run fix-inmuebles

# Reiniciar la base de datos (¡CUIDADO! Elimina todos los datos)
node scripts/reset-db.js --confirmar

# Limpiar sincronizaciones bloqueadas
node scripts/clean-syncs.js --sync-id=<ID>
```

## Verificación del Sistema

```bash
# Verificar el estado del sistema
npm run setup

# Verificar con modo detallado
npm run setup -- --verbose
```

## Estructura de Archivos Importantes

- `.env` - Configuración del sistema (credenciales, rutas, etc.)
- `scripts/sync-js.js` - Script principal de sincronización
- `scripts/setup.js` - Script de verificación y configuración
- `scripts/optimize-sync.js` - Script de optimización
- `docs/` - Documentación completa

## Solución de Problemas Comunes

| Problema | Solución |
|----------|----------|
| Error de conexión a la base de datos | Verificar credenciales en `.env` |
| Error "Unknown column 'area_construida'" | Ejecutar `npm run fix-inmuebles` |
| Sincronización lenta | Ejecutar `npm run optimize` |
| Error de permisos en imágenes | Verificar permisos de carpeta `public/images/inmuebles` |

## Documentación Completa

Para instrucciones detalladas, consulta la documentación completa en la carpeta `docs/`:

- [Instalación Estándar](instalacion.md)
- [Instalación con Docker](instalacion-docker.md)
- [Sincronización](sincronizacion.md)
- [Optimización](optimizacion.md)
- [Solución de Problemas](solucion-problemas.md)
