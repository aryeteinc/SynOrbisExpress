# Guía de Instalación de SyncOrbisExpress con Docker (Opcional)

Esta guía proporciona instrucciones detalladas para instalar y configurar SyncOrbisExpress en un nuevo entorno, utilizando Docker para la base de datos MySQL.

> **IMPORTANTE**: El uso de Docker es completamente OPCIONAL y está pensado principalmente para entornos de DESARROLLO donde se quiere simplificar la configuración. En entornos de PRODUCCIÓN, se recomienda utilizar una instalación estándar de MySQL.

## Requisitos Previos

- Node.js (versión 14 o superior)
- Docker (versión 19 o superior)
- Git

## Pasos de Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/aryeteinc/SynOrbisExpress.git
cd SynOrbisExpress
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar la Base de Datos en Docker

Utilizaremos un script especial que configura automáticamente un contenedor Docker con MySQL:

```bash
npm run setup:docker
```

Este script realizará las siguientes acciones:
- Verificar que Docker esté instalado
- Crear una red Docker para la comunicación entre contenedores
- Crear un contenedor MySQL con la configuración necesaria
- Actualizar el archivo `.env` con la configuración correcta

### 4. Ejecutar el Script de Instalación y Verificación

Una vez configurada la base de datos en Docker, ejecutamos el script de instalación principal:

```bash
npm run setup -- --docker
```

Este script verificará:
- Las dependencias de Node.js
- La existencia del archivo `.env`
- La conexión a la base de datos en Docker
- La estructura de la base de datos
- Los directorios necesarios para las imágenes

### 5. Optimizar la Sincronización

Para mejorar el rendimiento de la sincronización:

```bash
npm run optimize
```

### 6. Ejecutar la Sincronización

```bash
npm run sync:js
```

## Estructura de Docker

El sistema utiliza los siguientes componentes de Docker:

- **Red**: `syncorbis-network` (configurable en `.env`)
- **Contenedor MySQL**: `syncorbis-mysql` (configurable en `.env`)
- **Puerto**: 3306 (configurable en `.env`)

## Comandos Útiles para Docker

### Ver el Estado de los Contenedores

```bash
docker ps -a
```

### Ver Logs del Contenedor MySQL

```bash
docker logs syncorbis-mysql
```

### Acceder a MySQL desde la Terminal

```bash
docker exec -it syncorbis-mysql mysql -u root -p
```

### Detener el Contenedor MySQL

```bash
docker stop syncorbis-mysql
```

### Iniciar el Contenedor MySQL

```bash
docker start syncorbis-mysql
```

## Solución de Problemas Comunes

### Error de Conexión a la Base de Datos

Si recibes un error de conexión a la base de datos:

1. Verifica que el contenedor Docker esté en ejecución:
   ```bash
   docker ps | grep syncorbis-mysql
   ```

2. Si no está en ejecución, inícialo:
   ```bash
   docker start syncorbis-mysql
   ```

3. Verifica las credenciales en el archivo `.env`:
   ```
   MYSQL_HOST=mysql
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=syncorbis
   ```

### Error de Estructura de Tabla

Si recibes un error como "Unknown column 'area_construida' in 'field list'":

```bash
npm run fix-inmuebles
```

### Error de Permisos de Directorio

Si recibes un error de permisos al guardar imágenes:

```bash
mkdir -p ./public/images/inmuebles
chmod -R 755 ./public/images/inmuebles
```

## Configuración para Producción

En un entorno de producción, es recomendable:

1. Cambiar las contraseñas por defecto en el archivo `.env`
2. Configurar un volumen para persistir los datos de MySQL:
   ```bash
   docker run --name syncorbis-mysql \
     -e MYSQL_ROOT_PASSWORD=tu_contraseña_segura \
     -e MYSQL_DATABASE=inmuebles \
     -p 3306:3306 \
     -v syncorbis_mysql_data:/var/lib/mysql \
     --network syncorbis-network \
     -d mysql:5.7
   ```

3. Configurar backups automáticos de la base de datos

## Actualización del Sistema

Para actualizar SyncOrbisExpress a la última versión:

```bash
git pull
npm install
npm run setup -- --docker
```

## Soporte

Si encuentras algún problema que no puedes resolver, por favor abre un issue en el repositorio de GitHub o contacta al equipo de soporte.
