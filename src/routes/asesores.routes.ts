/**
 * Asesores routes
 */
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { authenticateJWT, authorize } from '../middlewares/auth.middleware';
import { AuthService } from '../services/AuthService';
import config from '../config/config';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = config.asesoresImagesFolder;
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename based on asesor id if available
    const asesorId = req.params.id || Date.now();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `asesor_${asesorId}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export function createAsesoresRouter(dbConnection: DatabaseConnection, authService: AuthService) {
  const router = express.Router();

  /**
   * @route GET /api/asesores
   * @desc Get all asesores
   * @access Public
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Build query
      const query = knex('asesores')
        .select('*')
        .orderBy('nombre', 'asc');
      
      // Filter by activo if specified
      if (req.query.activo !== undefined) {
        const activo = req.query.activo === 'true' || req.query.activo === '1';
        query.where('activo', activo);
      }
      
      const asesores = await query;
      
      res.json({
        success: true,
        total: asesores.length,
        data: asesores
      });
    } catch (error) {
      console.error(`Error getting asesores: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting asesores', details: (error as Error).message });
    }
  });

  /**
   * @route GET /api/asesores/:id
   * @desc Get asesor by ID
   * @access Public
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const asesorId = parseInt(req.params.id, 10);
      
      if (isNaN(asesorId)) {
        return res.status(400).json({ error: 'Invalid asesor ID' });
      }
      
      const asesor = await knex('asesores')
        .where('id', asesorId)
        .first();
      
      if (!asesor) {
        return res.status(404).json({ error: 'Asesor not found' });
      }
      
      // Get inmuebles assigned to this asesor
      const inmuebles = await knex('inmuebles')
        .select(
          'inmuebles.*',
          'tipos_inmueble.nombre as tipo_inmueble',
          'usos_inmueble.nombre as uso',
          'estados_inmueble.nombre as estado_actual',
          'ciudades.nombre as ciudad',
          'barrios.nombre as barrio'
        )
        .leftJoin('tipos_inmueble', 'inmuebles.tipo_inmueble_id', 'tipos_inmueble.id')
        .leftJoin('usos_inmueble', 'inmuebles.uso_id', 'usos_inmueble.id')
        .leftJoin('estados_inmueble', 'inmuebles.estado_actual_id', 'estados_inmueble.id')
        .leftJoin('ciudades', 'inmuebles.ciudad_id', 'ciudades.id')
        .leftJoin('barrios', 'inmuebles.barrio_id', 'barrios.id')
        .where('inmuebles.asesor_id', asesorId)
        .where('inmuebles.activo', true)
        .orderBy('inmuebles.ref', 'asc');
      
      // Get images for each property
      for (const property of inmuebles) {
        const images = await knex('imagenes')
          .where('inmueble_id', property.id)
          .orderBy('es_principal', 'desc')
          .orderBy('orden', 'asc')
          .limit(1); // Only get the main image
        
        property.imagen_principal = images.length > 0 
          ? `/api/inmuebles/images/${property.id}/${images[0].nombre_archivo}`
          : null;
      }
      
      asesor.inmuebles = inmuebles;
      asesor.total_inmuebles = inmuebles.length;
      
      res.json({
        success: true,
        data: asesor
      });
    } catch (error) {
      console.error(`Error getting asesor: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting asesor', details: (error as Error).message });
    }
  });

  /**
   * @route POST /api/asesores
   * @desc Create a new asesor
   * @access Admin
   */
  router.post('/', authenticateJWT(authService), authorize(['admin']), upload.single('imagen'), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const { nombre, apellido, email, telefono, activo } = req.body;
      
      if (!nombre) {
        return res.status(400).json({ error: 'Nombre is required' });
      }
      
      // Procesar imagen si se ha subido
      let imagenPath = null;
      if (req.file) {
        // Guardar la ruta relativa de la imagen
        imagenPath = path.relative(process.cwd(), req.file.path);
      }
      
      const [id] = await knex('asesores').insert({
        nombre,
        apellido: apellido || null,
        email: email || null,
        telefono: telefono || null,
        imagen: imagenPath,
        activo: activo !== undefined ? activo : true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
      
      const newAsesor = await knex('asesores').where('id', id).first();
      
      res.status(201).json({
        success: true,
        message: 'Asesor created successfully',
        data: newAsesor
      });
    } catch (error) {
      console.error(`Error creating asesor: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error creating asesor', details: (error as Error).message });
    }
  });

  /**
   * @route PUT /api/asesores/:id
   * @desc Update an asesor
   * @access Admin
   */
  router.put('/:id', authenticateJWT(authService), authorize(['admin']), upload.single('imagen'), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const asesorId = parseInt(req.params.id, 10);
      
      if (isNaN(asesorId)) {
        return res.status(400).json({ error: 'Invalid asesor ID' });
      }
      
      const asesor = await knex('asesores').where('id', asesorId).first();
      
      if (!asesor) {
        return res.status(404).json({ error: 'Asesor not found' });
      }
      
      const { nombre, apellido, email, telefono, activo } = req.body;
      
      if (!nombre) {
        return res.status(400).json({ error: 'Nombre is required' });
      }
      
      // Procesar imagen si se ha subido
      let updateData: any = {
        nombre,
        apellido: apellido || null,
        email: email || null,
        telefono: telefono || null,
        activo: activo !== undefined ? activo : asesor.activo,
        updated_at: knex.fn.now()
      };
      
      if (req.file) {
        // Si hay una imagen anterior, intentar eliminarla
        if (asesor.imagen) {
          const oldImagePath = path.join(process.cwd(), asesor.imagen);
          if (fs.existsSync(oldImagePath)) {
            try {
              fs.unlinkSync(oldImagePath);
            } catch (error) {
              console.error(`Error al eliminar imagen anterior: ${error}`);
            }
          }
        }
        
        // Guardar la ruta relativa de la nueva imagen
        updateData.imagen = path.relative(process.cwd(), req.file.path);
      }
      
      await knex('asesores')
        .where('id', asesorId)
        .update(updateData);
      
      const updatedAsesor = await knex('asesores').where('id', asesorId).first();
      
      res.json({
        success: true,
        message: 'Asesor updated successfully',
        data: updatedAsesor
      });
    } catch (error) {
      console.error(`Error updating asesor: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error updating asesor', details: (error as Error).message });
    }
  });

  /**
   * @route GET /api/asesores/:id/imagen
   * @desc Get asesor image
   * @access Public
   */
  router.get('/:id/imagen', async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const asesorId = parseInt(req.params.id, 10);
      
      if (isNaN(asesorId)) {
        return res.status(400).json({ error: 'Invalid asesor ID' });
      }
      
      const asesor = await knex('asesores')
        .where('id', asesorId)
        .first();
      
      if (!asesor) {
        return res.status(404).json({ error: 'Asesor not found' });
      }
      
      if (!asesor.imagen) {
        return res.status(404).json({ error: 'Asesor has no image' });
      }
      
      // Construir la ruta completa de la imagen
      const imagePath = path.join(process.cwd(), asesor.imagen);
      
      // Verificar si el archivo existe
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ error: 'Image file not found' });
      }
      
      // Enviar el archivo
      res.sendFile(imagePath);
    } catch (error) {
      console.error(`Error getting asesor image: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error getting asesor image', details: (error as Error).message });
    }
  });
  
  /**
   * @route DELETE /api/asesores/:id/imagen
   * @desc Delete asesor image
   * @access Admin
   */
  router.delete('/:id/imagen', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const asesorId = parseInt(req.params.id, 10);
      
      if (isNaN(asesorId)) {
        return res.status(400).json({ error: 'Invalid asesor ID' });
      }
      
      const asesor = await knex('asesores')
        .where('id', asesorId)
        .first();
      
      if (!asesor) {
        return res.status(404).json({ error: 'Asesor not found' });
      }
      
      if (!asesor.imagen) {
        return res.status(404).json({ error: 'Asesor has no image to delete' });
      }
      
      // Construir la ruta completa de la imagen
      const imagePath = path.join(process.cwd(), asesor.imagen);
      
      // Eliminar el archivo si existe
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      
      // Actualizar el registro en la base de datos
      await knex('asesores')
        .where('id', asesorId)
        .update({
          imagen: null,
          updated_at: knex.fn.now()
        });
      
      res.json({
        success: true,
        message: 'Asesor image deleted successfully'
      });
    } catch (error) {
      console.error(`Error deleting asesor image: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error deleting asesor image', details: (error as Error).message });
    }
  });
  
  /**
   * @route DELETE /api/asesores/:id
   * @desc Delete an asesor
   * @access Admin
   */
  router.delete('/:id', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const asesorId = parseInt(req.params.id, 10);
      
      if (isNaN(asesorId)) {
        return res.status(400).json({ error: 'Invalid asesor ID' });
      }
      
      // Check if asesor exists
      const asesor = await knex('asesores').where('id', asesorId).first();
      
      if (!asesor) {
        return res.status(404).json({ error: 'Asesor not found' });
      }
      
      // Don't allow deleting the default asesor (Oficina)
      if (asesorId === 1) {
        return res.status(400).json({ error: 'Cannot delete the default asesor (Oficina)' });
      }
      
      // Reassign inmuebles to default asesor (Oficina)
      await knex('inmuebles')
        .where('asesor_id', asesorId)
        .update({ asesor_id: 1 });
      
      // Delete the asesor
      await knex('asesores').where('id', asesorId).delete();
      
      res.json({
        success: true,
        message: 'Asesor deleted successfully and inmuebles reassigned to Oficina'
      });
    } catch (error) {
      console.error(`Error deleting asesor: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error deleting asesor', details: (error as Error).message });
    }
  });

  /**
   * @route POST /api/asesores/:id/asignar-inmueble/:inmuebleId
   * @desc Assign a property to an asesor
   * @access Admin
   */
  router.post('/:id/asignar-inmueble/:inmuebleId', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      const asesorId = parseInt(req.params.id, 10);
      const inmuebleId = parseInt(req.params.inmuebleId, 10);
      
      if (isNaN(asesorId) || isNaN(inmuebleId)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }
      
      // Check if asesor exists
      const asesor = await knex('asesores').where('id', asesorId).first();
      
      if (!asesor) {
        return res.status(404).json({ error: 'Asesor not found' });
      }
      
      // Check if inmueble exists
      const inmueble = await knex('inmuebles').where('id', inmuebleId).first();
      
      if (!inmueble) {
        return res.status(404).json({ error: 'Inmueble not found' });
      }
      
      // Update the inmueble's asesor_id
      await knex('inmuebles')
        .where('id', inmuebleId)
        .update({ 
          asesor_id: asesorId,
          fecha_actualizacion: knex.fn.now()
        });
      
      res.json({
        success: true,
        message: `Inmueble ${inmueble.ref} assigned to asesor ${asesor.nombre} successfully`
      });
    } catch (error) {
      console.error(`Error assigning inmueble to asesor: ${(error as Error).message}`);
      res.status(500).json({ error: 'Error assigning inmueble to asesor', details: (error as Error).message });
    }
  });

  return router;
}
