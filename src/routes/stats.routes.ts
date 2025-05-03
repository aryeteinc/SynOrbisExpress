/**
 * Statistics and reports routes
 */
import express, { Request, Response } from 'express';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { authenticateJWT, authorize } from '../middlewares/auth.middleware';
import { AuthService } from '../services/AuthService';

export default function createStatsRouter(dbConnection: DatabaseConnection, authService: AuthService) {
  const router = express.Router();

  /**
   * @route GET /api/stats/dashboard
   * @desc Get dashboard statistics
   * @access Private (Admin only)
   */
  router.get('/dashboard', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Get total properties count
      const [totalProperties] = await knex('inmuebles').count('id as count');
      
      // Get active properties count
      const [activeProperties] = await knex('inmuebles').where('activo', true).count('id as count');
      
      // Get properties by type
      const propertiesByType = await knex('inmuebles')
        .select('tipos_inmueble.nombre as tipo')
        .count('inmuebles.id as count')
        .leftJoin('tipos_inmueble', 'inmuebles.tipo_inmueble_id', 'tipos_inmueble.id')
        .where('inmuebles.activo', true)
        .groupBy('tipos_inmueble.nombre')
        .orderBy('count', 'desc');
      
      // Get properties by city
      const propertiesByCity = await knex('inmuebles')
        .select('ciudades.nombre as ciudad')
        .count('inmuebles.id as count')
        .leftJoin('ciudades', 'inmuebles.ciudad_id', 'ciudades.id')
        .where('inmuebles.activo', true)
        .groupBy('ciudades.nombre')
        .orderBy('count', 'desc');
      
      // Get properties by agent
      const propertiesByAgent = await knex('inmuebles')
        .select(
          'asesores.id as id',
          'asesores.nombre as nombre',
          'asesores.apellido as apellido'
        )
        .count('inmuebles.id as count')
        .leftJoin('asesores', 'inmuebles.asesor_id', 'asesores.id')
        .where('inmuebles.activo', true)
        .groupBy('asesores.id', 'asesores.nombre', 'asesores.apellido')
        .orderBy('count', 'desc');
      
      // Get total images count
      const [totalImages] = await knex('imagenes').count('id as count');
      
      // Get total agents count
      const [totalAgents] = await knex('asesores').count('id as count');
      
      // Get recent synchronizations
      const recentSyncs = await knex('ejecuciones')
        .select('*')
        .orderBy('fecha_inicio', 'desc')
        .limit(5);
      
      res.json({
        success: true,
        data: {
          total_inmuebles: totalProperties.count,
          inmuebles_activos: activeProperties.count,
          inmuebles_por_tipo: propertiesByType,
          inmuebles_por_ciudad: propertiesByCity,
          inmuebles_por_asesor: propertiesByAgent,
          total_imagenes: totalImages.count,
          total_asesores: totalAgents.count,
          sincronizaciones_recientes: recentSyncs
        }
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({ success: false, message: 'Error getting dashboard statistics', error });
    }
  });

  /**
   * @route GET /api/stats/properties
   * @desc Get property statistics
   * @access Private (Admin only)
   */
  router.get('/properties', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Get price statistics
      const priceStats = await knex('inmuebles')
        .where('activo', true)
        .whereNot('precio_venta', 0)
        .select(
          knex.raw('MIN(precio_venta) as min_precio_venta'),
          knex.raw('MAX(precio_venta) as max_precio_venta'),
          knex.raw('AVG(precio_venta) as avg_precio_venta'),
          knex.raw('MIN(precio_canon) as min_precio_canon'),
          knex.raw('MAX(precio_canon) as max_precio_canon'),
          knex.raw('AVG(precio_canon) as avg_precio_canon')
        )
        .first();
      
      // Get area statistics
      const areaStats = await knex('inmuebles')
        .where('activo', true)
        .select(
          knex.raw('MIN(area) as min_area'),
          knex.raw('MAX(area) as max_area'),
          knex.raw('AVG(area) as avg_area')
        )
        .first();
      
      // Get properties by use
      const propertiesByUse = await knex('inmuebles')
        .select('usos_inmueble.nombre as uso')
        .count('inmuebles.id as count')
        .leftJoin('usos_inmueble', 'inmuebles.uso_id', 'usos_inmueble.id')
        .where('inmuebles.activo', true)
        .groupBy('usos_inmueble.nombre')
        .orderBy('count', 'desc');
      
      // Get properties by state
      const propertiesByState = await knex('inmuebles')
        .select('estados_inmueble.nombre as estado')
        .count('inmuebles.id as count')
        .leftJoin('estados_inmueble', 'inmuebles.estado_actual_id', 'estados_inmueble.id')
        .where('inmuebles.activo', true)
        .groupBy('estados_inmueble.nombre')
        .orderBy('count', 'desc');
      
      // Get properties by stratum
      const propertiesByStratum = await knex('inmuebles')
        .select('estrato')
        .count('id as count')
        .where('activo', true)
        .whereNot('estrato', 0)
        .groupBy('estrato')
        .orderBy('estrato', 'asc');
      
      res.json({
        success: true,
        data: {
          precio_stats: priceStats,
          area_stats: areaStats,
          inmuebles_por_uso: propertiesByUse,
          inmuebles_por_estado: propertiesByState,
          inmuebles_por_estrato: propertiesByStratum
        }
      });
    } catch (error) {
      console.error('Error getting property stats:', error);
      res.status(500).json({ success: false, message: 'Error getting property statistics', error });
    }
  });

  /**
   * @route GET /api/stats/sync-history
   * @desc Get synchronization history
   * @access Private (Admin only)
   */
  router.get('/sync-history', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Get synchronization history
      const syncHistory = await knex('ejecuciones')
        .select('*')
        .orderBy('fecha_inicio', 'desc')
        .limit(req.query.limit ? parseInt(req.query.limit as string, 10) : 20);
      
      // Get total count
      const [totalCount] = await knex('ejecuciones').count('id as count');
      
      res.json({
        success: true,
        total: totalCount.count,
        data: syncHistory
      });
    } catch (error) {
      console.error('Error getting sync history:', error);
      res.status(500).json({ success: false, message: 'Error getting synchronization history', error });
    }
  });

  /**
   * @route GET /api/stats/change-history
   * @desc Get property change history
   * @access Private (Admin only)
   */
  router.get('/change-history', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      
      // Build query
      let query = knex('historial_cambios')
        .select(
          'historial_cambios.*',
          'inmuebles.ref as inmueble_ref',
          'ejecuciones.fecha_inicio as ejecucion_fecha'
        )
        .leftJoin('inmuebles', 'historial_cambios.inmueble_id', 'inmuebles.id')
        .leftJoin('ejecuciones', 'historial_cambios.ejecucion_id', 'ejecuciones.id')
        .orderBy('historial_cambios.fecha', 'desc');
      
      // Filter by property ID if provided
      if (req.query.inmueble_id) {
        const inmuebleId = parseInt(req.query.inmueble_id as string, 10);
        query = query.where('historial_cambios.inmueble_id', inmuebleId);
      }
      
      // Filter by execution ID if provided
      if (req.query.ejecucion_id) {
        const ejecucionId = parseInt(req.query.ejecucion_id as string, 10);
        query = query.where('historial_cambios.ejecucion_id', ejecucionId);
      }
      
      // Filter by change type if provided
      if (req.query.tipo_cambio) {
        query = query.where('historial_cambios.tipo_cambio', req.query.tipo_cambio);
      }
      
      // Apply pagination
      const changes = await query.limit(limit).offset(offset);
      
      // Get total count
      const [totalCount] = await knex('historial_cambios').count('id as count');
      
      res.json({
        success: true,
        total: totalCount.count,
        data: changes
      });
    } catch (error) {
      console.error('Error getting change history:', error);
      res.status(500).json({ success: false, message: 'Error getting change history', error });
    }
  });

  return router;
}
