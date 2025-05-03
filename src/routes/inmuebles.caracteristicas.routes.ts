/**
 * Routes for property characteristics
 * These endpoints provide access to property data with their characteristics
 * as synchronized from the external API
 */
import express, { Request, Response } from 'express';
import path from 'path';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { AuthService } from '../services/AuthService';
import { authenticateJWT } from '../middlewares/auth.middleware';

/**
 * Create router with database and auth service
 * @param dbConnection Database connection
 * @param authService Authentication service
 * @returns Express router
 */
export default function createInmueblesCaracteristicasRouter(dbConnection: DatabaseConnection, authService: AuthService) {
  const router = express.Router();
  
  /**
   * @route GET /api/inmuebles-caracteristicas
   * @desc Get all properties with their characteristics
   * @access Public
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      
      // Construir la consulta base
      let query = knex('inmuebles').select('*');
      
      // Aplicar filtros de búsqueda
      // Filtros básicos
      if (req.query.ref) {
        query = query.where('ref', parseInt(req.query.ref as string, 10));
      }
      
      // Búsqueda por múltiples referencias
      if (req.query.refs) {
        const refs = (req.query.refs as string).split(',').map(ref => parseInt(ref.trim(), 10));
        query = query.whereIn('ref', refs);
      }
      
      if (req.query.codigo_sincronizacion) {
        query = query.where('codigo_sincronizacion', req.query.codigo_sincronizacion as string);
      }
      
      if (req.query.titulo) {
        query = query.where('titulo', 'like', `%${req.query.titulo as string}%`);
      }
      
      if (req.query.descripcion) {
        query = query.where('descripcion', 'like', `%${req.query.descripcion as string}%`);
      }
      
      // Búsqueda de texto completo (busca en título y descripción)
      if (req.query.q) {
        const searchTerm = req.query.q as string;
        query = query.where(function() {
          this.where('titulo', 'like', `%${searchTerm}%`)
              .orWhere('descripcion', 'like', `%${searchTerm}%`)
              .orWhere('descripcion_corta', 'like', `%${searchTerm}%`);
        });
      }
      
      // Filtros de ubicación
      if (req.query.ciudad_id) {
        query = query.where('ciudad_id', parseInt(req.query.ciudad_id as string, 10));
      }
      
      if (req.query.barrio_id) {
        query = query.where('barrio_id', parseInt(req.query.barrio_id as string, 10));
      }
      
      // Filtros de tipo y uso
      if (req.query.tipo_inmueble_id) {
        query = query.where('tipo_inmueble_id', parseInt(req.query.tipo_inmueble_id as string, 10));
      }
      
      if (req.query.uso_id) {
        query = query.where('uso_id', parseInt(req.query.uso_id as string, 10));
      }
      
      if (req.query.estado_actual_id) {
        query = query.where('estado_actual_id', parseInt(req.query.estado_actual_id as string, 10));
      }
      
      // Filtros de características físicas
      if (req.query.area_min) {
        query = query.where('area', '>=', parseFloat(req.query.area_min as string));
      }
      
      if (req.query.area_max) {
        query = query.where('area', '<=', parseFloat(req.query.area_max as string));
      }
      
      if (req.query.habitaciones_min) {
        query = query.where('habitaciones', '>=', parseInt(req.query.habitaciones_min as string, 10));
      }
      
      if (req.query.habitaciones_max) {
        query = query.where('habitaciones', '<=', parseInt(req.query.habitaciones_max as string, 10));
      }
      
      if (req.query.banos_min) {
        query = query.where('banos', '>=', parseInt(req.query.banos_min as string, 10));
      }
      
      if (req.query.banos_max) {
        query = query.where('banos', '<=', parseInt(req.query.banos_max as string, 10));
      }
      
      if (req.query.garajes_min) {
        query = query.where('garajes', '>=', parseInt(req.query.garajes_min as string, 10));
      }
      
      if (req.query.garajes_max) {
        query = query.where('garajes', '<=', parseInt(req.query.garajes_max as string, 10));
      }
      
      if (req.query.estrato_min) {
        query = query.where('estrato', '>=', parseInt(req.query.estrato_min as string, 10));
      }
      
      if (req.query.estrato_max) {
        query = query.where('estrato', '<=', parseInt(req.query.estrato_max as string, 10));
      }
      
      // Filtros de precio
      if (req.query.precio_venta_min) {
        query = query.where('precio_venta', '>=', parseFloat(req.query.precio_venta_min as string));
      }
      
      if (req.query.precio_venta_max) {
        query = query.where('precio_venta', '<=', parseFloat(req.query.precio_venta_max as string));
      }
      
      if (req.query.precio_canon_min) {
        query = query.where('precio_canon', '>=', parseFloat(req.query.precio_canon_min as string));
      }
      
      if (req.query.precio_canon_max) {
        query = query.where('precio_canon', '<=', parseFloat(req.query.precio_canon_max as string));
      }
      
      // Filtro por estado activo/inactivo
      if (req.query.activo !== undefined) {
        const activo = req.query.activo === 'true';
        query = query.where('activo', activo);
      } else {
        // Por defecto, solo mostrar inmuebles activos
        query = query.where('activo', true);
      }
      
      // Filtros por características específicas
      if (req.query.caracteristica) {
        // Buscar inmuebles que tengan una característica específica
        const caracteristicaNombre = req.query.caracteristica as string;
        query = query.whereExists(function() {
          this.select('inmueble_caracteristicas.id')
              .from('inmueble_caracteristicas')
              .join('caracteristicas', 'inmueble_caracteristicas.caracteristica_id', 'caracteristicas.id')
              .whereRaw('inmueble_caracteristicas.inmueble_id = inmuebles.id')
              .where('caracteristicas.nombre', 'like', `%${caracteristicaNombre}%`);
        });
      }
      
      // Filtro por característica con valor específico
      if (req.query.caracteristica_nombre && req.query.caracteristica_valor) {
        const caracteristicaNombre = req.query.caracteristica_nombre as string;
        const caracteristicaValor = req.query.caracteristica_valor as string;
        
        query = query.whereExists(function() {
          this.select('inmueble_caracteristicas.id')
              .from('inmueble_caracteristicas')
              .join('caracteristicas', 'inmueble_caracteristicas.caracteristica_id', 'caracteristicas.id')
              .whereRaw('inmueble_caracteristicas.inmueble_id = inmuebles.id')
              .where('caracteristicas.nombre', 'like', `%${caracteristicaNombre}%`)
              .where('inmueble_caracteristicas.valor', 'like', `%${caracteristicaValor}%`);
        });
      }
      
      // Filtro por múltiples características (todas deben estar presentes)
      if (req.query.caracteristicas) {
        const caracteristicas = (req.query.caracteristicas as string).split(',');
        
        for (const caracteristica of caracteristicas) {
          query = query.whereExists(function() {
            this.select('inmueble_caracteristicas.id')
                .from('inmueble_caracteristicas')
                .join('caracteristicas', 'inmueble_caracteristicas.caracteristica_id', 'caracteristicas.id')
                .whereRaw('inmueble_caracteristicas.inmueble_id = inmuebles.id')
                .where('caracteristicas.nombre', 'like', `%${caracteristica.trim()}%`);
          });
        }
      }
      
      // Filtros por fecha
      if (req.query.fecha_creacion_desde) {
        query = query.where('fecha_creacion', '>=', req.query.fecha_creacion_desde as string);
      }
      
      if (req.query.fecha_creacion_hasta) {
        query = query.where('fecha_creacion', '<=', req.query.fecha_creacion_hasta as string);
      }
      
      if (req.query.fecha_actualizacion_desde) {
        query = query.where('fecha_actualizacion', '>=', req.query.fecha_actualizacion_desde as string);
      }
      
      if (req.query.fecha_actualizacion_hasta) {
        query = query.where('fecha_actualizacion', '<=', req.query.fecha_actualizacion_hasta as string);
      }
      
      // Búsqueda geoespacial (por coordenadas)
      if (req.query.latitud && req.query.longitud && req.query.radio) {
        const latitud = parseFloat(req.query.latitud as string);
        const longitud = parseFloat(req.query.longitud as string);
        const radio = parseFloat(req.query.radio as string); // Radio en kilómetros
        
        // Fórmula Haversine para calcular distancia entre coordenadas
        // Esta fórmula es una aproximación para distancias cortas
        const haversineFormula = `
          (6371 * acos(cos(radians(${latitud})) * 
          cos(radians(latitud)) * 
          cos(radians(longitud) - 
          radians(${longitud})) + 
          sin(radians(${latitud})) * 
          sin(radians(latitud))))
        `;
        
        query = query.whereRaw(`${haversineFormula} < ${radio}`);
      }
      
      // Ordenamiento
      const orderBy = req.query.orderBy as string || 'id';
      const orderDir = (req.query.orderDir as string || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      query = query.orderBy(orderBy, orderDir);
      
      // Ordenamiento por distancia si se especifican coordenadas
      if (req.query.latitud && req.query.longitud && req.query.ordenar_por_distancia === 'true') {
        const latitud = parseFloat(req.query.latitud as string);
        const longitud = parseFloat(req.query.longitud as string);
        
        const haversineFormula = `
          (6371 * acos(cos(radians(${latitud})) * 
          cos(radians(latitud)) * 
          cos(radians(longitud) - 
          radians(${longitud})) + 
          sin(radians(${latitud})) * 
          sin(radians(latitud))))
        `;
        
        query = query.orderByRaw(`${haversineFormula} ASC`);
      }
      
      // Aplicar paginación
      const properties = await query.limit(limit).offset(offset);
      
      // Construir consulta para contar el total de registros con los mismos filtros
      let countQuery = knex('inmuebles').count('* as count');
      
      // Aplicar los mismos filtros a la consulta de conteo
      if (req.query.ref) {
        countQuery = countQuery.where('ref', parseInt(req.query.ref as string, 10));
      }
      
      if (req.query.codigo_sincronizacion) {
        countQuery = countQuery.where('codigo_sincronizacion', req.query.codigo_sincronizacion as string);
      }
      
      if (req.query.titulo) {
        countQuery = countQuery.where('titulo', 'like', `%${req.query.titulo as string}%`);
      }
      
      if (req.query.descripcion) {
        countQuery = countQuery.where('descripcion', 'like', `%${req.query.descripcion as string}%`);
      }
      
      if (req.query.ciudad_id) {
        countQuery = countQuery.where('ciudad_id', parseInt(req.query.ciudad_id as string, 10));
      }
      
      if (req.query.barrio_id) {
        countQuery = countQuery.where('barrio_id', parseInt(req.query.barrio_id as string, 10));
      }
      
      if (req.query.tipo_inmueble_id) {
        countQuery = countQuery.where('tipo_inmueble_id', parseInt(req.query.tipo_inmueble_id as string, 10));
      }
      
      if (req.query.uso_id) {
        countQuery = countQuery.where('uso_id', parseInt(req.query.uso_id as string, 10));
      }
      
      if (req.query.estado_actual_id) {
        countQuery = countQuery.where('estado_actual_id', parseInt(req.query.estado_actual_id as string, 10));
      }
      
      if (req.query.area_min) {
        countQuery = countQuery.where('area', '>=', parseFloat(req.query.area_min as string));
      }
      
      if (req.query.area_max) {
        countQuery = countQuery.where('area', '<=', parseFloat(req.query.area_max as string));
      }
      
      if (req.query.habitaciones_min) {
        countQuery = countQuery.where('habitaciones', '>=', parseInt(req.query.habitaciones_min as string, 10));
      }
      
      if (req.query.habitaciones_max) {
        countQuery = countQuery.where('habitaciones', '<=', parseInt(req.query.habitaciones_max as string, 10));
      }
      
      if (req.query.banos_min) {
        countQuery = countQuery.where('banos', '>=', parseInt(req.query.banos_min as string, 10));
      }
      
      if (req.query.banos_max) {
        countQuery = countQuery.where('banos', '<=', parseInt(req.query.banos_max as string, 10));
      }
      
      if (req.query.garajes_min) {
        countQuery = countQuery.where('garajes', '>=', parseInt(req.query.garajes_min as string, 10));
      }
      
      if (req.query.garajes_max) {
        countQuery = countQuery.where('garajes', '<=', parseInt(req.query.garajes_max as string, 10));
      }
      
      if (req.query.estrato_min) {
        countQuery = countQuery.where('estrato', '>=', parseInt(req.query.estrato_min as string, 10));
      }
      
      if (req.query.estrato_max) {
        countQuery = countQuery.where('estrato', '<=', parseInt(req.query.estrato_max as string, 10));
      }
      
      if (req.query.precio_venta_min) {
        countQuery = countQuery.where('precio_venta', '>=', parseFloat(req.query.precio_venta_min as string));
      }
      
      if (req.query.precio_venta_max) {
        countQuery = countQuery.where('precio_venta', '<=', parseFloat(req.query.precio_venta_max as string));
      }
      
      if (req.query.precio_canon_min) {
        countQuery = countQuery.where('precio_canon', '>=', parseFloat(req.query.precio_canon_min as string));
      }
      
      if (req.query.precio_canon_max) {
        countQuery = countQuery.where('precio_canon', '<=', parseFloat(req.query.precio_canon_max as string));
      }
      
      if (req.query.activo !== undefined) {
        const activo = req.query.activo === 'true';
        countQuery = countQuery.where('activo', activo);
      } else {
        countQuery = countQuery.where('activo', true);
      }
      
      const [{ count }] = await countQuery;
      
      // Get characteristics for each property
      for (const property of properties) {
        // Get images
        const images = await knex('imagenes')
          .where('inmueble_id', property.id)
          .orderBy('es_principal', 'desc')
          .orderBy('orden', 'asc');
        
        property.imagenes = images.map(img => {
          const nombreArchivo = img.ruta_local ? path.basename(img.ruta_local) : `${img.orden || 0}.jpg`;
          
          return {
            id: img.id,
            url: `/api/inmuebles/images/${property.id}/${nombreArchivo}`,
            url_original: img.url_original,
            es_principal: img.es_principal === 1
          };
        });
        
        // Get characteristics
        const caracteristicas = await knex('inmueble_caracteristicas')
          .select(
            'inmueble_caracteristicas.id',
            'inmueble_caracteristicas.caracteristica_id',
            'inmueble_caracteristicas.valor',
            'caracteristicas.nombre'
          )
          .join('caracteristicas', 'inmueble_caracteristicas.caracteristica_id', 'caracteristicas.id')
          .where('inmueble_caracteristicas.inmueble_id', property.id);
        
        property.caracteristicas = caracteristicas.map(c => ({
          id: c.id,
          nombre: c.nombre,
          valor: c.valor
        }));
      }
      
      res.json({
        total: count,
        page,
        limit,
        data: properties
      });
    } catch (error) {
      console.error(`Error getting properties with characteristics: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting properties', details: (error as Error).message });
    }
  });
  
  /**
   * @route GET /api/inmuebles-caracteristicas/:id
   * @desc Get a property by ID with its characteristics
   * @access Public
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const propertyId = parseInt(req.params.id, 10);
      
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: 'Invalid property ID' });
      }
      
      // Get property
      const property = await knex('inmuebles')
        .where('id', propertyId)
        .first();
      
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
      
      // Get images
      const images = await knex('imagenes')
        .where('inmueble_id', propertyId)
        .orderBy('es_principal', 'desc')
        .orderBy('orden', 'asc');
      
      property.imagenes = images.map(img => {
        const nombreArchivo = img.ruta_local ? path.basename(img.ruta_local) : `${img.orden || 0}.jpg`;
        
        return {
          id: img.id,
          url: `/api/inmuebles/images/${propertyId}/${nombreArchivo}`,
          url_original: img.url_original,
          es_principal: img.es_principal === 1
        };
      });
      
      // Get characteristics
      const caracteristicas = await knex('inmueble_caracteristicas')
        .select(
          'inmueble_caracteristicas.id',
          'inmueble_caracteristicas.caracteristica_id',
          'inmueble_caracteristicas.valor',
          'caracteristicas.nombre'
        )
        .join('caracteristicas', 'inmueble_caracteristicas.caracteristica_id', 'caracteristicas.id')
        .where('inmueble_caracteristicas.inmueble_id', propertyId);
      
      property.caracteristicas = caracteristicas.map(c => ({
        id: c.id,
        nombre: c.nombre,
        valor: c.valor
      }));
      
      res.json(property);
    } catch (error) {
      console.error(`Error getting property with characteristics: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting property', details: (error as Error).message });
    }
  });
  
  /**
   * @route GET /api/inmuebles-caracteristicas/ref/:ref
   * @desc Get a property by reference number with its characteristics
   * @access Public
   */
  router.get('/ref/:ref', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const ref = parseInt(req.params.ref, 10);
      
      if (isNaN(ref)) {
        return res.status(400).json({ error: 'Invalid reference number' });
      }
      
      // Get property
      const property = await knex('inmuebles')
        .where('ref', ref)
        .first();
      
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
      
      // Get images
      const images = await knex('imagenes')
        .where('inmueble_id', property.id)
        .orderBy('es_principal', 'desc')
        .orderBy('orden', 'asc');
      
      property.imagenes = images.map(img => {
        const nombreArchivo = img.ruta_local ? path.basename(img.ruta_local) : `${img.orden || 0}.jpg`;
        
        return {
          id: img.id,
          url: `/api/inmuebles/images/${property.id}/${nombreArchivo}`,
          url_original: img.url_original,
          es_principal: img.es_principal === 1
        };
      });
      
      // Get characteristics
      const caracteristicas = await knex('inmueble_caracteristicas')
        .select(
          'inmueble_caracteristicas.id',
          'inmueble_caracteristicas.caracteristica_id',
          'inmueble_caracteristicas.valor',
          'caracteristicas.nombre'
        )
        .join('caracteristicas', 'inmueble_caracteristicas.caracteristica_id', 'caracteristicas.id')
        .where('inmueble_caracteristicas.inmueble_id', property.id);
      
      property.caracteristicas = caracteristicas.map(c => ({
        id: c.id,
        nombre: c.nombre,
        valor: c.valor
      }));
      
      res.json(property);
    } catch (error) {
      console.error(`Error getting property with characteristics: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting property', details: (error as Error).message });
    }
  });
  
  return router;
}
