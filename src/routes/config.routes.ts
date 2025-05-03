/**
 * System configuration routes
 */
import express, { Request, Response } from 'express';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { authenticateJWT, authorize } from '../middlewares/auth.middleware';
import { AuthService } from '../services/AuthService';
import config from '../config/config';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export default function createConfigRouter(dbConnection: DatabaseConnection, authService: AuthService) {
  const router = express.Router();

  /**
   * @route GET /api/config
   * @desc Get system configuration
   * @access Private (Admin only)
   */
  router.get('/', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      // Get configuration from database
      const knex = dbConnection.getConnection();
      
      // Create configuration table if it doesn't exist
      const tableExists = await knex.schema.hasTable('configuracion');
      if (!tableExists) {
        await knex.schema.createTable('configuracion', (table) => {
          table.string('clave').primary();
          table.text('valor');
          table.string('tipo').defaultTo('string');
          table.string('descripcion');
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
        
        // Insert default configuration
        await knex('configuracion').insert([
          {
            clave: 'api_url',
            valor: config.apiUrl,
            tipo: 'string',
            descripcion: 'URL de la API de Orbis'
          },
          {
            clave: 'sync_interval',
            valor: '24',
            tipo: 'number',
            descripcion: 'Intervalo de sincronización en horas'
          },
          {
            clave: 'max_images_per_property',
            valor: '20',
            tipo: 'number',
            descripcion: 'Número máximo de imágenes por propiedad'
          },
          {
            clave: 'default_agent_id',
            valor: '1',
            tipo: 'number',
            descripcion: 'ID del asesor por defecto para nuevas propiedades'
          }
        ]);
      }
      
      // Get configuration from database
      const configItems = await knex('configuracion').select('*');
      
      // Convert to object
      const configObject: Record<string, any> = {};
      configItems.forEach((item) => {
        if (item.tipo === 'number') {
          configObject[item.clave] = parseFloat(item.valor);
        } else if (item.tipo === 'boolean') {
          configObject[item.clave] = item.valor === 'true';
        } else {
          configObject[item.clave] = item.valor;
        }
      });
      
      // Add system info
      configObject.system = {
        node_version: process.version,
        platform: process.platform,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime(),
        env: process.env.NODE_ENV
      };
      
      // Add database info
      configObject.database = {
        type: process.env.DB_TYPE,
        path: process.env.DB_TYPE === 'sqlite' ? process.env.SQLITE_PATH : null,
        host: process.env.DB_TYPE === 'mysql' ? process.env.MYSQL_HOST : null
      };
      
      res.json({
        success: true,
        data: configObject
      });
    } catch (error) {
      console.error('Error getting configuration:', error);
      res.status(500).json({ success: false, message: 'Error getting configuration', error });
    }
  });

  /**
   * @route PUT /api/config/:key
   * @desc Update a configuration value
   * @access Private (Admin only)
   */
  router.put('/:key', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { value, type, description } = req.body;
      
      if (value === undefined) {
        return res.status(400).json({ success: false, message: 'Value is required' });
      }
      
      const knex = dbConnection.getConnection();
      
      // Check if key exists
      const existingConfig = await knex('configuracion').where('clave', key).first();
      
      if (existingConfig) {
        // Update existing configuration
        await knex('configuracion')
          .where('clave', key)
          .update({
            valor: value.toString(),
            tipo: type || existingConfig.tipo,
            descripcion: description || existingConfig.descripcion,
            updated_at: knex.fn.now()
          });
      } else {
        // Insert new configuration
        await knex('configuracion').insert({
          clave: key,
          valor: value.toString(),
          tipo: type || 'string',
          descripcion: description || '',
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });
      }
      
      // Update environment variable if applicable
      if (key === 'api_url') {
        // Update in-memory config
        config.apiUrl = value;
        
        // Try to update .env file
        try {
          const envPath = path.resolve(process.cwd(), '.env');
          const envConfig = dotenv.parse(fs.readFileSync(envPath));
          
          envConfig.API_URL = value;
          
          const newEnvContent = Object.entries(envConfig)
            .map(([key, val]) => `${key}=${val}`)
            .join('\n');
          
          fs.writeFileSync(envPath, newEnvContent);
        } catch (err) {
          console.warn('Could not update .env file:', err);
        }
      }
      
      res.json({
        success: true,
        message: 'Configuration updated successfully',
        data: {
          key,
          value,
          type: type || (existingConfig ? existingConfig.tipo : 'string'),
          description: description || (existingConfig ? existingConfig.descripcion : '')
        }
      });
    } catch (error) {
      console.error('Error updating configuration:', error);
      res.status(500).json({ success: false, message: 'Error updating configuration', error });
    }
  });

  /**
   * @route DELETE /api/config/:key
   * @desc Delete a configuration value
   * @access Private (Admin only)
   */
  router.delete('/:key', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      
      // Prevent deletion of essential configuration
      const essentialKeys = ['api_url', 'sync_interval', 'default_agent_id'];
      if (essentialKeys.includes(key)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot delete essential configuration' 
        });
      }
      
      const knex = dbConnection.getConnection();
      
      // Check if key exists
      const existingConfig = await knex('configuracion').where('clave', key).first();
      
      if (!existingConfig) {
        return res.status(404).json({ success: false, message: 'Configuration not found' });
      }
      
      // Delete configuration
      await knex('configuracion').where('clave', key).delete();
      
      res.json({
        success: true,
        message: 'Configuration deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting configuration:', error);
      res.status(500).json({ success: false, message: 'Error deleting configuration', error });
    }
  });

  /**
   * @route POST /api/config/reset
   * @desc Reset configuration to defaults
   * @access Private (Admin only)
   */
  router.post('/reset', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Delete all configuration
      await knex('configuracion').delete();
      
      // Insert default configuration
      await knex('configuracion').insert([
        {
          clave: 'api_url',
          valor: config.apiUrl,
          tipo: 'string',
          descripcion: 'URL de la API de Orbis'
        },
        {
          clave: 'sync_interval',
          valor: '24',
          tipo: 'number',
          descripcion: 'Intervalo de sincronización en horas'
        },
        {
          clave: 'max_images_per_property',
          valor: '20',
          tipo: 'number',
          descripcion: 'Número máximo de imágenes por propiedad'
        },
        {
          clave: 'default_agent_id',
          valor: '1',
          tipo: 'number',
          descripcion: 'ID del asesor por defecto para nuevas propiedades'
        }
      ]);
      
      res.json({
        success: true,
        message: 'Configuration reset to defaults'
      });
    } catch (error) {
      console.error('Error resetting configuration:', error);
      res.status(500).json({ success: false, message: 'Error resetting configuration', error });
    }
  });

  return router;
}
