# SyncOrbis Express API - Documentación Completa

## Introducción

SyncOrbis Express proporciona una API REST para acceder a la información de inmuebles sincronizada desde el sistema externo Orbis. Esta documentación describe todos los endpoints disponibles en la API.

## Autenticación

Algunos endpoints requieren autenticación mediante JWT (JSON Web Token). Para obtener un token, utiliza el endpoint de autenticación:

```
POST /api/auth/login
```

Con el siguiente cuerpo:

```json
{
  "username": "tu_usuario",
  "password": "tu_contraseña"
}
```

La respuesta incluirá un token JWT que debes incluir en las solicitudes posteriores en el encabezado `Authorization`:

```
Authorization: Bearer tu_token_jwt
```

## Endpoints de Inmuebles

### Listar Inmuebles

```
GET /api/inmuebles
```

Retorna una lista de inmuebles con información básica, imágenes y características.

#### Parámetros de consulta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| ref | number | Filtrar por referencia del inmueble |
| codigo_consignacion | string | Filtrar por código de consignación |
| codigo_sincronizacion | string | Filtrar por código de sincronización |
| ciudad | string | Filtrar por nombre de ciudad |
| barrio | string | Filtrar por nombre de barrio |
| tipo_inmueble_id | number | Filtrar por ID de tipo de inmueble |
| uso_id | number | Filtrar por ID de uso |
| estado_actual_id | number | Filtrar por ID de estado actual |
| area_min | number | Filtrar por área mínima |
| area_max | number | Filtrar por área máxima |
| precio_venta_min | number | Filtrar por precio de venta mínimo |
| precio_venta_max | number | Filtrar por precio de venta máximo |
| precio_canon_min | number | Filtrar por precio de canon mínimo |
| precio_canon_max | number | Filtrar por precio de canon máximo |
| habitaciones_min | number | Filtrar por número mínimo de habitaciones |
| banos_min | number | Filtrar por número mínimo de baños |
| garajes_min | number | Filtrar por número mínimo de garajes |
| estrato_min | number | Filtrar por estrato mínimo |
| estrato_max | number | Filtrar por estrato máximo |
| activo | boolean | Filtrar por estado activo/inactivo |
| ordenar_por | string | Campo por el cual ordenar los resultados |
| orden | string | Dirección de ordenamiento (asc/desc) |
| limite | number | Número máximo de resultados a retornar |
| offset | number | Número de resultados a saltar |

#### Ejemplo de respuesta

```json
{
  "success": true,
  "count": 158,
  "data": [
    {
      "id": 1,
      "ref": "244",
      "codigo_consignacion": "ABC123",
      "titulo": "Apartamento en Venecia I",
      "descripcion": "Hermoso apartamento con vista panorámica...",
      "ciudad": "Sincelejo (Suc)",
      "barrio": "VENECIA I",
      "tipo_inmueble": "Apartamento",
      "uso": "Vivienda",
      "estado_actual": "Disponible",
      "area": 120,
      "habitaciones": 3,
      "banos": 2,
      "garajes": 1,
      "precio_venta": 250000000,
      "precio_canon": 0,
      "activo": true,
      "imagenes": [
        {
          "id": 1,
          "url": "/api/inmuebles/images/1/1.jpg",
          "url_original": "https://ejemplo.com/imagen1.jpg",
          "ancho": 1200,
          "alto": 800,
          "es_principal": true
        }
      ],
      "caracteristicas": [
        {
          "id": 1,
          "nombre": "Piso en Cerámica",
          "tipo": "booleano",
          "valor": true
        },
        {
          "id": 2,
          "nombre": "Área construida",
          "tipo": "numerico",
          "unidad": "m2",
          "valor": 120
        }
      ]
    }
  ]
}
```

### Obtener un Inmueble Específico

```
GET /api/inmuebles/:id
```

Retorna información detallada de un inmueble específico.

#### Parámetros de ruta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| id | number | ID del inmueble |

#### Ejemplo de respuesta

Similar a la respuesta de listar inmuebles, pero con un solo objeto de inmueble.

### Acceder a Imágenes de Inmuebles

Las imágenes de los inmuebles se sirven a través de una URL que se incluye en la respuesta de los endpoints `/api/inmuebles` y `/api/inmuebles/:id`. Cada imagen tiene una propiedad `url` que contiene la ruta para acceder a ella.

**Nota**: Actualmente, las imágenes se almacenan localmente en el servidor en la carpeta configurada en `config.imagesFolder`, pero el endpoint para servir estas imágenes directamente podría no estar implementado en todas las versiones. En ese caso, las imágenes pueden ser accesibles a través de un servidor web estático configurado para servir desde esa carpeta.

### Obtener Estadísticas de Inmuebles

**Nota importante**: El endpoint `/api/inmuebles/stats` está definido en el código pero actualmente no funciona correctamente debido a un conflicto de rutas con `/api/inmuebles/:id`. Cuando intentas acceder a `/api/inmuebles/stats`, el sistema lo interpreta como una solicitud para un inmueble con ID "stats".

Para obtener estadísticas, se recomienda usar los siguientes endpoints alternativos:

```
# Estadísticas generales del sistema
GET /api/stats

# Estadísticas de sincronización
GET /api/stats/sync
```

Estos endpoints proporcionan información similar y no tienen el problema de conflicto de rutas.

### Subir Imagen para un Inmueble (Requiere autenticación)

```
POST /api/inmuebles/:id/images
```

Sube una nueva imagen para un inmueble específico.

#### Parámetros de ruta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| id | number | ID del inmueble |

#### Parámetros de formulario

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| image | file | Archivo de imagen a subir |
| es_principal | boolean | Indica si la imagen es la principal |

### Eliminar Imagen de un Inmueble (Requiere autenticación)

```
DELETE /api/inmuebles/images/:imageId
```

Elimina una imagen específica.

#### Parámetros de ruta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| imageId | number | ID de la imagen |

## Endpoints de Inmuebles con Características

### Listar Inmuebles con Características

```
GET /api/inmuebles-caracteristicas
```

Retorna una lista de inmuebles con sus características detalladas.

#### Parámetros de consulta

Soporta los mismos parámetros que el endpoint `/api/inmuebles` y adicionalmente:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| page | number | Número de página para paginación |
| limit | number | Número de resultados por página |
| q | string | Búsqueda de texto en título y descripción |
| refs | string | Lista de referencias separadas por comas |
| caracteristica | string | Filtrar por nombre de característica |
| caracteristica_valor | string | Filtrar por valor de característica |

### Obtener un Inmueble con Características

```
GET /api/inmuebles-caracteristicas/:id
```

Retorna información detallada de un inmueble específico con todas sus características.

#### Parámetros de ruta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| id | number | ID del inmueble |

## Endpoints de Sincronización (Requieren autenticación)

### Iniciar Sincronización Manual

```
POST /api/sync/start
```

Inicia un proceso de sincronización manual con el sistema externo.

#### Parámetros de cuerpo (opcionales)

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| filtros | object | Filtros para la sincronización |
| limite | number | Número máximo de inmuebles a sincronizar |
| descargar_imagenes | boolean | Indica si se deben descargar las imágenes |
| registrar_cambios | boolean | Indica si se deben registrar los cambios |
| marcar_inactivos | boolean | Indica si se deben marcar como inactivos los inmuebles que no están en la API |

### Verificar Estado de Sincronización

```
GET /api/sync/status/:id
```

Verifica el estado de un proceso de sincronización específico.

#### Parámetros de ruta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| id | number | ID de la ejecución de sincronización |

### Obtener Historial de Sincronizaciones

```
GET /api/sync/history
```

Retorna el historial de sincronizaciones realizadas.

#### Parámetros de consulta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| page | number | Número de página para paginación |
| limit | number | Número de resultados por página |

### Limpiar Sincronizaciones Bloqueadas

```
POST /api/sync/clean
```

Limpia las sincronizaciones que quedaron bloqueadas (en estado "en progreso" por más de 5 minutos).

## Endpoints de Autenticación

### Iniciar Sesión

```
POST /api/auth/login
```

Inicia sesión y obtiene un token JWT.

#### Parámetros de cuerpo

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| username | string | Nombre de usuario |
| password | string | Contraseña |

#### Ejemplo de respuesta

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  }
}
```

### Refrescar Token

```
POST /api/auth/refresh
```

Obtiene un nuevo token JWT usando un token de refresco.

#### Parámetros de cuerpo

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| refreshToken | string | Token de refresco obtenido previamente |

### Verificar Token

```
GET /api/auth/verify
```

Verifica si un token JWT es válido.

## Endpoints de Estadísticas

### Obtener Estadísticas Generales

```
GET /api/stats
```

Retorna estadísticas generales del sistema.

### Obtener Estadísticas de Sincronización

```
GET /api/stats/sync
```

Retorna estadísticas de los procesos de sincronización.

## Endpoints de Configuración

### Obtener Configuración

```
GET /api/config
```

Retorna la configuración pública del sistema.

## Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 | OK - La solicitud se ha completado correctamente |
| 201 | Created - El recurso se ha creado correctamente |
| 400 | Bad Request - La solicitud es incorrecta o malformada |
| 401 | Unauthorized - Se requiere autenticación |
| 403 | Forbidden - No tienes permisos para acceder al recurso |
| 404 | Not Found - El recurso no existe |
| 409 | Conflict - Conflicto con el estado actual del recurso |
| 500 | Internal Server Error - Error interno del servidor |

## Consideraciones de Uso

- Los endpoints que requieren autenticación deben incluir el token JWT en el encabezado `Authorization`.
- Las solicitudes de sincronización pueden tardar varios minutos en completarse, dependiendo del volumen de datos.
- Las imágenes se almacenan localmente en el servidor y se sirven a través del endpoint `/api/inmuebles/images/:propertyId/:filename`.
- El sistema realiza una limpieza automática de sincronizaciones huérfanas (bloqueadas) cada vez que se inicia una nueva sincronización.
- Los filtros de búsqueda se pueden combinar para obtener resultados más específicos.

## Guía Completa de Consultas y Filtros

### Consultas por Rangos

SyncOrbis Express permite filtrar propiedades por rangos de valores en varios campos. A continuación se detallan todas las opciones disponibles:

#### Rangos de Precios

```
# Filtrar por rango de precio de venta
GET /api/inmuebles?precio_venta_min=200000000&precio_venta_max=300000000

# Filtrar por rango de precio de arriendo (canon)
GET /api/inmuebles?precio_canon_min=1000000&precio_canon_max=2000000

# Filtrar por rango de precio de administración
GET /api/inmuebles?precio_administracion_min=100000&precio_administracion_max=300000
```

#### Rangos de Área

```
# Filtrar por rango de área
GET /api/inmuebles?area_min=80&area_max=120
```

#### Rangos de Características Numéricas

```
# Filtrar por número mínimo de habitaciones
GET /api/inmuebles?habitaciones_min=2

# Filtrar por número mínimo de baños
GET /api/inmuebles?banos_min=2

# Filtrar por número mínimo de garajes
GET /api/inmuebles?garajes_min=1

# Filtrar por rango de estrato
GET /api/inmuebles?estrato_min=3&estrato_max=5
```

### Consultas por Texto

```
# Buscar por ciudad (insensible a mayúsculas/minúsculas)
GET /api/inmuebles?ciudad=sincelejo

# Buscar por barrio
GET /api/inmuebles?barrio=venecia

# Buscar por código de sincronización
GET /api/inmuebles?codigo_sincronizacion=ABC123

# Buscar por referencia
GET /api/inmuebles?ref=244
```

### Consultas por Estado

```
# Filtrar inmuebles activos
GET /api/inmuebles?activo=true

# Filtrar inmuebles inactivos
GET /api/inmuebles?activo=false

# Filtrar por estado (disponible, vendido, arrendado, etc.)
GET /api/inmuebles?estado_actual_id=1
```

### Consultas por Tipo y Uso

```
# Filtrar por tipo de inmueble (apartamento, casa, local, etc.)
GET /api/inmuebles?tipo_inmueble_id=1

# Filtrar por uso (vivienda, comercial, etc.)
GET /api/inmuebles?uso_id=1
```

### Ordenamiento y Paginación

```
# Ordenar por precio de venta ascendente
GET /api/inmuebles?ordenar_por=precio_venta&orden=asc

# Ordenar por fecha de actualización descendente
GET /api/inmuebles?ordenar_por=fecha_actualizacion&orden=desc

# Paginación: obtener la segunda página con 20 resultados por página
GET /api/inmuebles?limite=20&offset=20
```

### Consultas Combinadas

Puedes combinar múltiples parámetros para realizar búsquedas más específicas:

```
# Apartamentos en Sincelejo, entre 80-120 m², 2+ habitaciones, precio entre 200-300 millones
GET /api/inmuebles?ciudad=Sincelejo&tipo_inmueble_id=1&area_min=80&area_max=120&habitaciones_min=2&precio_venta_min=200000000&precio_venta_max=300000000&activo=true

# Casas para arriendo en barrio Venecia con 3+ habitaciones
GET /api/inmuebles?barrio=Venecia&tipo_inmueble_id=2&habitaciones_min=3&precio_canon_min=1&activo=true

# Locales comerciales disponibles ordenados por área descendente
GET /api/inmuebles?uso_id=2&tipo_inmueble_id=3&estado_actual_id=1&ordenar_por=area&orden=desc&activo=true
```

### Consultas por Características Específicas

El endpoint de características permite filtrar por características personalizadas:

```
# Inmuebles con piscina
GET /api/inmuebles-caracteristicas?caracteristica=Piscina&caracteristica_valor=true

# Inmuebles con área construida entre 80-120 m²
GET /api/inmuebles-caracteristicas?caracteristica=Área construida&caracteristica_valor_min=80&caracteristica_valor_max=120

# Inmuebles con cocina integral y 2+ baños
GET /api/inmuebles-caracteristicas?caracteristica=Cocina Integral&caracteristica_valor=true&banos_min=2
```

### Consultas de Sincronización

```
# Iniciar sincronización completa
POST /api/sync/start
Content-Type: application/json
Authorization: Bearer tu_token_jwt

{
  "descargar_imagenes": true,
  "registrar_cambios": true,
  "marcar_inactivos": true
}

# Sincronización filtrada por ciudad
POST /api/sync/start
Content-Type: application/json
Authorization: Bearer tu_token_jwt

{
  "filtros": {
    "ciudad": "Sincelejo"
  },
  "limite": 50,
  "descargar_imagenes": true
}

# Sincronización de un inmueble específico
POST /api/sync/start
Content-Type: application/json
Authorization: Bearer tu_token_jwt

{
  "filtros": {
    "ref": 244
  },
  "descargar_imagenes": true,
  "registrar_cambios": true
}
```

### Consultas de Imágenes

```
# Obtener todas las imágenes de un inmueble
GET /api/inmuebles/:id

# Obtener una imagen específica
GET /api/inmuebles/images/:propertyId/:filename

# Subir una nueva imagen (requiere autenticación)
POST /api/inmuebles/:id/images
Content-Type: multipart/form-data
Authorization: Bearer tu_token_jwt

[form-data con campo 'image' y opcionalmente 'es_principal=true']
```

### Consultas de Estadísticas

```
# Obtener estadísticas generales del sistema
GET /api/stats

# Obtener estadísticas de sincronización
GET /api/stats/sync
```
