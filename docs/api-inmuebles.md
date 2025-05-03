# API de Inmuebles - Documentación

## Introducción

SyncOrbis Express proporciona una API REST para acceder a la información de inmuebles sincronizada desde el sistema externo. Esta documentación describe los endpoints disponibles para consultar inmuebles y sus características.

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

El token recibido debe incluirse en las solicitudes posteriores en el encabezado `Authorization`:

```
Authorization: Bearer tu_token_jwt
```

## Endpoints de Inmuebles

### 1. Listar todos los inmuebles

```
GET /api/inmuebles
```

**Descripción**: Obtiene una lista paginada de inmuebles con información básica.

**Parámetros de consulta**:
- `page`: Número de página (por defecto: 1)
- `limit`: Número de elementos por página (por defecto: 10)
- `ref`: Filtrar por número de referencia
- `codigo_sincronizacion`: Filtrar por código de sincronización
- `ciudad`: Filtrar por ciudad
- `barrio`: Filtrar por barrio
- `tipo_inmueble_id`: Filtrar por tipo de inmueble
- `uso_id`: Filtrar por uso
- `estado_actual_id`: Filtrar por estado actual
- `area_min`: Filtrar por área mínima
- `area_max`: Filtrar por área máxima
- `precio_venta_min`: Filtrar por precio de venta mínimo
- `precio_venta_max`: Filtrar por precio de venta máximo
- `precio_canon_min`: Filtrar por precio de canon mínimo
- `precio_canon_max`: Filtrar por precio de canon máximo
- `habitaciones_min`: Filtrar por número mínimo de habitaciones
- `banos_min`: Filtrar por número mínimo de baños
- `garajes_min`: Filtrar por número mínimo de garajes
- `estrato_min`: Filtrar por estrato mínimo
- `estrato_max`: Filtrar por estrato máximo
- `activo`: Filtrar por estado activo (true/false)
- `ordenar_por`: Campo por el cual ordenar
- `orden`: Dirección de ordenamiento (asc/desc)

**Respuesta**:
```json
{
  "total": 100,
  "page": 1,
  "limit": 10,
  "data": [
    {
      "id": 1,
      "ref": 123,
      "titulo": "Apartamento en Venecia",
      "descripcion": "Hermoso apartamento...",
      "area": 120,
      "habitaciones": 3,
      "banos": 2,
      "precio_venta": 350000000,
      "imagenes": [
        {
          "id": 1,
          "url": "/api/inmuebles/images/1/imagen1.jpg",
          "es_principal": true
        }
      ],
      "caracteristicas": [
        {
          "id": 1,
          "nombre": "Piscina",
          "valor": "Si"
        }
      ]
    }
  ]
}
```

### 2. Obtener un inmueble por ID

```
GET /api/inmuebles/:id
```

**Descripción**: Obtiene información detallada de un inmueble específico por su ID.

**Parámetros de ruta**:
- `id`: ID del inmueble

**Respuesta**:
```json
{
  "id": 1,
  "ref": 123,
  "titulo": "Apartamento en Venecia",
  "descripcion": "Hermoso apartamento...",
  "area": 120,
  "habitaciones": 3,
  "banos": 2,
  "precio_venta": 350000000,
  "imagenes": [
    {
      "id": 1,
      "url": "/api/inmuebles/images/1/imagen1.jpg",
      "es_principal": true
    }
  ],
  "caracteristicas": [
    {
      "id": 1,
      "nombre": "Piscina",
      "valor": "Si"
    }
  ]
}
```

## Endpoints de Características de Inmuebles

Estos endpoints están diseñados específicamente para acceder a las características de los inmuebles tal como se sincronizan desde la API externa.

### 1. Listar todos los inmuebles con características

```
GET /api/inmuebles-caracteristicas
```

**Descripción**: Obtiene una lista paginada de inmuebles con todas sus características.

**Parámetros de consulta para paginación**:
- `page`: Número de página (por defecto: 1)
- `limit`: Número de elementos por página (por defecto: 10)
- `orderBy`: Campo por el cual ordenar (por defecto: 'id')
- `orderDir`: Dirección de ordenamiento ('asc' o 'desc', por defecto: 'desc')

**Parámetros de consulta para búsqueda de texto**:
- `q`: Búsqueda de texto completo en título, descripción y descripción corta

**Parámetros de consulta para filtros básicos**:
- `ref`: Filtrar por número de referencia exacto
- `refs`: Filtrar por múltiples referencias (separadas por comas, ej: "123,124,125")
- `codigo_sincronizacion`: Filtrar por código de sincronización exacto
- `titulo`: Filtrar por título (búsqueda parcial)
- `descripcion`: Filtrar por descripción (búsqueda parcial)
- `activo`: Filtrar por estado activo (true/false, por defecto: true)

**Parámetros de consulta para filtros de ubicación**:
- `ciudad_id`: Filtrar por ID de ciudad
- `barrio_id`: Filtrar por ID de barrio

**Parámetros de consulta para filtros de tipo y uso**:
- `tipo_inmueble_id`: Filtrar por ID de tipo de inmueble
- `uso_id`: Filtrar por ID de uso
- `estado_actual_id`: Filtrar por ID de estado actual

**Parámetros de consulta para filtros de características físicas**:
- `area_min`: Filtrar por área mínima
- `area_max`: Filtrar por área máxima
- `habitaciones_min`: Filtrar por número mínimo de habitaciones
- `habitaciones_max`: Filtrar por número máximo de habitaciones
- `banos_min`: Filtrar por número mínimo de baños
- `banos_max`: Filtrar por número máximo de baños
- `garajes_min`: Filtrar por número mínimo de garajes
- `garajes_max`: Filtrar por número máximo de garajes
- `estrato_min`: Filtrar por estrato mínimo
- `estrato_max`: Filtrar por estrato máximo

**Parámetros de consulta para filtros de precio**:
- `precio_venta_min`: Filtrar por precio de venta mínimo
- `precio_venta_max`: Filtrar por precio de venta máximo
- `precio_canon_min`: Filtrar por precio de canon mínimo
- `precio_canon_max`: Filtrar por precio de canon máximo

**Parámetros de consulta para filtros de características específicas**:
- `caracteristica`: Filtrar por nombre de característica (ej: "Piscina")
- `caracteristica_nombre`: Nombre de la característica para filtrar (usar junto con `caracteristica_valor`)
- `caracteristica_valor`: Valor de la característica para filtrar (usar junto con `caracteristica_nombre`)
- `caracteristicas`: Filtrar por múltiples características (separadas por comas, ej: "Piscina,Ascensor,Gimnasio")

**Parámetros de consulta para filtros de fecha**:
- `fecha_creacion_desde`: Filtrar inmuebles creados desde esta fecha (formato: YYYY-MM-DD)
- `fecha_creacion_hasta`: Filtrar inmuebles creados hasta esta fecha (formato: YYYY-MM-DD)
- `fecha_actualizacion_desde`: Filtrar inmuebles actualizados desde esta fecha (formato: YYYY-MM-DD)
- `fecha_actualizacion_hasta`: Filtrar inmuebles actualizados hasta esta fecha (formato: YYYY-MM-DD)

**Parámetros de consulta para búsqueda geoespacial**:
- `latitud`: Latitud del punto central para búsqueda por cercanía
- `longitud`: Longitud del punto central para búsqueda por cercanía
- `radio`: Radio de búsqueda en kilómetros
- `ordenar_por_distancia`: Si es "true", ordena los resultados por cercanía al punto especificado

**Respuesta**:
```json
{
  "total": 100,
  "page": 1,
  "limit": 10,
  "data": [
    {
      "id": 1,
      "ref": 123,
      "titulo": "Apartamento en Venecia",
      "descripcion": "Hermoso apartamento...",
      "area": 120,
      "habitaciones": 3,
      "banos": 2,
      "precio_venta": 350000000,
      "imagenes": [
        {
          "id": 1,
          "url": "/api/inmuebles/images/1/imagen1.jpg",
          "es_principal": true
        }
      ],
      "caracteristicas": [
        {
          "id": 1,
          "nombre": "Piscina",
          "valor": "Si"
        },
        {
          "id": 2,
          "nombre": "Ascensor",
          "valor": "Si"
        },
        {
          "id": 3,
          "nombre": "Zonas Verdes",
          "valor": "Si"
        }
      ]
    }
  ]
}
```

### 2. Obtener un inmueble por ID con características

```
GET /api/inmuebles-caracteristicas/:id
```

**Descripción**: Obtiene información detallada de un inmueble específico por su ID, incluyendo todas sus características.

**Parámetros de ruta**:
- `id`: ID del inmueble

**Respuesta**:
```json
{
  "id": 1,
  "ref": 123,
  "titulo": "Apartamento en Venecia",
  "descripcion": "Hermoso apartamento...",
  "area": 120,
  "habitaciones": 3,
  "banos": 2,
  "precio_venta": 350000000,
  "imagenes": [
    {
      "id": 1,
      "url": "/api/inmuebles/images/1/imagen1.jpg",
      "es_principal": true
    }
  ],
  "caracteristicas": [
    {
      "id": 1,
      "nombre": "Piscina",
      "valor": "Si"
    },
    {
      "id": 2,
      "nombre": "Ascensor",
      "valor": "Si"
    },
    {
      "id": 3,
      "nombre": "Zonas Verdes",
      "valor": "Si"
    }
  ]
}
```

### 3. Obtener un inmueble por número de referencia con características

```
GET /api/inmuebles-caracteristicas/ref/:ref
```

**Descripción**: Obtiene información detallada de un inmueble específico por su número de referencia, incluyendo todas sus características.

**Parámetros de ruta**:
- `ref`: Número de referencia del inmueble

**Respuesta**:
```json
{
  "id": 1,
  "ref": 123,
  "titulo": "Apartamento en Venecia",
  "descripcion": "Hermoso apartamento...",
  "area": 120,
  "habitaciones": 3,
  "banos": 2,
  "precio_venta": 350000000,
  "imagenes": [
    {
      "id": 1,
      "url": "/api/inmuebles/images/1/imagen1.jpg",
      "es_principal": true
    }
  ],
  "caracteristicas": [
    {
      "id": 1,
      "nombre": "Piscina",
      "valor": "Si"
    },
    {
      "id": 2,
      "nombre": "Ascensor",
      "valor": "Si"
    },
    {
      "id": 3,
      "nombre": "Zonas Verdes",
      "valor": "Si"
    }
  ]
}
```

## Ejemplos de uso

### Ejemplos básicos con cURL

```bash
# Listar todos los inmuebles con características
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?page=1&limit=10"

# Obtener un inmueble específico con características
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas/1"

# Obtener un inmueble por número de referencia con características
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas/ref/123"
```

### Ejemplos de búsqueda avanzada

```bash
# Búsqueda de texto completo
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?q=piscina"

# Búsqueda por múltiples referencias
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?refs=123,124,125"

# Filtrar por tipo de inmueble y características
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?tipo_inmueble_id=1&caracteristicas=Piscina,Gimnasio"

# Filtrar por rango de precios y área
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?precio_venta_min=200000000&precio_venta_max=500000000&area_min=100"

# Filtrar por ubicación y características
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?ciudad_id=1&barrio_id=5&caracteristica=Piscina"

# Filtrar por característica con valor específico
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?caracteristica_nombre=Piso&caracteristica_valor=Mármol"

# Filtrar por fecha de actualización
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?fecha_actualizacion_desde=2025-01-01&fecha_actualizacion_hasta=2025-04-01"

# Búsqueda geoespacial (inmuebles en un radio de 5km)
curl -X GET "http://localhost:3001/api/inmuebles-caracteristicas?latitud=9.3088&longitud=-75.3971&radio=5&ordenar_por_distancia=true"
```

### Ejemplos para el frontend

#### Búsqueda avanzada con filtros combinados

```javascript
// Ejemplo de cómo construir una URL para búsqueda avanzada en el frontend
const buildSearchUrl = (filters) => {
  const baseUrl = 'http://localhost:3001/api/inmuebles-caracteristicas';
  const params = new URLSearchParams();
  
  // Agregar filtros básicos
  if (filters.q) params.append('q', filters.q);
  if (filters.tipo_inmueble_id) params.append('tipo_inmueble_id', filters.tipo_inmueble_id);
  if (filters.uso_id) params.append('uso_id', filters.uso_id);
  
  // Agregar filtros de precio
  if (filters.precio_min) params.append('precio_venta_min', filters.precio_min);
  if (filters.precio_max) params.append('precio_venta_max', filters.precio_max);
  
  // Agregar filtros de características
  if (filters.caracteristicas && filters.caracteristicas.length > 0) {
    params.append('caracteristicas', filters.caracteristicas.join(','));
  }
  
  // Agregar filtros de ubicación
  if (filters.ciudad_id) params.append('ciudad_id', filters.ciudad_id);
  if (filters.barrio_id) params.append('barrio_id', filters.barrio_id);
  
  // Agregar paginación
  params.append('page', filters.page || 1);
  params.append('limit', filters.limit || 10);
  
  return `${baseUrl}?${params.toString()}`;
};

// Ejemplo de uso
const searchFilters = {
  q: 'apartamento moderno',
  tipo_inmueble_id: 1,
  precio_min: 200000000,
  precio_max: 500000000,
  caracteristicas: ['Piscina', 'Gimnasio', 'Ascensor'],
  ciudad_id: 1,
  page: 1,
  limit: 20
};

const searchUrl = buildSearchUrl(searchFilters);
// Resultado: http://localhost:3001/api/inmuebles-caracteristicas?q=apartamento%20moderno&tipo_inmueble_id=1&precio_venta_min=200000000&precio_venta_max=500000000&caracteristicas=Piscina%2CGimnasio%2CAscensor&ciudad_id=1&page=1&limit=20
```

## Notas importantes

1. Las características de los inmuebles se sincronizan desde la API externa y se almacenan en la base de datos local.
2. Cada característica tiene un nombre y un valor, que puede ser un texto, un número o un booleano.
3. Las imágenes de los inmuebles se descargan y almacenan localmente durante la sincronización.
4. Los endpoints de `/api/inmuebles-caracteristicas` están optimizados para acceder a las características tal como se sincronizan desde la API externa.
