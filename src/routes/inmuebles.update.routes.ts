/**
 * Property update routes
 */
import express, { Request, Response } from 'express';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { InmuebleManager } from '../services/InmuebleManager';
import { RequestWithUser } from '../models/types';
import { authenticateJWT, authorize } from '../middlewares/auth.middleware';
import { AuthService } from '../services/AuthService';

/**
 * Create router with database and auth service
 * @param dbConnection Database connection
 * @param authService Authentication service
 * @returns Express router
 */
export default function createInmueblesUpdateRouter(dbConnection: DatabaseConnection, authService: AuthService) {
  const router = express.Router();
  
  // Initialize property manager
  const inmuebleManager = new InmuebleManager(dbConnection);

  /**
   * @route PUT /api/inmuebles/:id
   * @desc Update a property by ID
   * @access Private (Admin only)
   */
  router.put('/:id', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ success: false, message: 'ID de propiedad inválido' });
      }

      const updateData = req.body;
      console.log(`Actualizando propiedad ${propertyId}:`, updateData);
      
      // Validar los datos de actualización
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: 'No se proporcionaron datos para actualizar' });
      }

      // Actualizar la propiedad en la base de datos
      const knex = dbConnection.getConnection();
      const updated = await knex('inmuebles')
        .where('id', propertyId)
        .update(updateData);

      if (updated) {
        // Obtener la propiedad actualizada
        const updatedProperty = await knex('inmuebles')
          .where('id', propertyId)
          .first();
        
        return res.json({ 
          success: true, 
          message: 'Propiedad actualizada correctamente',
          data: updatedProperty
        });
      } else {
        return res.status(404).json({ success: false, message: 'Propiedad no encontrada' });
      }
    } catch (error) {
      console.error('Error al actualizar propiedad:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar la propiedad', error });
    }
  });

  /**
   * @route POST /api/inmuebles/update
   * @desc Update a property (alternative endpoint)
   * @access Private (Admin only)
   */
  router.post('/update', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const { id, ...updateData } = req.body;
      
      if (!id) {
        return res.status(400).json({ success: false, message: 'Se requiere el ID de la propiedad' });
      }

      const propertyId = parseInt(id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ success: false, message: 'ID de propiedad inválido' });
      }

      console.log(`Actualizando propiedad ${propertyId} (endpoint alternativo):`, updateData);
      
      // Validar los datos de actualización
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: 'No se proporcionaron datos para actualizar' });
      }

      // Actualizar la propiedad en la base de datos
      const knex = dbConnection.getConnection();
      const updated = await knex('inmuebles')
        .where('id', propertyId)
        .update(updateData);

      if (updated) {
        // Obtener la propiedad actualizada
        const updatedProperty = await knex('inmuebles')
          .where('id', propertyId)
          .first();
          
        return res.json({ 
          success: true, 
          message: 'Propiedad actualizada correctamente',
          data: updatedProperty
        });
      } else {
        return res.status(404).json({ success: false, message: 'Propiedad no encontrada' });
      }
    } catch (error) {
      console.error('Error al actualizar propiedad:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar la propiedad', error });
    }
  });



  /**
   * @route PUT /api/inmuebles/:id/estado
   * @desc Update property status (active/inactive)
   * @access Private (Admin only)
   */
  router.put('/:id/estado', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ success: false, message: 'ID de propiedad inválido' });
      }

      const { activo } = req.body;
      if (activo === undefined) {
        return res.status(400).json({ success: false, message: 'Se requiere el estado (activo)' });
      }

      console.log(`Actualizando estado de propiedad ${propertyId} a ${activo}`);
      
      // Actualizar el estado de la propiedad en la base de datos
      const knex = dbConnection.getConnection();
      const updated = await knex('inmuebles')
        .where('id', propertyId)
        .update({ activo });

      if (updated) {
        return res.json({ 
          success: true, 
          message: `Propiedad ${activo ? 'activada' : 'desactivada'} correctamente`,
          data: { id: propertyId, activo }
        });
      } else {
        return res.status(404).json({ success: false, message: 'Propiedad no encontrada' });
      }
    } catch (error) {
      console.error('Error al actualizar estado de propiedad:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar el estado de la propiedad', error });
    }
  });

  return router;
}
