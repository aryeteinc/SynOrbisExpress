/**
 * Helper functions for synchronization
 */
import { Knex } from 'knex';
import { DatabaseConnection } from '../database/DatabaseConnection';

/**
 * Class with helper methods for synchronization
 */
export class SyncHelper {
  private db: DatabaseConnection;

  /**
   * Constructor
   * @param db Database connection
   */
  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * Marca como inactivos los inmuebles que no están presentes en la lista de referencias activas
   * @param activeRefs Lista de referencias activas
   * @returns Número de inmuebles marcados como inactivos
   */
  public async marcarInactivosNoPresentes(activeRefs: string[]): Promise<number> {
    const knex = this.db.getConnection();
    
    try {
      // Convertir todas las referencias a string para asegurar compatibilidad
      const activeRefsStr = activeRefs.map(ref => String(ref));
      
      // Marcar como inactivos los inmuebles que no están en la lista de referencias activas
      const result = await knex('inmuebles')
        .whereNotIn('ref', activeRefsStr)
        .where('activo', true) // Solo actualizar los que están activos actualmente
        .update({
          activo: false,
          fecha_actualizacion: knex.fn.now()
        });
      
      console.log(`${result} inmuebles marcados como inactivos.`);
      return result;
    } catch (error) {
      console.error(`Error al marcar inmuebles inactivos: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Registra la ejecución de la sincronización en la base de datos
   * @param stats Estadísticas de la sincronización
   * @param metadata Metadatos adicionales (JSON)
   * @returns ID del registro de ejecución
   */
  public async registrarEjecucion(stats: any, metadata: string): Promise<number> {
    const knex = this.db.getConnection();
    
    try {
      // Calcular duración
      const fin = new Date();
      const inicio = stats.inicio || new Date();
      const duracionMs = fin.getTime() - inicio.getTime();
      const duracionSegundos = Math.floor(duracionMs / 1000);
      
      // Crear tabla si no existe
      await this.crearTablaSiNoExiste();
      
      // Insertar registro de ejecución
      const [id] = await knex('sincronizacion_ejecuciones').insert({
        fecha_inicio: inicio,
        fecha_fin: fin,
        duracion_segundos: duracionSegundos,
        inmuebles_procesados: stats.inmuebles_procesados || 0,
        inmuebles_nuevos: stats.inmuebles_nuevos || 0,
        inmuebles_actualizados: stats.inmuebles_actualizados || 0,
        inmuebles_sin_cambios: stats.inmuebles_sin_cambios || 0,
        imagenes_descargadas: stats.imagenes_descargadas || 0,
        imagenes_eliminadas: stats.imagenes_eliminadas || 0,
        errores: stats.errores || 0,
        metadata: metadata
      });
      
      console.log(`Ejecución registrada con ID ${id}. Duración: ${duracionSegundos} segundos.`);
      return id;
    } catch (error) {
      console.error(`Error al registrar ejecución: ${(error as Error).message}`);
      return 0;
    }
  }
  
  /**
   * Crea la tabla de ejecuciones si no existe
   */
  private async crearTablaSiNoExiste(): Promise<void> {
    const knex = this.db.getConnection();
    
    // Verificar si la tabla existe
    const tableExists = await knex.schema.hasTable('sincronizacion_ejecuciones');
    
    if (!tableExists) {
      console.log('Creando tabla sincronizacion_ejecuciones...');
      
      await knex.schema.createTable('sincronizacion_ejecuciones', (table) => {
        table.increments('id').primary();
        table.datetime('fecha_inicio').notNullable();
        table.datetime('fecha_fin').notNullable();
        table.integer('duracion_segundos').notNullable();
        table.integer('inmuebles_procesados').defaultTo(0);
        table.integer('inmuebles_nuevos').defaultTo(0);
        table.integer('inmuebles_actualizados').defaultTo(0);
        table.integer('inmuebles_sin_cambios').defaultTo(0);
        table.integer('imagenes_descargadas').defaultTo(0);
        table.integer('imagenes_eliminadas').defaultTo(0);
        table.integer('errores').defaultTo(0);
        table.text('metadata').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
      });
      
      console.log('Tabla sincronizacion_ejecuciones creada correctamente.');
    }
  }
}
