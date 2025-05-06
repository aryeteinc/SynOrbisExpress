# Documentación de SyncOrbisExpress

Esta carpeta contiene toda la documentación del sistema SyncOrbisExpress, una aplicación para sincronizar datos de propiedades inmobiliarias desde una API externa a una base de datos local.

## Índice de Documentación

### Guías de Instalación
- [Instalación Estándar](instalacion.md) - Guía para instalar y configurar SyncOrbisExpress con MySQL local (recomendado para producción)
- [Instalación con Docker](instalacion-docker.md) - Guía opcional para instalar y configurar SyncOrbisExpress con MySQL en Docker (recomendado para desarrollo)

### Sincronización y Operación
- [Sincronización](sincronizacion.md) - Detalles sobre el proceso de sincronización y los scripts disponibles
- [Optimización](optimizacion.md) - Técnicas para mejorar el rendimiento de la sincronización
- [Solución de Problemas](solucion-problemas.md) - Soluciones para los problemas más comunes

## Scripts Principales

### Instalación y Configuración
- `setup.js` - Verifica y configura el entorno, la base de datos y los directorios necesarios
- `setup-docker.js` - (Opcional) Configura un contenedor Docker con MySQL para desarrollo
- `fix-inmuebles-table.js` - Corrige la estructura de la tabla `inmuebles` añadiendo columnas faltantes

### Sincronización
- `sync-js.js` - Script principal de sincronización en JavaScript
- `reset-db.js` - Reinicia la base de datos a su estado inicial
- `clean-syncs.js` - Limpia procesos de sincronización huérfanos o bloqueados

### Optimización
- `optimize-sync.js` - Optimiza la base de datos y el rendimiento de la sincronización

## Estructura del Proyecto

```
SyncOrbisExpress/
├── docs/                   # Documentación
├── public/                 # Archivos públicos
│   └── images/             # Imágenes de inmuebles
├── scripts/                # Scripts de sincronización y utilidades
├── src/                    # Código fuente de la aplicación
│   ├── Controllers/        # Controladores
│   ├── Models/             # Modelos
│   ├── Routes/             # Rutas de la API
│   └── Services/           # Servicios
├── .env                    # Variables de entorno (no incluido en el repositorio)
├── .env.example            # Ejemplo de variables de entorno
├── package.json            # Dependencias y scripts
└── README.md               # Documentación principal
```

## Flujo de Trabajo Recomendado

1. **Instalación**: Sigue la guía de instalación estándar o con Docker según tus necesidades
2. **Configuración**: Verifica y ajusta el archivo `.env` con tus credenciales
3. **Optimización**: Ejecuta `optimize-sync.js` para mejorar el rendimiento
4. **Sincronización**: Ejecuta `sync-js.js` para sincronizar los datos
5. **Monitoreo**: Verifica los logs y estadísticas de sincronización

## Soporte y Contribuciones

Si encuentras algún problema o tienes sugerencias para mejorar el sistema, por favor abre un issue en el repositorio de GitHub o contacta al equipo de soporte.
