#!/usr/bin/env ts-node
/**
 * Script para sincronizar datos desde el servidor de Orbis
 * 
 * Uso:
 * npm run sync -- [opciones]
 * 
 * Opciones:
 * --uso_id=<id>             ID del uso del inmueble (ej: 1 para vivienda)
 * --estado_actual_in=<ids>  IDs de estados separados por comas (ej: 1,2,3)
 * --ciudad=<ciudad>         Nombre de la ciudad
 * --limite=<numero>         Número máximo de inmuebles a sincronizar
 * --no-imagenes             No descargar imágenes
 * --no-cambios              No registrar cambios
 * --inactivos               Marcar como inactivos los inmuebles que no están en la API
 * --help                    Mostrar ayuda
 */

import dotenv from 'dotenv';
import { Command } from 'commander';
import { DatabaseConnection } from '../src/database/DatabaseConnection';
import { InmuebleManager } from '../src/services/InmuebleManager';
import { ApiFilters } from '../src/models/types';
import config from '../src/config/config';

// Cargar variables de entorno
dotenv.config();

// Configurar el programa de línea de comandos
const program = new Command();

program
  .name('sync-orbis')
  .description('Sincroniza datos de inmuebles desde el servidor de Orbis')
  .option('--uso_id <id>', 'ID del uso del inmueble (ej: 1 para vivienda)')
  .option('--estado_actual_in <ids>', 'IDs de estados separados por comas (ej: 1,2,3)')
  .option('--ciudad <ciudad>', 'Nombre de la ciudad')
  .option('--limite <numero>', 'Número máximo de inmuebles a sincronizar', parseInt)
  .option('--no-imagenes', 'No descargar imágenes')
  .option('--no-cambios', 'No registrar cambios')
  .option('--inactivos', 'Marcar como inactivos los inmuebles que no están en la API')
  .option('--execution-id <id>', 'ID de la ejecución para actualizar estadísticas')
  .helpOption('--help', 'Mostrar ayuda')
  .parse(process.argv);

const options = program.opts();

// Función principal
async function main() {
  console.log('='.repeat(70));
  console.log('SINCRONIZACIÓN DE DATOS DESDE ORBIS');
  console.log('='.repeat(70));
  
  // Inicializar la conexión a la base de datos
  const db = new DatabaseConnection({
    type: config.database.type as 'sqlite' | 'mysql',
    sqlitePath: config.database.sqlitePath,
    mysql: config.database.mysql
  });
  
  try {
    // Configurar tablas de la base de datos
    console.log('Configurando base de datos...');
    await db.setupTables();
    await db.actualizarEstructuraDB();
    console.log(`Base de datos configurada correctamente. Tipo: ${config.database.type}`);
    
    // Crear el gestor de inmuebles
    const inmuebleManager = new InmuebleManager(db);
    
    // Preparar filtros para la API
    const filtros: ApiFilters = {};
    
    if (options.uso_id) {
      filtros.uso_id = parseInt(options.uso_id, 10);
    }
    
    if (options.estado_actual_in) {
      filtros.estado_actual_in = options.estado_actual_in;
    }
    
    if (options.ciudad) {
      filtros.ciudad = options.ciudad;
    }
    
    // Configurar opciones de sincronización
    const syncOptions = {
      downloadImages: options.imagenes !== false,
      trackChanges: options.cambios !== false,
      markInactive: options.inactivos === true,
      limit: options.limite
    };
    
    console.log('Configuración de sincronización:');
    console.log(JSON.stringify({ filtros, opciones: syncOptions }, null, 2));
    
    // Resetear estadísticas
    inmuebleManager.resetStatistics();
    
    // Obtener propiedades de la API
    console.log('Obteniendo datos desde la API...');
    let properties;
    try {
      // La API no acepta un filtro 'limite', así que lo eliminamos si existe
      if (filtros.hasOwnProperty('limite')) {
        delete filtros.limite;
      }
      
      properties = await inmuebleManager.obtenerDatosApi(undefined, filtros);
      
      if (!properties || properties.length === 0) {
        console.error('No se encontraron inmuebles en la API con los filtros especificados.');
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error al obtener datos de la API: ${(error as Error).message}`);
      process.exit(1);
    }
    
    console.log(`Se encontraron ${properties.length} inmuebles en la API.`);
    
    // Aplicar límite si se especificó
    const propertiesToProcess = syncOptions.limit ? properties.slice(0, syncOptions.limit) : properties;
    console.log(`Se procesarán ${propertiesToProcess.length} inmuebles.`);
    
    // Procesar cada propiedad
    const activeRefs: number[] = [];
    let count = 0;
    
    console.log('\n' + '='.repeat(80));
    console.log(`INICIANDO PROCESAMIENTO DE ${propertiesToProcess.length} INMUEBLES`);
    console.log('='.repeat(80));
    
    for (const property of propertiesToProcess) {
      count++;
      console.log(`\n[${'='.repeat(10)} Inmueble ${count}/${propertiesToProcess.length} ${'='.repeat(10)}]`);
      console.log(`Referencia: #${property.ref}`);
      console.log(`Título: ${property.titulo || 'Sin título'}`);
      console.log(`Dirección: ${property.direccion || 'Sin dirección'}`);
      console.log(`Ciudad: ${property.ciudad || 'Sin ciudad'}`);
      console.log(`Barrio: ${property.barrio || 'Sin barrio'}`);
      console.log(`Tipo: ${property.tipo_inmueble || 'Sin tipo'} | Uso: ${property.uso || 'Sin uso'}`);
      
      // Formatear área y características numéricas
      const area = property.area !== undefined && property.area !== null ? property.area : 'Sin datos';
      const habitaciones = property.habitaciones !== undefined && property.habitaciones !== null ? property.habitaciones : 'Sin datos';
      const banos = property.banos !== undefined && property.banos !== null ? property.banos : 'Sin datos';
      const garajes = property.garajes !== undefined && property.garajes !== null ? property.garajes : 'Sin datos';
      console.log(`Área: ${area} m² | Hab: ${habitaciones} | Baños: ${banos} | Garajes: ${garajes}`);
      
      // Formatear precios
      const precioVenta = property.precio_venta !== undefined && property.precio_venta !== null && property.precio_venta > 0 
        ? `$${property.precio_venta.toLocaleString()}` 
        : 'No disponible';
      
      const precioArriendo = property.precio_canon !== undefined && property.precio_canon !== null && property.precio_canon > 0 
        ? `$${property.precio_canon.toLocaleString()}` 
        : 'No disponible';
      
      console.log(`Precio venta: ${precioVenta}`);
      console.log(`Precio arriendo: ${precioArriendo}`);
      
      const startTime = new Date();
      try {
        const propertyId = await inmuebleManager.procesarInmueble(
          property, 
          syncOptions.downloadImages, 
          syncOptions.trackChanges
        );
        
        const endTime = new Date();
        const processingTime = (endTime.getTime() - startTime.getTime()) / 1000;
        
        // Obtener estadísticas actuales
        const stats = inmuebleManager.getStatistics();
        
        console.log(`\nEstado: ${stats.inmuebles_nuevos > count - 1 ? 'NUEVO' : 'ACTUALIZADO'}`);
        console.log(`ID en base de datos: ${propertyId}`);
        console.log(`Tiempo de procesamiento: ${processingTime.toFixed(2)} segundos`);
        
        if (syncOptions.downloadImages && property.imagenes) {
          console.log(`Imágenes procesadas: ${property.imagenes.length}`);
        }
        
        activeRefs.push(property.ref);
      } catch (error) {
        console.error(`ERROR al procesar inmueble #${property.ref}: ${(error as Error).message}`);
      }
      
      // Mostrar progreso
      const progressPercent = Math.round((count / propertiesToProcess.length) * 100);
      console.log(`\nProgreso total: ${progressPercent}% [${count}/${propertiesToProcess.length}]`);
    }
    
    // Marcar inmuebles inactivos si se solicitó
    let inactiveCount = 0;
    if (syncOptions.markInactive) {
      console.log('Marcando inmuebles inactivos...');
      // Usar la función directamente desde la base de datos ya que TypeScript no reconoce el método
      const knex = db.getConnection();
      const result = await knex('inmuebles')
        .whereNotIn('ref', activeRefs)
        .where('activo', true)
        .update({ activo: false });
      
      inactiveCount = result;
      console.log(`Se marcaron ${inactiveCount} inmuebles como inactivos.`);
    }
    
    // Obtener estadísticas
    const stats = inmuebleManager.getStatistics();
    
    // Registrar la ejecución o actualizar la existente
    const executionId = options['execution-id'];
    
    if (executionId) {
      console.log(`Actualizando ejecución existente con ID: ${executionId}`);
      const knex = db.getConnection();
      
      // Actualizar la ejecución existente con las estadísticas
      await knex('ejecuciones')
        .where('id', executionId)
        .update({
          fecha_fin: knex.fn.now(),
          estado: 'completado',
          total_inmuebles: stats.inmuebles_procesados,
          nuevos: stats.inmuebles_nuevos,
          actualizados: stats.inmuebles_actualizados,
          sin_cambios: stats.inmuebles_sin_cambios,
          errores: stats.errores,
          detalles: JSON.stringify({
            filtros,
            opciones: syncOptions,
            inactiveCount
          })
        });
      
      console.log(`Ejecución ${executionId} actualizada correctamente`);
    } else {
      // Crear una nueva ejecución directamente en la base de datos
      console.log('Registrando nueva ejecución...');
      const knex = db.getConnection();
      
      const [syncId] = await knex('ejecuciones').insert({
        fecha_inicio: knex.fn.now(),
        fecha_fin: knex.fn.now(),
        estado: 'completado',
        tipo: 'manual',
        usuario: 'script',
        total_inmuebles: stats.inmuebles_procesados,
        nuevos: stats.inmuebles_nuevos,
        actualizados: stats.inmuebles_actualizados,
        sin_cambios: stats.inmuebles_sin_cambios,
        errores: stats.errores,
        detalles: JSON.stringify({
          filtros,
          opciones: syncOptions,
          inactiveCount
        })
      });
      
      console.log(`Nueva ejecución registrada con ID: ${syncId}`);
    }
    
    // Mostrar resultados
    console.log('='.repeat(70));
    console.log('RESULTADOS DE LA SINCRONIZACIÓN');
    console.log('='.repeat(70));
    console.log(JSON.stringify({
      ...stats,
      inactiveCount,
      duracion_segundos: Math.round((new Date().getTime() - stats.inicio.getTime()) / 1000)
    }, null, 2));
    
    // Diagnóstico de la base de datos
    console.log('='.repeat(70));
    console.log('DIAGNÓSTICO DE LA BASE DE DATOS');
    console.log('='.repeat(70));
    await db.diagnosticarBaseDatos();
    
  } catch (error) {
    console.error(`Error en la sincronización: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.close();
  }
}

// Ejecutar la función principal
main().catch(error => {
  console.error(`Error fatal: ${error.message}`);
  process.exit(1);
});
