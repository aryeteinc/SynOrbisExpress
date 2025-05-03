/**
 * Type definitions for the application
 */

// Authentication and Security types
export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenSecret: string;
  refreshTokenExpiresIn: string;
  allowedOrigins: string[];
}

export interface RequestWithUser extends Express.Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

// Property data from API
export interface PropertyFromAPI {
  ref: number;
  codigo_consignacion?: string;
  codigo_sincronizacion?: string;
  ciudad?: string;
  barrio?: string;
  tipo_inmueble?: string;
  uso?: string;
  estado_actual?: string;
  direccion?: string;
  area?: number;
  habitaciones?: number;
  banos?: number;
  garajes?: number;
  estrato?: number;
  precio_venta?: number;
  precio_canon?: number;
  precio_administracion?: number;
  descripcion?: string;
  descripcion_corta?: string;
  latitud?: string;
  longitud?: string;
  imagenes?: PropertyImage[];
  caracteristicas?: PropertyCharacteristic[];
  [key: string]: any; // Allow for additional properties
}

// Property image
export interface PropertyImage {
  url: string;
  es_principal?: boolean;
  orden?: number;
}

// Property characteristic
export interface PropertyCharacteristic {
  nombre: string;
  valor: string | number | boolean;
  tipo?: 'booleano' | 'numerico' | 'texto';
  unidad?: string;
}

// Property change
export interface PropertyChange {
  campo: string;
  valor_anterior: any;
  valor_nuevo: any;
  fecha_cambio?: Date;
}

// API filters
export interface ApiFilters {
  ref?: number;
  codigo_consignacion?: string;
  codigo_sincronizacion?: string;
  uso_id?: number;
  estado_actual_in?: string;
  tipo_inmueble_in?: string;
  canon_min?: number;
  canon_max?: number;
  [key: string]: any; // Allow for additional filters
}

// Command line arguments
export interface CommandLineArgs {
  db_type: 'sqlite' | 'mysql';
  sin_imagenes: boolean;
  inmueble?: string;
  codigo_consignacion?: string;
  ref?: string;
  consignacion?: string;
  limite?: number;
  solo_actualizados: boolean;
  marcar_inactivos: boolean;
  uso_id?: number;
  estado_actual_in?: string;
  tipo_inmueble_in?: string;
  canon_min?: number;
  canon_max?: number;
  historial_cambios: boolean;
  historial_limite: number;
  reset: boolean;
  help: boolean;
  consulta: boolean;
  menu: boolean;
  formato?: string;
  ciudad?: string;
  barrio?: string;
  area_min?: number;
  area_max?: number;
  precio_venta_min?: number;
  precio_venta_max?: number;
  precio_canon_min?: number;
  precio_canon_max?: number;
  habitaciones_min?: number;
  banos_min?: number;
  garajes_min?: number;
  estrato_min?: number;
  estrato_max?: number;
  ordenar_por?: string;
  orden?: string;
  salida?: string;
}

// Statistics for synchronization
export interface Statistics {
  inmuebles_procesados: number;
  inmuebles_nuevos: number;
  inmuebles_actualizados: number;
  inmuebles_sin_cambios: number;
  imagenes_descargadas: number;
  imagenes_eliminadas: number;
  errores: number;
  inicio: Date;
  fin?: Date;
}

// Database query filters
export interface QueryFilters {
  ref?: number;
  codigo_consignacion?: string;
  codigo_sincronizacion?: string;
  ciudad?: string;
  barrio?: string;
  tipo_inmueble_id?: number;
  uso_id?: number;
  estado_actual_id?: number;
  area_min?: number;
  area_max?: number;
  precio_venta_min?: number;
  precio_venta_max?: number;
  precio_canon_min?: number;
  precio_canon_max?: number;
  habitaciones_min?: number;
  banos_min?: number;
  garajes_min?: number;
  estrato_min?: number;
  estrato_max?: number;
  activo?: boolean;
  ordenar_por?: string;
  orden?: 'asc' | 'desc';
  limite?: number;
  offset?: number;
}
