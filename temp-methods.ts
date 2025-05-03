/**
 * Marks properties as inactive if they are not in the API
 * @param activePropertyRefs Array of active property references
 * @returns Number of properties marked as inactive
 */
public async marcarInactivosNoPresentes(activePropertyRefs: number[]): Promise<number> {
  const knex = this.db.getConnection();
  
  try {
    // Get properties that are active but not in the active refs list
    const result = await knex('inmuebles')
      .whereNotIn('ref', activePropertyRefs)
      .where('activo', true)
      .update({
        activo: false,
        fecha_actualizacion: knex.fn.now()
      });
    
    console.log(`Marcados ${result} inmuebles como inactivos`);
    return result;
  } catch (error) {
    console.error(`Error al marcar inmuebles inactivos: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Records the execution in the database
 * @param stats Statistics object
 * @param detalles Additional details
 * @returns Execution ID
 */
public async registrarEjecucion(stats: Statistics, detalles?: string): Promise<number> {
  const knex = this.db.getConnection();
  
  try {
    const [id] = await knex('ejecuciones').insert({
      inmuebles_procesados: stats.inmuebles_procesados,
      inmuebles_nuevos: stats.inmuebles_nuevos,
      inmuebles_actualizados: stats.inmuebles_actualizados,
      inmuebles_sin_cambios: stats.inmuebles_sin_cambios,
      imagenes_descargadas: stats.imagenes_descargadas,
      imagenes_eliminadas: stats.imagenes_eliminadas,
      errores: stats.errores,
      detalles: detalles,
      fecha_inicio: stats.inicio,
      fecha_fin: new Date()
    });
    
    return id;
  } catch (error) {
    console.error(`Error al registrar ejecución: ${(error as Error).message}`);
    return 0;
  }
}
