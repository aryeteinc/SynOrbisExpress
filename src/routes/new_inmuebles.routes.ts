/**
 * Property routes
 */
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { InmuebleManager } from '../services/InmuebleManager';
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
          'usos.nombre as uso',
          'estados.nombre as estado_actual'
        )
        .leftJoin('tipos_inmueble', 'inmuebles.tipo_inmueble_id', 'tipos_inmueble.id')
        .leftJoin('usos', 'inmuebles.uso_id', 'usos.id')
        .leftJoin('estados', 'inmuebles.estado_actual_id', 'estados.id');
      
      // Apply filters
      if (filters.ref) query = query.where('inmuebles.ref', filters.ref);
      if (filters.codigo_consignacion) query = query.where('inmuebles.codigo_consignacion', filters.codigo_consignacion);
      if (filters.ciudad) query = query.where('inmuebles.ciudad', 'like', `%${filters.ciudad}%`);
      if (filters.barrio) query = query.where('inmuebles.barrio', 'like', `%${filters.barrio}%`);
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
      if (filters.ref) countQuery.where('ref', filters.ref);
      if (filters.codigo_consignacion) countQuery.where('codigo_consignacion', filters.codigo_consignacion);
      if (filters.ciudad) countQuery.where('ciudad', 'like', `%${filters.ciudad}%`);
      if (filters.barrio) countQuery.where('barrio', 'like', `%${filters.barrio}%`);
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
      
      // Get images for each property
      for (const property of properties) {
        const images = await knex('imagenes')
          .where('inmueble_id', property.id)
          .orderBy('es_principal', 'desc')
          .orderBy('orden', 'asc');
        
        property.imagenes = images.map(img => ({
          id: img.id,
          url: `/api/inmuebles/images/${property.id}/${img.nombre_archivo}`,
          es_principal: img.es_principal === 1
        }));
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

  return router;
}
