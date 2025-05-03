/**
 * Synchronization routes
 */
import express, { Request, Response } from 'express';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { authenticateJWT, authorize } from '../middlewares/auth.middleware';
import { AuthService } from '../services/AuthService';
import { spawn } from 'child_process';
import path from 'path';

export default function createSyncRouter(dbConnection: DatabaseConnection, authService: AuthService) {
  const router = express.Router();
  
  // Track ongoing synchronization processes
  const syncProcesses: Record<string, any> = {};

  /**
   * Limpia sincronizaciones huérfanas (marcadas como en progreso pero que ya no están ejecutándose)
   * @param timeoutMinutes Tiempo en minutos después del cual una sincronización se considera huérfana
   * @returns Número de sincronizaciones limpiadas
   */
  async function cleanOrphanedSyncs(timeoutMinutes: number = 30): Promise<number> {
    try {
      const knex = dbConnection.getConnection();
      
      // Calcular el tiempo límite (ahora menos el timeout)
      const timeoutDate = new Date();
      timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);
      
      // Buscar sincronizaciones en progreso que hayan comenzado antes del tiempo límite
      const orphanedSyncs = await knex('ejecuciones')
        .where('estado', 'en_progreso')
        .where('fecha_inicio', '<', timeoutDate.toISOString())
        .update({
          estado: 'error',
          fecha_fin: knex.fn.now(),
          error: 'Sincronización marcada como error automáticamente por timeout'
        });
      
      if (orphanedSyncs > 0) {
        console.log(`Se limpiaron ${orphanedSyncs} sincronizaciones huérfanas`);
      }
      
      return orphanedSyncs;
    } catch (error) {
      console.error('Error al limpiar sincronizaciones huérfanas:', error);
      return 0;
    }
  }

  /**
   * @route POST /api/sync/start
   * @desc Start a manual synchronization
   * @access Private (Admin only)
   */
  router.post('/start', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      // Limpiar sincronizaciones huérfanas primero
      await cleanOrphanedSyncs();
      
      // Check if a sync is already running
      const knex = dbConnection.getConnection();
      const runningSync = await knex('ejecuciones')
        .where('estado', 'en_progreso')
        .first();
      
      if (runningSync) {
        // Verificar si la sincronización es reciente (menos de 5 minutos)
        const startTime = new Date(runningSync.fecha_inicio).getTime();
        const currentTime = new Date().getTime();
        const elapsedMinutes = (currentTime - startTime) / (1000 * 60);
        
        if (elapsedMinutes > 5) {
          // Si han pasado más de 5 minutos, marcarla como error y continuar
          await knex('ejecuciones')
            .where('id', runningSync.id)
            .update({
              estado: 'error',
              fecha_fin: knex.fn.now(),
              error: 'Sincronización marcada como error automáticamente por timeout'
            });
          
          console.log(`Sincronización ${runningSync.id} marcada como error por timeout`);
        } else {
          // Si es reciente, informar que está en progreso
          return res.status(409).json({
            success: false,
            message: 'Ya hay una sincronización en progreso',
            data: {
              sync_id: runningSync.id,
              started_at: runningSync.fecha_inicio
            }
          });
        }
      }
      
      console.log('='.repeat(80));
      console.log(`INICIANDO SINCRONIZACIÓN MANUAL - ${new Date().toISOString()}`);
      console.log(`Usuario: ${(req as any).user.username}`);
      console.log('='.repeat(80));
      
      // Create a new execution record
      const [syncId] = await knex('ejecuciones').insert({
        fecha_inicio: knex.fn.now(),
        estado: 'en_progreso',
        tipo: 'manual',
        usuario: (req as any).user.username,
        total_inmuebles: 0,
        nuevos: 0,
        actualizados: 0,
        sin_cambios: 0,
        errores: 0
      });
      
      console.log(`Sincronización creada con ID: ${syncId}`);
      
      // Start the synchronization process
      const scriptPath = path.resolve(process.cwd(), 'scripts', 'sync-js.js');
      console.log(`Ejecutando script: ${scriptPath}`);
      
      // Usar node para ejecutar el script JavaScript directamente
      const syncProcess = spawn('node', [scriptPath, `--execution-id=${syncId}`], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      syncProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        // Mostrar en la consola del servidor
        process.stdout.write(chunk);
      });
      
      syncProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        // Mostrar errores en la consola del servidor
        process.stderr.write(chunk);
      });
      
      // Esperar a que termine el proceso antes de responder
      try {
        await new Promise<void>((resolve, reject) => {
          syncProcess.on('close', async (code) => {
            console.log(`\nProceso de sincronización finalizado con código: ${code}`);
            
            // Update execution record
            const estado = code === 0 ? 'completado' : 'error';
            
            await knex('ejecuciones')
              .where('id', syncId)
              .update({
                fecha_fin: knex.fn.now(),
                estado,
                log: output,
                error: errorOutput
              });
            
            // Remove from tracking
            delete syncProcesses[syncId];
            
            if (code === 0) {
              resolve();
            } else {
              console.error('Error en la sincronización:');
              console.error(errorOutput);
              reject(new Error(`Proceso de sincronización falló con código ${code}. Revisa los logs para más detalles.`));
            }
          });
          
          // Store the process for tracking
          syncProcesses[syncId] = {
            process: syncProcess,
            output,
            errorOutput,
            startTime: new Date()
          };
        });
      } catch (syncError) {
        console.error('Error durante la sincronización:', syncError);
        
        // Obtener la información actualizada de la ejecución a pesar del error
        const syncInfo = await knex('ejecuciones')
          .where('id', syncId)
          .first();
        
        // Responder con la información del error y los datos parciales
        return res.status(500).json({
          success: false,
          message: 'Error durante la sincronización',
          error: errorOutput || (syncError as Error).message,
          data: syncInfo
        });
      }
      
      // Obtener la información actualizada de la ejecución
      const syncInfo = await knex('ejecuciones')
        .where('id', syncId)
        .first();
      
      // Calcular tiempo de ejecución
      const runtimeSeconds = Math.round(
        (new Date(syncInfo.fecha_fin).getTime() - new Date(syncInfo.fecha_inicio).getTime()) / 1000
      );
      
      // Responder con las estadísticas completas
      res.json({
        success: true,
        message: 'Sincronización completada correctamente',
        data: {
          ...syncInfo,
          runtime_seconds: runtimeSeconds
        }
      });
    } catch (error) {
      console.error('Error starting synchronization:', error);
      res.status(500).json({ success: false, message: 'Error al iniciar la sincronización', error });
    }
  });

  /**
   * @route GET /api/sync/status/:id
   * @desc Get synchronization status
   * @access Private (Admin only)
   */
  router.get('/status/:id', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const syncId = parseInt(req.params.id, 10);
      
      if (isNaN(syncId)) {
        return res.status(400).json({ success: false, message: 'ID de sincronización inválido' });
      }
      
      const knex = dbConnection.getConnection();
      
      // Get execution record
      const execution = await knex('ejecuciones')
        .where('id', syncId)
        .first();
      
      if (!execution) {
        return res.status(404).json({ success: false, message: 'Sincronización no encontrada' });
      }
      
      // If the sync is still running, get the latest output
      if (execution.estado === 'en_progreso' && syncProcesses[syncId]) {
        execution.log = syncProcesses[syncId].output;
        execution.error = syncProcesses[syncId].errorOutput;
        execution.runtime_seconds = Math.floor((new Date().getTime() - syncProcesses[syncId].startTime.getTime()) / 1000);
      } else if (execution.fecha_fin) {
        // Calculate runtime
        const startTime = new Date(execution.fecha_inicio).getTime();
        const endTime = new Date(execution.fecha_fin).getTime();
        execution.runtime_seconds = Math.floor((endTime - startTime) / 1000);
      }
      
      // Get changes for this execution
      const changes = await knex('historial_cambios')
        .where('ejecucion_id', syncId)
        .count('id as count')
        .select('tipo_cambio')
        .groupBy('tipo_cambio');
      
      const changesByType: Record<string, number> = {};
      changes.forEach((change: any) => {
        changesByType[change.tipo_cambio] = change.count;
      });
      
      res.json({
        success: true,
        data: {
          ...execution,
          changes_by_type: changesByType
        }
      });
    } catch (error) {
      console.error('Error getting synchronization status:', error);
      res.status(500).json({ success: false, message: 'Error al obtener el estado de la sincronización', error });
    }
  });

  /**
   * @route POST /api/sync/clean
   * @desc Limpiar sincronizaciones bloqueadas
   * @access Private (Admin only)
   */
  router.post('/clean', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      let cleaned = 0;
      
      // Si se especifica un ID específico, limpiar esa sincronización
      if (req.body.sync_id) {
        const syncId = req.body.sync_id;
        
        const updated = await knex('ejecuciones')
          .where('id', syncId)
          .where('estado', 'en_progreso')
          .update({
            estado: 'error',
            fecha_fin: knex.fn.now(),
            error: 'Sincronización marcada como error manualmente por el administrador'
          });
        
        if (updated > 0) {
          console.log(`Sincronización ${syncId} marcada como error manualmente`);
          cleaned += updated;
        }
      } else {
        // Limpiar todas las sincronizaciones huérfanas con un tiempo más corto (5 minutos)
        cleaned = await cleanOrphanedSyncs(5);
      }
      
      return res.json({
        success: true,
        message: `Se limpiaron ${cleaned} sincronizaciones bloqueadas`,
        data: { cleaned }
      });
    } catch (error) {
      console.error('Error al limpiar sincronizaciones:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al limpiar sincronizaciones',
        error: (error as Error).message
      });
    }
  });

  /**
   * @route GET /api/sync/history
   * @desc Get synchronization history
   * @access Private (Admin only)
   */
  router.get('/history', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Get the most recent executions (limit to 20)
      const executions = await knex('ejecuciones')
        .orderBy('fecha_inicio', 'desc')
        .limit(20);
      
      return res.json({
        success: true,
        data: executions
      });
    } catch (error) {
      console.error('Error getting synchronization history:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al obtener el historial de sincronizaciones', 
        error: (error as Error).message 
      });
    }
  });

  /**
   * @route GET /api/sync/current
   * @desc Get current synchronization status if any
   * @access Private (Admin only)
   */
  router.get('/current', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const knex = dbConnection.getConnection();
      
      // Get the most recent execution
      const execution = await knex('ejecuciones')
        .orderBy('fecha_inicio', 'desc')
        .first();
      
      if (!execution) {
        return res.json({
          success: true,
          data: null,
          message: 'No hay sincronizaciones registradas'
        });
      }
      
      // If the sync is still running, get the latest output
      if (execution.estado === 'en_progreso' && syncProcesses[execution.id]) {
        execution.log = syncProcesses[execution.id].output;
        execution.error = syncProcesses[execution.id].errorOutput;
        execution.runtime_seconds = Math.floor((new Date().getTime() - syncProcesses[execution.id].startTime.getTime()) / 1000);
      } else if (execution.fecha_fin) {
        // Calculate runtime
        const startTime = new Date(execution.fecha_inicio).getTime();
        const endTime = new Date(execution.fecha_fin).getTime();
        execution.runtime_seconds = Math.floor((endTime - startTime) / 1000);
      }
      
      res.json({
        success: true,
        data: execution
      });
    } catch (error) {
      console.error('Error getting current synchronization:', error);
      res.status(500).json({ success: false, message: 'Error al obtener la sincronización actual', error });
    }
  });

  /**
   * @route POST /api/sync/cancel/:id
   * @desc Cancel a running synchronization
   * @access Private (Admin only)
   */
  router.post('/cancel/:id', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const syncId = parseInt(req.params.id, 10);
      
      if (isNaN(syncId)) {
        return res.status(400).json({ success: false, message: 'ID de sincronización inválido' });
      }
      
      const knex = dbConnection.getConnection();
      
      // Get execution record
      const execution = await knex('ejecuciones')
        .where('id', syncId)
        .first();
      
      if (!execution) {
        return res.status(404).json({ success: false, message: 'Sincronización no encontrada' });
      }
      
      if (execution.estado !== 'en_progreso') {
        return res.status(400).json({ 
          success: false, 
          message: 'La sincronización no está en progreso' 
        });
      }
      
      // Kill the process if it exists
      if (syncProcesses[syncId]) {
        if (syncProcesses[syncId].process) {
          process.kill(-syncProcesses[syncId].process.pid);
        }
        
        delete syncProcesses[syncId];
      }
      
      // Update execution record
      await knex('ejecuciones')
        .where('id', syncId)
        .update({
          fecha_fin: knex.fn.now(),
          estado: 'cancelado'
        });
      
      res.json({
        success: true,
        message: 'Sincronización cancelada correctamente'
      });
    } catch (error) {
      console.error('Error canceling synchronization:', error);
      res.status(500).json({ success: false, message: 'Error al cancelar la sincronización', error });
    }
  });

  /**
   * @route GET /api/sync/logs/:id
   * @desc Get synchronization logs
   * @access Private (Admin only)
   */
  router.get('/logs/:id', authenticateJWT(authService), authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const syncId = parseInt(req.params.id, 10);
      
      if (isNaN(syncId)) {
        return res.status(400).json({ success: false, message: 'ID de sincronización inválido' });
      }
      
      const knex = dbConnection.getConnection();
      
      // Get execution record
      const execution = await knex('ejecuciones')
        .where('id', syncId)
        .first();
      
      if (!execution) {
        return res.status(404).json({ success: false, message: 'Sincronización no encontrada' });
      }
      
      // If the sync is still running, get the latest output
      let log = execution.log || '';
      let error = execution.error || '';
      
      if (execution.estado === 'en_progreso' && syncProcesses[syncId]) {
        log = syncProcesses[syncId].output;
        error = syncProcesses[syncId].errorOutput;
      }
      
      res.json({
        success: true,
        data: {
          id: syncId,
          log,
          error
        }
      });
    } catch (error) {
      console.error('Error getting synchronization logs:', error);
      res.status(500).json({ success: false, message: 'Error al obtener los logs de la sincronización', error });
    }
  });

  return router;
}
