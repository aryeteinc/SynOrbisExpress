/**
 * Características (Property characteristics) routes
 */
import express, { Request, Response } from 'express';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { authenticateJWT, authorize } from '../middlewares/auth.middleware';
import { AuthService } from '../services/AuthService';

export default function createCaracteristicasRouter(dbConnection: DatabaseConnection, authService: AuthService) {
  const router = express.Router();

  /**
   * @route GET /api/caracteristicas
   * @desc Get all property characteristics
   * @access Public
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Build query
      let query = knex('caracteristicas')
        .select('*')
        .orderBy('nombre', 'asc');
      
      // Filter by activo if specified
      if (req.query.activo !== undefined) {
        const activo = req.query.activo === 'true' || req.query.activo === '1';
        query = query.where('activo', activo);
      }
      
      const caracteristicas = await query;
      
      res.json({
        success: true,
        total: caracteristicas.length,
        data: caracteristicas
      });
    } catch (error) {
      console.error(`Error getting caracteristicas: ${(error as Error).message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener características', 
        error: (error as Error).message 
      });
    }
  });

  /**
   * @route GET /api/caracteristicas/:id
   * @desc Get characteristic by ID
   * @access Public
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const caracteristicaId = parseInt(req.params.id, 10);
      
      if (isNaN(caracteristicaId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de característica inválido' 
        });
      }
      
      const caracteristica = await knex('caracteristicas')
        .where('id', caracteristicaId)
        .first();
      
      if (!caracteristica) {
        return res.status(404).json({ 
          success: false, 
          message: 'Característica no encontrada' 
        });
      }
      
      // Get inmuebles with this characteristic
      const inmueblesCount = await knex('inmueble_caracteristicas')
        .where('caracteristica_id', caracteristicaId)
        .count('inmueble_id as count')
        .first();
      
      // Get possible values for this characteristic
      const valores = await knex('inmueble_caracteristicas')
        .select('valor')
        .where('caracteristica_id', caracteristicaId)
        .groupBy('valor')
        .orderBy('valor', 'asc');
      
      caracteristica.inmuebles_count = inmueblesCount ? inmueblesCount.count : 0;
      caracteristica.valores = valores.map(v => v.valor);
      
      res.json({
        success: true,
        data: caracteristica
      });
    } catch (error) {
      console.error(`Error getting caracteristica: ${(error as Error).message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener característica', 
        error: (error as Error).message 
      });
    }
  });

  /**
   * @route POST /api/caracteristicas
   * @desc Create a new characteristic
   * @access Admin
   */
  router.post('/', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const { nombre, descripcion, tipo, activo } = req.body;
      
      if (!nombre) {
        return res.status(400).json({ 
          success: false, 
          message: 'El nombre es requerido' 
        });
      }
      
      // Check if characteristic already exists
      const existing = await knex('caracteristicas')
        .where('nombre', nombre)
        .first();
      
      if (existing) {
        return res.status(409).json({ 
          success: false, 
          message: 'Ya existe una característica con este nombre' 
        });
      }
      
      const [id] = await knex('caracteristicas').insert({
        nombre,
        descripcion: descripcion || null,
        tipo: tipo || 'texto',
        activo: activo !== undefined ? activo : true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
      
      const newCaracteristica = await knex('caracteristicas').where('id', id).first();
      
      res.status(201).json({
        success: true,
        message: 'Característica creada correctamente',
        data: newCaracteristica
      });
    } catch (error) {
      console.error(`Error creating caracteristica: ${(error as Error).message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al crear característica', 
        error: (error as Error).message 
      });
    }
  });

  /**
   * @route PUT /api/caracteristicas/:id
   * @desc Update a characteristic
   * @access Admin
   */
  router.put('/:id', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const caracteristicaId = parseInt(req.params.id, 10);
      
      if (isNaN(caracteristicaId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de característica inválido' 
        });
      }
      
      const caracteristica = await knex('caracteristicas').where('id', caracteristicaId).first();
      
      if (!caracteristica) {
        return res.status(404).json({ 
          success: false, 
          message: 'Característica no encontrada' 
        });
      }
      
      const { nombre, descripcion, tipo, activo } = req.body;
      
      if (!nombre) {
        return res.status(400).json({ 
          success: false, 
          message: 'El nombre es requerido' 
        });
      }
      
      // Check if another characteristic has the same name
      if (nombre !== caracteristica.nombre) {
        const existing = await knex('caracteristicas')
          .where('nombre', nombre)
          .whereNot('id', caracteristicaId)
          .first();
        
        if (existing) {
          return res.status(409).json({ 
            success: false, 
            message: 'Ya existe otra característica con este nombre' 
          });
        }
      }
      
      await knex('caracteristicas')
        .where('id', caracteristicaId)
        .update({
          nombre,
          descripcion: descripcion || null,
          tipo: tipo || caracteristica.tipo,
          activo: activo !== undefined ? activo : caracteristica.activo,
          updated_at: knex.fn.now()
        });
      
      const updatedCaracteristica = await knex('caracteristicas').where('id', caracteristicaId).first();
      
      res.json({
        success: true,
        message: 'Característica actualizada correctamente',
        data: updatedCaracteristica
      });
    } catch (error) {
      console.error(`Error updating caracteristica: ${(error as Error).message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al actualizar característica', 
        error: (error as Error).message 
      });
    }
  });

  /**
   * @route DELETE /api/caracteristicas/:id
   * @desc Delete a characteristic
   * @access Admin
   */
  router.delete('/:id', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const caracteristicaId = parseInt(req.params.id, 10);
      
      if (isNaN(caracteristicaId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de característica inválido' 
        });
      }
      
      const caracteristica = await knex('caracteristicas').where('id', caracteristicaId).first();
      
      if (!caracteristica) {
        return res.status(404).json({ 
          success: false, 
          message: 'Característica no encontrada' 
        });
      }
      
      // Check if the characteristic is in use
      const inUse = await knex('inmueble_caracteristicas')
        .where('caracteristica_id', caracteristicaId)
        .first();
      
      if (inUse) {
        return res.status(409).json({ 
          success: false, 
          message: 'No se puede eliminar la característica porque está en uso' 
        });
      }
      
      await knex('caracteristicas')
        .where('id', caracteristicaId)
        .delete();
      
      res.json({
        success: true,
        message: 'Característica eliminada correctamente'
      });
    } catch (error) {
      console.error(`Error deleting caracteristica: ${(error as Error).message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al eliminar característica', 
        error: (error as Error).message 
      });
    }
  });

  /**
   * @route GET /api/caracteristicas/inmueble/:inmuebleId
   * @desc Get characteristics for a specific property
   * @access Public
   */
  router.get('/inmueble/:inmuebleId', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const inmuebleId = parseInt(req.params.inmuebleId, 10);
      
      if (isNaN(inmuebleId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de inmueble inválido' 
        });
      }
      
      // Check if property exists
      const inmueble = await knex('inmuebles').where('id', inmuebleId).first();
      
      if (!inmueble) {
        return res.status(404).json({ 
          success: false, 
          message: 'Inmueble no encontrado' 
        });
      }
      
      // Get characteristics for this property
      const caracteristicas = await knex('inmueble_caracteristicas')
        .select(
          'inmueble_caracteristicas.caracteristica_id',
          'inmueble_caracteristicas.valor',
          'caracteristicas.nombre',
          'caracteristicas.descripcion',
          'caracteristicas.tipo'
        )
        .leftJoin('caracteristicas', 'inmueble_caracteristicas.caracteristica_id', 'caracteristicas.id')
        .where('inmueble_caracteristicas.inmueble_id', inmuebleId)
        .orderBy('caracteristicas.nombre', 'asc');
      
      res.json({
        success: true,
        total: caracteristicas.length,
        data: caracteristicas
      });
    } catch (error) {
      console.error(`Error getting property characteristics: ${(error as Error).message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener características del inmueble', 
        error: (error as Error).message 
      });
    }
  });

  /**
   * @route POST /api/caracteristicas/inmueble/:inmuebleId
   * @desc Add or update a characteristic for a property
   * @access Admin
   */
  router.post('/inmueble/:inmuebleId', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const inmuebleId = parseInt(req.params.inmuebleId, 10);
      
      if (isNaN(inmuebleId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de inmueble inválido' 
        });
      }
      
      // Check if property exists
      const inmueble = await knex('inmuebles').where('id', inmuebleId).first();
      
      if (!inmueble) {
        return res.status(404).json({ 
          success: false, 
          message: 'Inmueble no encontrado' 
        });
      }
      
      const { caracteristica_id, valor } = req.body;
      
      if (!caracteristica_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'El ID de característica es requerido' 
        });
      }
      
      if (valor === undefined || valor === null) {
        return res.status(400).json({ 
          success: false, 
          message: 'El valor es requerido' 
        });
      }
      
      // Check if characteristic exists
      const caracteristica = await knex('caracteristicas').where('id', caracteristica_id).first();
      
      if (!caracteristica) {
        return res.status(404).json({ 
          success: false, 
          message: 'Característica no encontrada' 
        });
      }
      
      // Check if the property already has this characteristic
      const existing = await knex('inmueble_caracteristicas')
        .where({
          inmueble_id: inmuebleId,
          caracteristica_id
        })
        .first();
      
      if (existing) {
        // Update existing
        await knex('inmueble_caracteristicas')
          .where({
            inmueble_id: inmuebleId,
            caracteristica_id
          })
          .update({
            valor: valor.toString(),
            updated_at: knex.fn.now()
          });
        
        res.json({
          success: true,
          message: 'Característica actualizada correctamente',
          data: {
            inmueble_id: inmuebleId,
            caracteristica_id,
            valor: valor.toString(),
            nombre: caracteristica.nombre
          }
        });
      } else {
        // Create new
        await knex('inmueble_caracteristicas').insert({
          inmueble_id: inmuebleId,
          caracteristica_id,
          valor: valor.toString(),
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });
        
        res.status(201).json({
          success: true,
          message: 'Característica agregada correctamente',
          data: {
            inmueble_id: inmuebleId,
            caracteristica_id,
            valor: valor.toString(),
            nombre: caracteristica.nombre
          }
        });
      }
    } catch (error) {
      console.error(`Error adding/updating property characteristic: ${(error as Error).message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al agregar/actualizar característica del inmueble', 
        error: (error as Error).message 
      });
    }
  });

  /**
   * @route DELETE /api/caracteristicas/inmueble/:inmuebleId/:caracteristicaId
   * @desc Remove a characteristic from a property
   * @access Admin
   */
  router.delete('/inmueble/:inmuebleId/:caracteristicaId', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const inmuebleId = parseInt(req.params.inmuebleId, 10);
      const caracteristicaId = parseInt(req.params.caracteristicaId, 10);
      
      if (isNaN(inmuebleId) || isNaN(caracteristicaId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'IDs inválidos' 
        });
      }
      
      // Check if the property has this characteristic
      const existing = await knex('inmueble_caracteristicas')
        .where({
          inmueble_id: inmuebleId,
          caracteristica_id: caracteristicaId
        })
        .first();
      
      if (!existing) {
        return res.status(404).json({ 
          success: false, 
          message: 'El inmueble no tiene esta característica' 
        });
      }
      
      // Delete the characteristic from the property
      await knex('inmueble_caracteristicas')
        .where({
          inmueble_id: inmuebleId,
          caracteristica_id: caracteristicaId
        })
        .delete();
      
      res.json({
        success: true,
        message: 'Característica eliminada del inmueble correctamente'
      });
    } catch (error) {
      console.error(`Error removing property characteristic: ${(error as Error).message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al eliminar característica del inmueble', 
        error: (error as Error).message 
      });
    }
  });

  return router;
}
