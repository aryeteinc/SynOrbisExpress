/**
 * Property routes
 */
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { InmuebleManager } from '../services/InmuebleManager';
import { SyncHelper } from '../services/SyncHelper';
import { QueryFilters, ApiFilters, RequestWithUser } from '../models/types';
import { authenticateJWT, authorize } from '../middlewares/auth.middleware';
import { AuthService } from '../services/AuthService';
import config from '../config/config';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const propertyId = req.params.id;
    const uploadDir = path.join(config.imagesFolder, propertyId);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

/**
 * Create router with database and auth service
 * @param dbConnection Database connection
 * @param authService Authentication service
 * @returns Express router
 */
export default function createInmueblesRouter(dbConnection: DatabaseConnection, authService: AuthService) {
  const router = express.Router();
  
  // Initialize property manager
  const inmuebleManager = new InmuebleManager(dbConnection);
  
  // Initialize sync helper
  const syncHelper = new SyncHelper(dbConnection);

  /**
   * @route GET /api/inmuebles
   * @desc Get all properties with filters
   * @access Public
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const filters: QueryFilters = {};
      
      // Apply filters from query parameters
      if (req.query.ref) {
        filters.ref = parseInt(req.query.ref as string, 10);
      }
      
      if (req.query.codigo_consignacion) {
        filters.codigo_consignacion = req.query.codigo_consignacion as string;
      }
      
      if (req.query.codigo_sincronizacion) {
        filters.codigo_sincronizacion = req.query.codigo_sincronizacion as string;
      }
      
      if (req.query.ciudad) {
        filters.ciudad = req.query.ciudad as string;
      }
      
      if (req.query.barrio) {
        filters.barrio = req.query.barrio as string;
      }
      
      if (req.query.tipo_inmueble_id) {
        filters.tipo_inmueble_id = parseInt(req.query.tipo_inmueble_id as string, 10);
      }
      
      if (req.query.uso_id) {
        filters.uso_id = parseInt(req.query.uso_id as string, 10);
      }
      
      if (req.query.estado_actual_id) {
        filters.estado_actual_id = parseInt(req.query.estado_actual_id as string, 10);
      }
      
      if (req.query.area_min) {
        filters.area_min = parseFloat(req.query.area_min as string);
      }
      
      if (req.query.area_max) {
        filters.area_max = parseFloat(req.query.area_max as string);
      }
      
      if (req.query.precio_venta_min) {
        filters.precio_venta_min = parseFloat(req.query.precio_venta_min as string);
      }
      
      if (req.query.precio_venta_max) {
        filters.precio_venta_max = parseFloat(req.query.precio_venta_max as string);
      }
      
      if (req.query.precio_canon_min) {
        filters.precio_canon_min = parseFloat(req.query.precio_canon_min as string);
      }
      
      if (req.query.precio_canon_max) {
        filters.precio_canon_max = parseFloat(req.query.precio_canon_max as string);
      }
      
      if (req.query.habitaciones_min) {
        filters.habitaciones_min = parseInt(req.query.habitaciones_min as string, 10);
      }
      
      if (req.query.banos_min) {
        filters.banos_min = parseInt(req.query.banos_min as string, 10);
      }
      
      if (req.query.garajes_min) {
        filters.garajes_min = parseInt(req.query.garajes_min as string, 10);
      }
      
      if (req.query.estrato_min) {
        filters.estrato_min = parseInt(req.query.estrato_min as string, 10);
      }
      
      if (req.query.estrato_max) {
        filters.estrato_max = parseInt(req.query.estrato_max as string, 10);
      }
      
      if (req.query.activo !== undefined) {
        filters.activo = req.query.activo === 'true';
      }
      
      if (req.query.ordenar_por) {
        filters.ordenar_por = req.query.ordenar_por as string;
      }
      
      if (req.query.orden) {
        filters.orden = req.query.orden as 'asc' | 'desc';
      }
      
      if (req.query.limite) {
        filters.limite = parseInt(req.query.limite as string, 10);
      }
      
      if (req.query.offset) {
        filters.offset = parseInt(req.query.offset as string, 10);
      }
      
      // Build query
      let query = knex('inmuebles')
        .select(
          'inmuebles.*',
          'tipos_inmueble.nombre as tipo_inmueble',
          'usos_inmueble.nombre as uso',
          'estados_inmueble.nombre as estado_actual',
          'ciudades.nombre as ciudad',
          'barrios.nombre as barrio',
          'asesores.nombre as asesor_nombre',
          'asesores.apellido as asesor_apellido',
          'asesores.id as asesor_id'
        )
        .leftJoin('tipos_inmueble', 'inmuebles.tipo_inmueble_id', 'tipos_inmueble.id')
        .leftJoin('usos_inmueble', 'inmuebles.uso_id', 'usos_inmueble.id')
        .leftJoin('estados_inmueble', 'inmuebles.estado_actual_id', 'estados_inmueble.id')
        .leftJoin('ciudades', 'inmuebles.ciudad_id', 'ciudades.id')
        .leftJoin('barrios', 'inmuebles.barrio_id', 'barrios.id')
        .leftJoin('asesores', 'inmuebles.asesor_id', 'asesores.id');
      
      // Apply filters
      if (filters.ref) query = query.where('inmuebles.ref', filters.ref);
      if (filters.codigo_consignacion) query = query.where('inmuebles.codigo_consignacion', filters.codigo_consignacion);
      if (filters.codigo_sincronizacion) query = query.where('inmuebles.codigo_sincronizacion', filters.codigo_sincronizacion);
      if (filters.ciudad) {
        // Buscar en la tabla ciudades usando el join que ya tenemos
        query = query.where('ciudades.nombre', 'like', `%${filters.ciudad}%`);
      }
      if (filters.barrio) {
        // Buscar en la tabla barrios usando el join que ya tenemos
        query = query.where('barrios.nombre', 'like', `%${filters.barrio}%`);
      }
      if (filters.tipo_inmueble_id) query = query.where('inmuebles.tipo_inmueble_id', filters.tipo_inmueble_id);
      if (filters.uso_id) query = query.where('inmuebles.uso_id', filters.uso_id);
      if (filters.estado_actual_id) query = query.where('inmuebles.estado_actual_id', filters.estado_actual_id);
      
      if (filters.area_min) query = query.where('inmuebles.area', '>=', filters.area_min);
      if (filters.area_max) query = query.where('inmuebles.area', '<=', filters.area_max);
      
      if (filters.precio_venta_min) query = query.where('inmuebles.precio_venta', '>=', filters.precio_venta_min);
      if (filters.precio_venta_max) query = query.where('inmuebles.precio_venta', '<=', filters.precio_venta_max);
      
      if (filters.precio_canon_min) query = query.where('inmuebles.precio_canon', '>=', filters.precio_canon_min);
      if (filters.precio_canon_max) query = query.where('inmuebles.precio_canon', '<=', filters.precio_canon_max);
      
      if (filters.habitaciones_min) query = query.where('inmuebles.habitaciones', '>=', filters.habitaciones_min);
      if (filters.banos_min) query = query.where('inmuebles.banos', '>=', filters.banos_min);
      if (filters.garajes_min) query = query.where('inmuebles.garajes', '>=', filters.garajes_min);
      
      if (filters.estrato_min) query = query.where('inmuebles.estrato', '>=', filters.estrato_min);
      if (filters.estrato_max) query = query.where('inmuebles.estrato', '<=', filters.estrato_max);
      
      if (filters.activo !== undefined) query = query.where('inmuebles.activo', filters.activo);
      
      // Apply sorting
      if (filters.ordenar_por) {
        const orden = filters.orden || 'asc';
        query = query.orderBy(`inmuebles.${filters.ordenar_por}`, orden);
      } else {
        query = query.orderBy('inmuebles.id', 'desc');
      }
      
      // Apply pagination
      if (filters.limite) {
        query = query.limit(filters.limite);
        
        if (filters.offset) {
          query = query.offset(filters.offset);
        }
      }
      
      // Execute query
      const properties = await query;
      
      // Get total count without pagination
      const countQuery = knex('inmuebles').count('* as count');
      
      // Apply the same filters to count query
      // Necesitamos hacer los mismos joins para la consulta de conteo
      countQuery.leftJoin('ciudades', 'inmuebles.ciudad_id', 'ciudades.id')
               .leftJoin('barrios', 'inmuebles.barrio_id', 'barrios.id');
      
      if (filters.ref) countQuery.where('inmuebles.ref', filters.ref);
      if (filters.codigo_consignacion) countQuery.where('inmuebles.codigo_consignacion', filters.codigo_consignacion);
      if (filters.ciudad) countQuery.where('ciudades.nombre', 'like', `%${filters.ciudad}%`);
      if (filters.barrio) countQuery.where('barrios.nombre', 'like', `%${filters.barrio}%`);
      if (filters.tipo_inmueble_id) countQuery.where('tipo_inmueble_id', filters.tipo_inmueble_id);
      if (filters.uso_id) countQuery.where('uso_id', filters.uso_id);
      if (filters.estado_actual_id) countQuery.where('estado_actual_id', filters.estado_actual_id);
      
      if (filters.area_min) countQuery.where('area', '>=', filters.area_min);
      if (filters.area_max) countQuery.where('area', '<=', filters.area_max);
      
      if (filters.precio_venta_min) countQuery.where('precio_venta', '>=', filters.precio_venta_min);
      if (filters.precio_venta_max) countQuery.where('precio_venta', '<=', filters.precio_venta_max);
      
      if (filters.precio_canon_min) countQuery.where('precio_canon', '>=', filters.precio_canon_min);
      if (filters.precio_canon_max) countQuery.where('precio_canon', '<=', filters.precio_canon_max);
      
      if (filters.habitaciones_min) countQuery.where('habitaciones', '>=', filters.habitaciones_min);
      if (filters.banos_min) countQuery.where('banos', '>=', filters.banos_min);
      if (filters.garajes_min) countQuery.where('garajes', '>=', filters.garajes_min);
      
      if (filters.estrato_min) countQuery.where('estrato', '>=', filters.estrato_min);
      if (filters.estrato_max) countQuery.where('estrato', '<=', filters.estrato_max);
      
      if (filters.activo !== undefined) countQuery.where('activo', filters.activo);
      
      const [{ count }] = await countQuery;
      
      // Get images and characteristics for each property
      for (const property of properties) {
        // Get images
        const images = await knex('imagenes')
          .where('inmueble_id', property.id)
          .orderBy('es_principal', 'desc')
          .orderBy('orden', 'asc');
        
        property.imagenes = images.map(img => {
          // Extraer el nombre del archivo de la ruta local
          const nombreArchivo = img.ruta_local ? path.basename(img.ruta_local) : `${img.orden || 0}.jpg`;
          
          return {
            id: img.id,
            url: `/api/inmuebles/images/${property.id}/${nombreArchivo}`,
            url_original: img.url_original,
            ancho: img.ancho || 0,
            alto: img.alto || 0,
            tamano_bytes: img.tamano_bytes || 0,
            es_principal: img.es_principal === 1
          };
        });
        
        // Get characteristics with their values
        const characteristics = await knex('caracteristicas')
          .select(
            'caracteristicas.*',
            'inmueble_caracteristicas.valor'
          )
          .join('inmueble_caracteristicas', 'caracteristicas.id', 'inmueble_caracteristicas.caracteristica_id')
          .where('inmueble_caracteristicas.inmueble_id', property.id);
        
        // Format characteristics with their values
        property.caracteristicas = characteristics.map(c => {
          let valor = c.valor;
          
          // Convertir el valor según el tipo de característica
          if (c.tipo === 'booleano') {
            valor = valor === '1' || valor === 'true' || valor === true;
          } else if (c.tipo === 'numerico' && valor !== null) {
            const numVal = parseFloat(valor);
            valor = isNaN(numVal) ? valor : numVal;
          }
          
          return {
            id: c.id,
            nombre: c.nombre,
            tipo: c.tipo,
            unidad: c.unidad,
            valor: valor
          };
        });
      }
      
      res.json({
        total: count,
        page: filters.offset ? Math.floor(filters.offset / (filters.limite || 10)) + 1 : 1,
        limit: filters.limite || null,
        data: properties
      });
    } catch (error) {
      console.error(`Error getting properties: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting properties', details: (error as Error).message });
    }
  });

  /**
   * @route GET /api/inmuebles/:id
   * @desc Get a property by ID with all details
   * @access Public
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const propertyId = parseInt(req.params.id, 10);
      
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: 'Invalid property ID' });
      }
      
      // Get property with related data
      const property = await knex('inmuebles')
        .select(
          'inmuebles.*',
          'tipos_inmueble.nombre as tipo_inmueble',
          'usos_inmueble.nombre as uso',
          'estados_inmueble.nombre as estado_actual',
          'ciudades.nombre as ciudad',
          'barrios.nombre as barrio',
          'asesores.id as asesor_id',
          'asesores.nombre as asesor_nombre',
          'asesores.apellido as asesor_apellido'
        )
        .leftJoin('tipos_inmueble', 'inmuebles.tipo_inmueble_id', 'tipos_inmueble.id')
        .leftJoin('usos_inmueble', 'inmuebles.uso_id', 'usos_inmueble.id')
        .leftJoin('estados_inmueble', 'inmuebles.estado_actual_id', 'estados_inmueble.id')
        .leftJoin('ciudades', 'inmuebles.ciudad_id', 'ciudades.id')
        .leftJoin('barrios', 'inmuebles.barrio_id', 'barrios.id')
        .leftJoin('asesores', 'inmuebles.asesor_id', 'asesores.id')
        .where('inmuebles.id', propertyId)
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
        // Extraer el nombre del archivo de la ruta local
        const nombreArchivo = img.ruta_local ? path.basename(img.ruta_local) : `${img.orden || 0}.jpg`;
        
        return {
          id: img.id,
          url: `/api/inmuebles/images/${propertyId}/${nombreArchivo}`,
          url_original: img.url_original,
          ancho: img.ancho || 0,
          alto: img.alto || 0,
          tamano_bytes: img.tamano_bytes || 0,
          es_principal: img.es_principal === 1
        };
      });
      
      // Get characteristics with their values
      const characteristics = await knex('caracteristicas')
        .select(
          'caracteristicas.*',
          'inmueble_caracteristicas.valor'
        )
        .join('inmueble_caracteristicas', 'caracteristicas.id', 'inmueble_caracteristicas.caracteristica_id')
        .where('inmueble_caracteristicas.inmueble_id', propertyId);
      
      // Format characteristics with their values
      property.caracteristicas = characteristics.map(c => {
        let valor = c.valor;
        
        // Convertir el valor según el tipo de característica
        if (c.tipo === 'booleano') {
          valor = valor === '1' || valor === 'true' || valor === true;
        } else if (c.tipo === 'numerico' && valor !== null) {
          const numVal = parseFloat(valor);
          valor = isNaN(numVal) ? valor : numVal;
        }
        
        return {
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          unidad: c.unidad,
          valor: valor
        };
      });
      
      // Get change history
      const changes = await knex('historial_cambios')
        .where('inmueble_id', propertyId)
        .orderBy('fecha_cambio', 'desc')
        .limit(20);
      
      property.historial_cambios = changes;
      
      res.json({
        success: true,
        data: property
      });
    } catch (error) {
      console.error(`Error getting property: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting property', details: (error as Error).message });
    }
  });
  
  /**
   * @route POST /api/inmuebles/update-principal-images
   * @desc Update all images with orden=0 to have es_principal=1
   * @access Public
   */
  router.post('/update-principal-images', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Actualizar todas las imágenes con orden = 0 para que tengan es_principal = 1
      const updated = await knex('imagenes')
        .where('orden', 0)
        .update({ es_principal: 1 });
      
      return res.json({
        success: true,
        message: `Actualizadas ${updated} imágenes principales (orden = 0)`
      });
    } catch (error) {
      console.error(`Error actualizando imágenes principales: ${(error as Error).message}`);
      return res.status(500).json({
        success: false,
        error: 'Error actualizando imágenes principales'
      });
    }
  });

  /**
   * @route POST /api/inmuebles/sync
   * @desc Synchronize properties from the API
   * @access Public
   */
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const filters: ApiFilters = req.body.filtros || {};
      const options = {
        downloadImages: req.body.descargar_imagenes !== false,
        trackChanges: req.body.registrar_cambios !== false,
        markInactive: req.body.marcar_inactivos === true,
        limit: req.body.limite ? parseInt(req.body.limite, 10) : undefined
      };
      
      // Reset statistics
      inmuebleManager.resetStatistics();
      
      // Get properties from the API
      const properties = await inmuebleManager.obtenerDatosApi(undefined, filters);
      
      if (!properties || properties.length === 0) {
        return res.status(404).json({ error: 'No properties found in the API' });
      }
      
      // Apply limit if specified
      const propertiesToProcess = options.limit ? properties.slice(0, options.limit) : properties;
      
      // Process each property
      const activeRefs: string[] = [];
      for (const property of propertiesToProcess) {
        await inmuebleManager.procesarInmueble(property, options.downloadImages, options.trackChanges);
        activeRefs.push(String(property.ref));
      }
      
      // Mark inactive properties if requested
      let inactiveCount = 0;
      if (options.markInactive) {
        inactiveCount = await syncHelper.marcarInactivosNoPresentes(activeRefs);
      }
      
      // Get statistics
      const stats = inmuebleManager.getStatistics();
      
      // Record the execution
      await syncHelper.registrarEjecucion(stats, JSON.stringify({
        filters,
        options,
        inactiveCount
      }));
      
      // Return the results
      res.json({
        success: true,
        message: 'Synchronization completed successfully',
        stats: {
          ...stats,
          inactiveCount
        }
      });
    } catch (error) {
      console.error(`Error synchronizing properties: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error synchronizing properties', details: (error as Error).message });
    }
  });

  /**
   * @route GET /api/inmuebles/stats
   * @desc Get synchronization statistics
   * @access Private
   */
  router.get('/stats', authenticateJWT(authService), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Get the latest execution
      const latestExecution = await knex('ejecuciones')
        .orderBy('fecha', 'desc')
        .first();
      
      if (!latestExecution) {
        return res.status(404).json({ error: 'No synchronization executions found' });
      }
      
      // Get database statistics
      const inmueblesCount = await knex('inmuebles').count('* as count').first();
      const imagenesCount = await knex('imagenes').count('* as count').first();
      const caracteristicasCount = await knex('caracteristicas').count('* as count').first();
      const inmuebleCaracteristicasCount = await knex('inmueble_caracteristicas').count('* as count').first();
      const historialCambiosCount = await knex('historial_cambios').count('* as count').first();
      const ejecucionesCount = await knex('ejecuciones').count('* as count').first();
      
      // Get active/inactive properties count
      const activosCount = await knex('inmuebles').where('activo', true).count('* as count').first();
      const inactivosCount = await knex('inmuebles').where('activo', false).count('* as count').first();
      
      // Ensure count values are defined
      const getCount = (result: any) => result && typeof result.count !== 'undefined' ? Number(result.count) : 0;
      
      // Return statistics
      res.json({
        lastExecution: {
          date: latestExecution.fecha,
          duration: latestExecution.duracion,
          processed: latestExecution.inmuebles_procesados,
          new: latestExecution.inmuebles_nuevos,
          updated: latestExecution.inmuebles_actualizados,
          unchanged: latestExecution.inmuebles_sin_cambios,
          imagesDownloaded: latestExecution.imagenes_descargadas,
          errors: latestExecution.errores,
          parameters: JSON.parse(latestExecution.parametros || '{}')
        },
        database: {
          properties: getCount(inmueblesCount),
          images: getCount(imagenesCount),
          characteristics: getCount(caracteristicasCount),
          propertyCharacteristics: getCount(inmuebleCaracteristicasCount),
          changeHistory: getCount(historialCambiosCount),
          executions: getCount(ejecucionesCount),
          active: getCount(activosCount),
          inactive: getCount(inactivosCount)
        }
      });
    } catch (error) {
      console.error(`Error getting statistics: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting statistics', details: (error as Error).message });
    }
  });

  return router;
}
