#!/usr/bin/env ts-node
/**
 * Script para sincronizar datos desde el servidor de Orbis con información detallada
 * Este script muestra información detallada sobre cada inmueble durante la sincronización
 */

import dotenv from 'dotenv';
import { Command } from 'commander';
import { DatabaseConnection } from '../src/database/DatabaseConnection';
import { InmuebleManager } from '../src/services/InmuebleManager';
import { ApiFilters } from '../src/models/types';
import config from '../src/config/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cargar variables de entorno
dotenv.config();

// Configurar el programa de línea de comandos
const program = new Command();

program
  .name('sync-verbose')
  .description('Sincroniza datos de inmuebles desde el servidor de Orbis con información detallada')
  .option('--uso_id <id>', 'ID del uso del inmueble (ej: 1 para vivienda)')
  .option('--estado_actual_in <ids>', 'IDs de estados separados por comas (ej: 1,2,3)')
  .option('--ciudad <ciudad>', 'Nombre de la ciudad')
  .option('--limite <numero>', 'Número máximo de inmuebles a sincronizar', parseInt)
  .option('--no-imagenes', 'No descargar imágenes')
  .option('--no-cambios', 'No registrar cambios')
  .option('--inactivos', 'Marcar como inactivos los inmuebles que no están en la API')
  .option('--execution-id <id>', 'ID de ejecución para actualizar')
  .helpOption('--help', 'Mostrar ayuda')
  .parse(process.argv);

const options = program.opts();

// Función para obtener datos de la API
async function obtenerDatosApi(apiUrl: string, filtros?: ApiFilters) {
  try {
    console.log(`Consultando API: ${apiUrl}`);
    console.log(`Filtros: ${JSON.stringify(filtros || {})}`);
    
    const response = await axios.get(apiUrl);
    
    if (response.status !== 200) {
      throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
    }
    
    console.log(`Respuesta recibida: ${response.data.length} bytes`);
    
    return response.data;
  } catch (error) {
    console.error(`Error al obtener datos de la API: ${(error as Error).message}`);
    return null;
  }
}

// Función para procesar un inmueble con información detallada
async function procesarInmuebleDetallado(inmuebleManager: any, property: any, downloadImages: boolean, trackChanges: boolean) {
  const knex = inmuebleManager.db.getConnection();
  
  // Verificar si el inmueble ya existe
  const existingProperty = await knex('inmuebles')
    .where('ref', property.ref)
    .first();
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`PROCESANDO INMUEBLE REF #${property.ref}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Título: ${property.titulo || 'Sin título'}`);
  console.log(`Dirección: ${property.direccion || 'Sin dirección'}`);
  console.log(`Ciudad: ${property.ciudad || 'Sin ciudad'}`);
  console.log(`Barrio: ${property.barrio || 'Sin barrio'}`);
  console.log(`Tipo: ${property.tipo_inmueble || 'Sin tipo'}`);
  console.log(`Uso: ${property.uso || 'Sin uso'}`);
  console.log(`Estado: ${property.estado_actual || 'Sin estado'}`);
  console.log(`Área: ${property.area || 'Sin área'} m²`);
  console.log(`Habitaciones: ${property.habitaciones || 0}`);
  console.log(`Baños: ${property.banos || 0}`);
  console.log(`Garajes: ${property.garajes || 0}`);
  console.log(`Precio venta: ${property.precio_venta ? `$${property.precio_venta.toLocaleString()}` : 'No disponible'}`);
  console.log(`Precio arriendo: ${property.precio_canon ? `$${property.precio_canon.toLocaleString()}` : 'No disponible'}`);
  
  if (existingProperty) {
    console.log(`\nEstatus: ACTUALIZACIÓN (ID: ${existingProperty.id})`);
    
    // Calcular hash de los datos nuevos
    const dataToHash = JSON.stringify({
      titulo: property.titulo,
      descripcion: property.observacion_portales || property.descripcion || property.observacion,
      direccion: property.direccion,
      area: property.area,
      habitaciones: property.habitaciones,
      banos: property.banos,
      garajes: property.garajes,
      estrato: property.estrato,
      precio_venta: property.precio_venta,
      precio_canon: property.precio_canon,
      precio_administracion: property.precio_administracion,
      latitud: property.latitud,
      longitud: property.longitud
    });
    
    const nuevoHash = crypto.createHash('md5').update(dataToHash).digest('hex');
    
    if (existingProperty.hash_datos !== nuevoHash) {
      console.log(`Hash actual: ${existingProperty.hash_datos}`);
      console.log(`Nuevo hash: ${nuevoHash}`);
      console.log(`\nSe detectaron cambios en los datos.`);
    } else {
      console.log(`\nNo se detectaron cambios en los datos.`);
    }
  } else {
    console.log(`\nEstatus: NUEVO INMUEBLE`);
  }
  
  // Procesar imágenes
  if (downloadImages && property.imagenes && property.imagenes.length > 0) {
    console.log(`\nImágenes: ${property.imagenes.length}`);
    
    for (let i = 0; i < property.imagenes.length; i++) {
      const imagen = property.imagenes[i];
      console.log(`  [${i+1}/${property.imagenes.length}] ${imagen.url_original || 'Sin URL'} (${imagen.es_principal ? 'Principal' : 'Secundaria'})`);
    }
  }
  
  // Procesar características
  if (property.caracteristicas && property.caracteristicas.length > 0) {
    console.log(`\nCaracterísticas: ${property.caracteristicas.length}`);
    
    for (const caracteristica of property.caracteristicas) {
      console.log(`  - ${caracteristica.nombre}: ${caracteristica.valor}`);
    }
  }
  
  // Llamar al método original para procesar el inmueble
  try {
    const propertyId = await inmuebleManager.procesarInmueble(property, downloadImages, trackChanges);
    console.log(`\nInmueble procesado correctamente. ID: ${propertyId}`);
    return propertyId;
  } catch (error) {
    console.error(`\nError al procesar inmueble: ${(error as Error).message}`);
    throw error;
  }
}

// Función principal
async function main() {
  console.log('='.repeat(80));
  console.log('SINCRONIZACIÓN DETALLADA DE DATOS DESDE ORBIS');
  console.log('='.repeat(80));
  
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
    const apiUrl = process.env.API_URL || '';
    
    if (!apiUrl) {
      throw new Error('No se ha configurado la URL de la API en las variables de entorno.');
    }
    
    const apiData = await obtenerDatosApi(apiUrl, filtros);
    
    if (!apiData) {
      throw new Error('No se pudieron obtener datos de la API.');
    }
    
    // Extraer propiedades de la respuesta de la API
    const properties = inmuebleManager.extractPropertyData(apiData);
    
    if (!properties || properties.length === 0) {
      console.error('No se encontraron inmuebles en la API con los filtros especificados.');
      process.exit(1);
    }
    
    console.log(`Se encontraron ${properties.length} inmuebles en la API.`);
    
    // Aplicar límite si se especificó
    const propertiesToProcess = syncOptions.limit ? properties.slice(0, syncOptions.limit) : properties;
    console.log(`Se procesarán ${propertiesToProcess.length} inmuebles.`);
    
    // Procesar cada propiedad
    const activeRefs: number[] = [];
    let count = 0;
    
    for (const property of propertiesToProcess) {
      count++;
      console.log(`\nProcesando inmueble ${count}/${propertiesToProcess.length}`);
      
      await procesarInmuebleDetallado(
        inmuebleManager,
        property, 
        syncOptions.downloadImages, 
        syncOptions.trackChanges
      );
      
      activeRefs.push(property.ref);
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
    
    // Registrar la ejecución directamente en la base de datos
    console.log('Registrando ejecución...');
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
    
    console.log(`Ejecución registrada con ID: ${syncId}`);
    
    // Mostrar resultados
    console.log('='.repeat(80));
    console.log('RESULTADOS DE LA SINCRONIZACIÓN');
    console.log('='.repeat(80));
    console.log(JSON.stringify({
      ...stats,
      inactiveCount,
      duracion_segundos: Math.round((new Date().getTime() - stats.inicio.getTime()) / 1000)
    }, null, 2));
    
    // Diagnóstico de la base de datos
    console.log('='.repeat(80));
    console.log('DIAGNÓSTICO DE LA BASE DE DATOS');
    console.log('='.repeat(80));
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
