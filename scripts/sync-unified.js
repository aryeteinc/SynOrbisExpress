/**
 * Script para sincronizar datos desde el servidor de Orbis (versión JavaScript)
 * 
 * Este script es una versión simplificada que no depende de TypeScript
 * para evitar errores de compilación.
 * 
 * Uso:
 * node sync-unified.js [--execution-id=ID] [--limite=100] [--no-imagenes]
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const knex = require('knex');
const { performance } = require('perf_hooks'); // Para mediciones de rendimiento
const sharp = require('sharp'); // Para optimización de imágenes

// Sistema de caché para consultas frecuentes
const cache = {
  data: new Map(),
  ttl: 300000, // 5 minutos en milisegundos
  
  // Obtener un valor de la caché
  get(key) {
    if (this.data.has(key)) {
      const item = this.data.get(key);
      if (Date.now() < item.expiry) {
        return item.value;
      }
      this.data.delete(key); // Eliminar si expiró
    }
    return null;
  },
  
  // Guardar un valor en la caché
  set(key, value, ttl = this.ttl) {
    this.data.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  },
  
  // Limpiar la caché
  clear() {
    this.data.clear();
  }
};

// Sistema de registro de rendimiento
const perfLogger = {
  timers: {},
  results: {},
  
  start(label) {
    this.timers[label] = performance.now();
  },
  
  end(label) {
    if (!this.timers[label]) return 0;
    
    const duration = performance.now() - this.timers[label];
    this.results[label] = duration; // Guardar el resultado para getAllTimings
    delete this.timers[label];
    
    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    return duration;
  },
  
  // Verificar si un timer está en ejecución
  isRunning(label) {
    return this.timers[label] !== undefined;
  },
  
  // Obtener todos los tiempos registrados
  getAllTimings() {
    return this.results;
  }
};

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos
const args = process.argv.slice(2);
let executionId = null;
let limite = 0;
let downloadImages = true;
let trackChanges = true;

args.forEach(arg => {
  if (arg.startsWith('--execution-id=')) {
    executionId = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--limite=')) {
    limite = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--no-imagenes') {
    downloadImages = false;
  } else if (arg === '--no-cambios') {
    trackChanges = false;
  }
});

// Configurar la conexión a la base de datos
let dbConfig;

// Usar el tipo de base de datos especificado en las variables de entorno
const dbType = process.env.DB_TYPE || 'sqlite';

if (dbType.toLowerCase() === 'mysql') {
  console.log('Configurando conexión a MySQL...');
  dbConfig = {
    client: 'mysql2',
    connection: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'root',
      database: process.env.MYSQL_DATABASE || 'inmuebles'
    },
    pool: { min: 0, max: 7 }
  };
} else {
  console.log('Configurando conexión a SQLite...');
  dbConfig = {
    client: 'sqlite3',
    connection: {
      filename: path.resolve(process.cwd(), process.env.SQLITE_PATH || 'inmuebles_db.sqlite')
    },
    useNullAsDefault: true
  };
}

// Crear la conexión a la base de datos
const db = knex(dbConfig);

// Configuración
const config = {
  apiUrl: process.env.API_URL || 'https://ahoinmobiliaria.webdgi.site/api/inmueble/restful/list/0c353a42-0bf1-432e-a7f8-6f87bab5f5fe/',
  imagesFolder: process.env.IMAGES_FOLDER || path.join(process.cwd(), 'imagenes_inmuebles'),
  asesorImagesFolder: process.env.ASESOR_IMAGES_FOLDER || path.join(process.cwd(), 'imagenes_asesores')
};

// Función para probar la conexión a la base de datos
async function testDatabaseConnection() {
  try {
    console.log('Probando conexión a la base de datos...');
    await db.raw('SELECT 1');
    console.log('Conexión a la base de datos establecida correctamente.');
    return true;
  } catch (error) {
    console.error('ERROR DE CONEXIÓN A LA BASE DE DATOS:');
    console.error('='.repeat(70));
    console.error(error.message);
    console.error('='.repeat(70));
    console.error('Verifique sus credenciales y que el servidor de base de datos esté funcionando.');
    if (dbType.toLowerCase() === 'mysql') {
      console.error('Asegúrese de que el usuario tenga acceso desde esta dirección IP.');
      console.error(`Host: ${process.env.MYSQL_HOST}, Puerto: ${process.env.MYSQL_PORT}`);
      console.error(`Usuario: ${process.env.MYSQL_USER}, Base de datos: ${process.env.MYSQL_DATABASE}`);
    } else {
      console.error(`Ruta de SQLite: ${process.env.SQLITE_PATH}`);
    }
    return false;
  }
}

// Estadísticas de la sincronización
const stats = {
  inmuebles_procesados: 0,
  inmuebles_nuevos: 0,
  inmuebles_actualizados: 0,
  inmuebles_sin_cambios: 0,
  imagenes_nuevas: 0,
  imagenes_descargadas: 0,
  imagenes_optimizadas: 0,
  ahorro_espacio_kb: 0,
  tiempo_total_ms: 0,
  tiempo_imagenes_ms: 0,
  tiempo_promedio_inmueble_ms: 0,
  errores: 0,
  errores_imagenes: 0
};

// Función para crear las tablas de la base de datos si no existen
async function setupDatabaseTables() {
  try {
    console.log('Verificando si las tablas existen en la base de datos...');
    
    // Verificar si la tabla inmuebles existe
    const hasInmuebles = await db.schema.hasTable('inmuebles');
    
    if (!hasInmuebles) {
      console.log('Creando tablas en la base de datos...');
      
      // Crear tablas de catálogos
      await db.schema.createTable('asesores', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('apellido').nullable();
        table.string('email').nullable();
        table.string('telefono').nullable();
        table.string('imagen').nullable();
        table.boolean('activo').defaultTo(true);
        table.timestamps(true, true);
      });
      
      // Insertar asesor por defecto 'Oficina'
      await db('asesores').insert({
        id: 1,
        nombre: 'Oficina',
        activo: true,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
      
      // Crear tabla ciudades
      await db.schema.createTable('ciudades', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      // Crear tabla barrios
      await db.schema.createTable('barrios', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      // Crear tabla tipos_inmueble
      await db.schema.createTable('tipos_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      // Crear tabla usos_inmueble
      await db.schema.createTable('usos_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      // Crear tabla estados_inmueble
      await db.schema.createTable('estados_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      // Crear tabla tipo_consignacion
      await db.schema.createTable('tipo_consignacion', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('descripcion').nullable();
        table.timestamps(true, true);
      });

      // Crear tabla principal de inmuebles
      await db.schema.createTable('inmuebles', table => {
        table.increments('id').primary();
        table.integer('ref').notNullable().unique();
        table.string('codigo_sincronizacion').nullable();
        table.string('titulo').nullable();
        table.string('slug').nullable(); // Agregar campo slug
        table.integer('ciudad_id').unsigned().references('id').inTable('ciudades');
        table.integer('barrio_id').unsigned().references('id').inTable('barrios');
        table.integer('tipo_inmueble_id').unsigned().references('id').inTable('tipos_inmueble');
        table.integer('uso_inmueble_id').unsigned().references('id').inTable('usos_inmueble');
        table.integer('estado_inmueble_id').unsigned().references('id').inTable('estados_inmueble');
        table.integer('tipo_consignacion_id').unsigned().references('id').inTable('tipo_consignacion');
        table.integer('asesor_id').unsigned().references('id').inTable('asesores').defaultTo(1);
        table.string('direccion').nullable();
        table.decimal('area_construida', 15, 2).nullable();
        table.decimal('area_privada', 15, 2).nullable();
        table.decimal('area_terreno', 15, 2).nullable();
        table.decimal('area', 15, 2).nullable();
        table.integer('habitaciones').nullable();
        table.integer('banos').nullable();
        table.integer('garajes').nullable();
        table.integer('estrato').nullable();
        table.decimal('precio_venta', 15, 2).nullable();
        table.decimal('precio_canon', 15, 2).nullable();
        table.decimal('precio_administracion', 15, 2).nullable();
        table.text('descripcion').nullable();
        table.text('descripcion_corta').nullable();
        table.string('latitud').nullable();
        table.string('longitud').nullable();
        table.boolean('activo').defaultTo(true);
        table.boolean('destacado').defaultTo(false);
        table.boolean('en_caliente').defaultTo(false);
        table.timestamp('fecha_actualizacion').defaultTo(db.fn.now());
        table.timestamp('fecha_creacion').defaultTo(db.fn.now());
        table.timestamp('fecha_sincronizacion').defaultTo(db.fn.now());
        table.text('hash_datos').nullable();
      });

      // Crear tabla de imágenes
      await db.schema.createTable('imagenes', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.string('url').notNullable();
        table.string('url_local').nullable();
        table.string('hash_md5').nullable();
        table.integer('ancho').nullable();
        table.integer('alto').nullable();
        table.integer('tamano_bytes').nullable();
        table.boolean('es_principal').defaultTo(false);
        table.boolean('descargada').defaultTo(true);
        table.integer('orden').defaultTo(0);
        table.timestamps(true, true);
      });

      // Crear tabla de características
      await db.schema.createTable('caracteristicas', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.enum('tipo', ['booleano', 'numerico', 'texto']).defaultTo('texto');
        table.string('unidad').nullable();
        table.string('descripcion').nullable();
        table.timestamps(true, true);
      });

      // Crear tabla de relación inmueble-características
      await db.schema.createTable('inmueble_caracteristicas', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.integer('caracteristica_id').unsigned().references('id').inTable('caracteristicas');
        table.string('valor_texto').nullable();
        table.decimal('valor_numerico', 15, 2).nullable();
        table.boolean('valor_booleano').nullable();
        table.timestamps(true, true);
      });

      // Crear tabla de historial de cambios
      await db.schema.createTable('historial_cambios', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.string('campo').notNullable();
        table.text('valor_anterior').nullable();
        table.text('valor_nuevo').nullable();
        table.timestamp('fecha_cambio').defaultTo(db.fn.now());
      });

      // Crear tabla de ejecuciones
      await db.schema.createTable('ejecuciones', table => {
        table.increments('id').primary();
        table.timestamp('fecha_inicio').defaultTo(db.fn.now());
        table.timestamp('fecha_fin').nullable();
        table.string('estado').defaultTo('en_progreso');
        table.string('tipo').defaultTo('manual');
        table.string('usuario').nullable();
        table.integer('total_inmuebles').defaultTo(0);
        table.integer('nuevos').defaultTo(0);
        table.integer('actualizados').defaultTo(0);
        table.integer('sin_cambios').defaultTo(0);
        table.integer('errores').defaultTo(0);
        table.text('log').nullable();
        table.text('error').nullable();
      });

      // Crear tabla de inmuebles_estados para gestionar estados personalizados
      await db.schema.createTable('inmuebles_estados', table => {
        table.increments('id').primary();
        table.integer('inmueble_ref').notNullable();
        table.string('codigo_sincronizacion').nullable();
        table.boolean('activo').defaultTo(true);
        table.boolean('destacado').defaultTo(false);
        table.boolean('en_caliente').defaultTo(false);
        table.timestamp('fecha_modificacion').defaultTo(db.fn.now());
        table.timestamps(true, true);
        table.unique(['inmueble_ref', 'codigo_sincronizacion']);
      });
      
      // Crear tabla de etiquetas
      await db.schema.createTable('etiquetas', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.string('color').defaultTo('#3498db');
        table.string('descripcion').nullable();
        table.timestamps(true, true);
      });
      
      // Crear tabla de relación inmuebles-etiquetas
      await db.schema.createTable('inmuebles_etiquetas', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.integer('etiqueta_id').unsigned().references('id').inTable('etiquetas').onDelete('CASCADE');
        table.timestamps(true, true);
        table.unique(['inmueble_id', 'etiqueta_id']);
      });

      console.log('Tablas creadas correctamente.');
      
      // Insertar datos de catálogo necesarios
      await insertCatalogData();
      
      // Insertar etiquetas predeterminadas
      await insertDefaultTags();
    } else {
      console.log('Las tablas ya existen en la base de datos.');
      
      // Verificar si los datos de catálogo existen
      const ciudadesCount = await db('ciudades').count('* as count').first();
      if (ciudadesCount.count === 0) {
        console.log('Insertando datos de catálogo...');
        await insertCatalogData();
        await insertDefaultTags();
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error al crear las tablas: ${error.message}`);
    return false;
  }
}

// Función para gestionar los estados personalizados de un inmueble
async function managePropertyStates(inmuebleRef, codigoSincronizacion, activo, destacado, enCaliente) {
  try {
    // Obtener los valores actuales del inmueble
    const inmueble = await db('inmuebles')
      .where('ref', inmuebleRef)
      .first();
    
    if (!inmueble) {
      console.log(`Inmueble #${inmuebleRef}: No encontrado en la base de datos`);
      return false;
    }
    
    // Si todos los campos tienen valores por defecto (activo=true, destacado=false, en_caliente=false),
    // eliminar el registro de inmuebles_estados si existe
    if (activo === true && destacado === false && enCaliente === false) {
      const deleted = await db('inmuebles_estados')
        .where('inmueble_ref', inmuebleRef)
        .where('codigo_sincronizacion', codigoSincronizacion || '')
        .delete();
      
      if (deleted > 0) {
        console.log(`Inmueble #${inmuebleRef}: Eliminado de inmuebles_estados porque tiene valores por defecto`);
      }
      return true;
    }
    
    // Si alguno de los campos tiene un valor personalizado, guardar o actualizar su estado
    // Verificar si ya existe un registro para este inmueble
    const existingState = await db('inmuebles_estados')
      .where('inmueble_ref', inmuebleRef)
      .where('codigo_sincronizacion', codigoSincronizacion || '')
      .first();
    
    if (existingState) {
      // Actualizar el registro existente
      await db('inmuebles_estados')
        .where('id', existingState.id)
        .update({
          inmueble_ref: inmuebleRef,
          codigo_sincronizacion: codigoSincronizacion || '',
          activo: activo,
          destacado: destacado,
          en_caliente: enCaliente,
          fecha_modificacion: db.fn.now(),
          updated_at: db.fn.now()
        });
      
      console.log(`Inmueble #${inmuebleRef}: Estado personalizado actualizado`);
    } else {
      // Crear un nuevo registro
      await db('inmuebles_estados').insert({
        inmueble_ref: inmuebleRef,
        codigo_sincronizacion: codigoSincronizacion || '',
        activo: activo,
        destacado: destacado,
        en_caliente: enCaliente,
        fecha_modificacion: db.fn.now(),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
      
      console.log(`Inmueble #${inmuebleRef}: Estado personalizado creado`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error al gestionar estados para inmueble #${inmuebleRef}: ${error.message}`);
    return false;
  }
}

// Función para compatibilidad con código existente (solo gestiona el campo activo)
async function managePropertyActiveState(inmuebleRef, codigoSincronizacion, activo) {
  // Obtener el valor actual de destacado del inmueble
  const inmueble = await db('inmuebles')
    .where('ref', inmuebleRef)
    .select('destacado')
    .first();
  
  const destacado = inmueble ? inmueble.destacado : false;
  const enCaliente = inmueble ? inmueble.en_caliente : false;
  
  // Usar la nueva función que maneja ambos estados
  return managePropertyStates(inmuebleRef, codigoSincronizacion, activo, destacado, enCaliente);
}

// Función para marcar inmuebles como inactivos
async function markInactiveProperties(activeRefs) {
  try {
    // Obtener todos los inmuebles que no están en la lista de activos
    const inactiveProperties = await db('inmuebles')
      .whereNotIn('ref', activeRefs)
      .where('activo', true);
    
    if (inactiveProperties.length > 0) {
      console.log(`Marcando ${inactiveProperties.length} inmuebles como inactivos...`);
      
      // Marcar como inactivos
      for (const property of inactiveProperties) {
        // Actualizar en la tabla inmuebles
        await db('inmuebles')
          .where('id', property.id)
          .update({ activo: false, fecha_actualizacion: db.fn.now() });
        
        // Guardar el estado en inmuebles_estados
        await managePropertyStates(property.ref, property.codigo_sincronizacion, false, property.destacado || false, property.en_caliente || false);
        
        console.log(`Inmueble #${property.ref}: Marcado como inactivo`);
      }
      
      stats.inmuebles_inactivos = inactiveProperties.length;
    } else {
      console.log('No hay inmuebles para marcar como inactivos');
    }
    
    return true;
  } catch (error) {
    console.error(`Error al marcar inmuebles inactivos: ${error.message}`);
    return false;
  }
}

// Función para insertar datos de catálogo necesarios
async function insertCatalogData() {
  try {
    console.log('Insertando datos de catálogo iniciales...');
    
    // Verificar si existe el asesor por defecto 'Oficina'
    const oficinaExists = await db('asesores').where('id', 1).first();
    
    if (!oficinaExists) {
      // Insertar asesor por defecto 'Oficina'
      await db('asesores').insert({
        id: 1,
        nombre: 'Oficina',
        activo: true,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
      console.log('Asesor por defecto "Oficina" creado.');
    }
    
    // Insertar ciudades
    const ciudades = [
      { nombre: 'Sincelejo (Suc)' },
      { nombre: 'Bogotá' },
      { nombre: 'Medellín' },
      { nombre: 'Cali' },
      { nombre: 'Barranquilla' }
    ];
    
    for (const ciudad of ciudades) {
      const exists = await db('ciudades').where('nombre', ciudad.nombre).first();
      if (!exists) {
        await db('ciudades').insert(ciudad);
      }
    }
    
    // Insertar barrios
    const barrios = [
      { nombre: 'VENECIA I' },
      { nombre: 'LA TOSCANA' },
      { nombre: 'Centro' },
      { nombre: 'El Bosque' },
      { nombre: 'Los Alpes' },
      { nombre: 'Venecia' },
      { nombre: 'EL SOCORRO' }
    ];
    
    for (const barrio of barrios) {
      const exists = await db('barrios').where('nombre', barrio.nombre).first();
      if (!exists) {
        await db('barrios').insert(barrio);
      }
    }
    
    // Insertar tipos de inmueble
    const tiposInmueble = [
      { nombre: 'Apartamento' },
      { nombre: 'Casa' },
      { nombre: 'Local' },
      { nombre: 'Oficina' },
      { nombre: 'Bodega' },
      { nombre: 'Lote' },
      { nombre: 'Casa Lote' },
      { nombre: 'Finca' }
    ];
    
    for (const tipo of tiposInmueble) {
      const exists = await db('tipos_inmueble').where('nombre', tipo.nombre).first();
      if (!exists) {
        await db('tipos_inmueble').insert(tipo);
      }
    }
    
    // Insertar usos de inmueble
    const usosInmueble = [
      { nombre: 'Vivienda' },
      { nombre: 'Comercial' },
      { nombre: 'Industrial' },
      { nombre: 'Mixto' }
    ];
    
    for (const uso of usosInmueble) {
      const exists = await db('usos_inmueble').where('nombre', uso.nombre).first();
      if (!exists) {
        await db('usos_inmueble').insert(uso);
      }
    }
    
    // Insertar estados de inmueble
    const estadosInmueble = [
      { nombre: 'Disponible' },
      { nombre: 'Arrendado' },
      { nombre: 'Vendido' },
      { nombre: 'Reservado' }
    ];
    
    for (const estado of estadosInmueble) {
      const exists = await db('estados_inmueble').where('nombre', estado.nombre).first();
      if (!exists) {
        await db('estados_inmueble').insert(estado);
      }
    }
    
    // Insertar tipos de consignación
    const tiposConsignacion = [
      { nombre: 'Venta', descripcion: 'Inmuebles para venta' },
      { nombre: 'Arriendo', descripcion: 'Inmuebles para arriendo' },
      { nombre: 'Venta y Arriendo', descripcion: 'Inmuebles disponibles tanto para venta como para arriendo' }
    ];
    
    for (const tipo of tiposConsignacion) {
      const exists = await db('tipo_consignacion').where('nombre', tipo.nombre).first();
      if (!exists) {
        await db('tipo_consignacion').insert(tipo);
      }
    }
    
    console.log('Datos de catálogo insertados correctamente.');
    return true;
  } catch (error) {
    console.error(`Error al insertar datos de catálogo: ${error.message}`);
    return false;
  }
}

// Función para insertar etiquetas predeterminadas
async function insertDefaultTags() {
  try {
    // Verificar si ya existen etiquetas
    const tagsCount = await db('etiquetas').count('* as count').first();
    
    if (tagsCount.count === 0) {
      console.log('Insertando etiquetas predeterminadas...');
      
      // Definir etiquetas predeterminadas
      const defaultTags = [
        { nombre: 'Promoción', color: '#e74c3c', descripcion: 'Inmuebles en promoción especial' },
        { nombre: 'Nuevo', color: '#2ecc71', descripcion: 'Inmuebles recién añadidos' },
        { nombre: 'Rebajado', color: '#f39c12', descripcion: 'Inmuebles con precio rebajado' },
        { nombre: 'Exclusivo', color: '#9b59b6', descripcion: 'Inmuebles exclusivos' },
        { nombre: 'Oportunidad', color: '#e67e22', descripcion: 'Oportunidades de inversión' }
      ];
      
      // Insertar etiquetas
      for (const tag of defaultTags) {
        await db('etiquetas').insert({
          nombre: tag.nombre,
          color: tag.color,
          descripcion: tag.descripcion,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
      }
      
      console.log('Etiquetas predeterminadas insertadas correctamente.');
    } else {
      console.log('Ya existen etiquetas en la base de datos.');
    }
    
    return true;
  } catch (error) {
    console.error(`Error al insertar etiquetas predeterminadas: ${error.message}`);
    return false;
  }
}

// Función para procesar lotes de inmuebles en paralelo
async function processBatchInParallel(properties, batchSize = 5, downloadImages = true, trackChanges = true) {
  const results = [];
  const activeRefs = [];
  
  // Calcular el número total de lotes
  const totalBatches = Math.ceil(properties.length / batchSize);
  console.log(`Procesando ${properties.length} inmuebles en ${totalBatches} lotes (${batchSize} inmuebles por lote)`);
  
  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`\nProcesando lote ${batchNumber}/${totalBatches} (${i+1}-${Math.min(i+batchSize, properties.length)}/${properties.length})`);
    
    // Iniciar medición de tiempo para este lote
    perfLogger.start(`lote_${batchNumber}`);
    
    // Procesar inmuebles en paralelo con un límite de concurrencia
    const batchPromises = batch.map(property => {
      return new Promise(async (resolve) => {
        try {
          console.log(`Procesando inmueble: Ref ${property.ref}`);
          // Procesar el inmueble
          await processProperty(property, downloadImages, trackChanges);
          activeRefs.push(property.ref);
          resolve({ success: true, ref: property.ref });
        } catch (error) {
          console.error(`ERROR al procesar inmueble #${property.ref}: ${error.message}`);
          stats.errores++;
          resolve({ success: false, ref: property.ref, error: error.message });
        }
      });
    });
    
    // Esperar a que se completen todas las promesas de este lote
    const batchResults = await Promise.all(batchPromises);
    
    const duration = perfLogger.end(`lote_${batchNumber}`);
    const successCount = batchResults.filter(result => result.success).length;
    
    results.push(...batchResults);
    console.log(`Lote ${batchNumber} completado: ${successCount}/${batch.length} inmuebles procesados correctamente en ${duration.toFixed(2)}ms`);
    
    // Mostrar progreso total
    const progressPercent = Math.round(((i + batch.length) / properties.length) * 100);
    console.log(`\nProgreso total: ${progressPercent}% [${Math.min(i + batch.length, properties.length)}/${properties.length}]`);
  }
  
  return { results, activeRefs };
}

// Función principal
async function main() {
  console.log('='.repeat(70));
  console.log('SINCRONIZACIÓN DE DATOS DESDE ORBIS (JavaScript)');
  console.log('='.repeat(70));
  
  try {
    // Probar la conexión a la base de datos antes de continuar
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      console.error('No se pudo establecer conexión con la base de datos. Abortando sincronización.');
      process.exit(1);
    }
    
    // Configurar las tablas de la base de datos si no existen
    const tablesSetup = await setupDatabaseTables();
    if (!tablesSetup) {
      console.error('No se pudieron crear las tablas necesarias. Abortando sincronización.');
      process.exit(1);
    }
    
    // Verificar y crear carpetas de imágenes si no existen
    if (!fs.existsSync(config.imagesFolder)) {
      fs.mkdirSync(config.imagesFolder, { recursive: true });
      console.log(`Carpeta de imágenes de inmuebles creada: ${config.imagesFolder}`);
    }
    
    if (!fs.existsSync(config.asesorImagesFolder)) {
      fs.mkdirSync(config.asesorImagesFolder, { recursive: true });
      console.log(`Carpeta de imágenes de asesores creada: ${config.asesorImagesFolder}`);
    }
    
    // Actualizar los slugs de todos los inmuebles existentes
    console.log('Actualizando slugs de todos los inmuebles existentes...');
    try {
      // Obtener todos los inmuebles
      const inmuebles = await db('inmuebles').select('id', 'ref', 'codigo_sincronizacion', 'slug');
      console.log(`Se encontraron ${inmuebles.length} inmuebles para revisar slugs.`);
      
      // Contador para estadísticas
      let actualizados = 0;
      let sinCambios = 0;
      
      // Procesar cada inmueble
      for (const inmueble of inmuebles) {
        // Generar el slug según la lógica requerida
        const nuevoSlug = generateSlug(inmueble.codigo_sincronizacion, inmueble.id);
        
        // Si el slug actual es diferente al nuevo, actualizarlo
        if (inmueble.slug !== nuevoSlug) {
          console.log(`Inmueble #${inmueble.ref}: Actualizando slug de '${inmueble.slug || 'null'}' a '${nuevoSlug}'`);
          
          await db('inmuebles')
            .where('id', inmueble.id)
            .update({ slug: nuevoSlug });
          
          actualizados++;
        } else {
          sinCambios++;
        }
      }
      
      console.log(`Slugs actualizados: ${actualizados}`);
      console.log(`Slugs sin cambios: ${sinCambios}`);
    } catch (error) {
      console.error(`Error al actualizar slugs: ${error.message}`);
    }
    
    // Obtener datos de la API
    console.log('Obteniendo datos de la API...');
    const properties = await fetchDataFromApi();
    
    if (!properties || properties.length === 0) {
      console.log('No se encontraron inmuebles para sincronizar.');
      await updateExecution('completado', 'No se encontraron inmuebles');
      return;
    }
    
    console.log(`Se encontraron ${properties.length} inmuebles.`);
    
    // Limitar la cantidad de inmuebles si se especificó
    const propertiesToProcess = limite > 0 && limite < properties.length 
      ? properties.slice(0, limite) 
      : properties;
    
    console.log(`Procesando ${propertiesToProcess.length} inmuebles...`);
    
    // Iniciar medición de tiempo total
    perfLogger.start('procesamiento_total');
    
    // Determinar el tamaño óptimo del lote basado en la cantidad de inmuebles
    const batchSize = Math.min(5, Math.max(1, Math.ceil(propertiesToProcess.length / 10)));
    
    // Procesar inmuebles en paralelo
    console.log('Utilizando procesamiento en paralelo para mayor velocidad...');
    console.log(`Tamaño de lote configurado: ${batchSize} inmuebles por lote`);
    
    const { activeRefs } = await processBatchInParallel(propertiesToProcess, batchSize, downloadImages, trackChanges);
    
    // Mostrar tiempo total de procesamiento
    const totalDuration = perfLogger.end('procesamiento_total');
    console.log(`\nTiempo total de procesamiento: ${totalDuration.toFixed(2)}ms (${(totalDuration/1000).toFixed(2)} segundos)`);
    console.log(`Velocidad promedio: ${(propertiesToProcess.length / (totalDuration/1000)).toFixed(2)} inmuebles por segundo`);
    
    // Actualizar la ejecución con las estadísticas
    await updateExecution('completado');
    
    // Actualizar estadísticas finales
    stats.tiempo_total_ms = totalDuration;
    stats.tiempo_promedio_inmueble_ms = propertiesToProcess.length > 0 ? totalDuration / propertiesToProcess.length : 0;
    
    // Mostrar estadísticas
    console.log('\n='.repeat(70));
    console.log('RESULTADOS DE LA SINCRONIZACIÓN OPTIMIZADA');
    console.log('='.repeat(70));
    
    const durationMinutes = Math.floor(totalDuration / 60000);
    const durationSeconds = Math.floor((totalDuration % 60000) / 1000);
    
    console.log(`\nESTADÍSTICAS DE RENDIMIENTO:`);
    console.log(`Tiempo total de ejecución: ${durationMinutes} minutos, ${durationSeconds} segundos (${(totalDuration/1000).toFixed(2)}s)`);
    console.log(`Velocidad promedio: ${(propertiesToProcess.length / (totalDuration/1000)).toFixed(2)} inmuebles por segundo`);
    console.log(`Tiempo promedio por inmueble: ${(stats.tiempo_promedio_inmueble_ms/1000).toFixed(2)} segundos`);
    
    console.log(`\nESTADÍSTICAS DE INMUEBLES:`);
    console.log(`Total inmuebles procesados: ${stats.inmuebles_procesados}`);
    console.log(`Inmuebles nuevos: ${stats.inmuebles_nuevos}`);
    console.log(`Inmuebles actualizados: ${stats.inmuebles_actualizados}`);
    console.log(`Inmuebles sin cambios: ${stats.inmuebles_sin_cambios}`);
    
    console.log(`\nESTADÍSTICAS DE IMÁGENES:`);
    console.log(`Imágenes descargadas: ${stats.imagenes_descargadas}`);
    console.log(`Imágenes nuevas: ${stats.imagenes_nuevas}`);
    console.log(`Imágenes optimizadas: ${stats.imagenes_optimizadas || 0}`);
    if (stats.ahorro_espacio_kb > 0) {
      const ahorroMB = stats.ahorro_espacio_kb / 1024;
      console.log(`Ahorro de espacio: ${ahorroMB.toFixed(2)} MB`);
    }
    
    console.log(`\nERRORES:`);
    console.log(`Errores de inmuebles: ${stats.errores}`);
    console.log(`Errores de imágenes: ${stats.errores_imagenes}`);
    
    // Mostrar resumen de tiempos de las operaciones principales
    console.log(`\nDETALLE DE TIEMPOS:`);
    const tiempos = perfLogger.getAllTimings();
    Object.keys(tiempos).forEach(key => {
      if (key.startsWith('lote_')) {
        console.log(`Lote ${key.replace('lote_', '')}: ${(tiempos[key]/1000).toFixed(2)}s`);
      }
    });
    
    console.log('\n' + '='.repeat(70));
    
  } catch (error) {
    console.error(`Error fatal: ${error.message}`);
    await updateExecution('error', error.message);
    process.exit(1);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Función para obtener datos de la API
async function fetchDataFromApi() {
  try {
    console.log(`Consultando API en: ${config.apiUrl}`);
    
    const response = await axios.get(config.apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`Respuesta recibida. Código: ${response.status}`);
      console.log(`Tamaño de la respuesta: ${JSON.stringify(response.data).length} bytes`);
      
      return extractPropertyData(response.data);
    } else {
      console.log(`Error al obtener datos de la API. Código: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(`Error en la petición a la API: ${error.message}`);
    return null;
  }
}

// Función para extraer datos de inmuebles de la respuesta de la API
function extractPropertyData(data) {
  // Obtener la lista de inmuebles según la estructura de la respuesta
  let properties = [];
  
  if (Array.isArray(data)) {
    properties = data;
  } else if (typeof data === 'object') {
    if (data.data && Array.isArray(data.data)) {
      properties = data.data;
    } else if (data.inmuebles && Array.isArray(data.inmuebles)) {
      properties = data.inmuebles;
    } else if (data.items && Array.isArray(data.items)) {
      properties = data.items;
    } else if (data.results && Array.isArray(data.results)) {
      properties = data.results;
    } else if (data.ref) {
      // Si es un solo inmueble
      properties = [data];
    }
  }
  
  // Mapear los datos al formato esperado por la base de datos
  return properties.map(property => ({
    ref: property.ref,
    codigo_sincronizacion: property.codigo_consignacion_sincronizacion || '',
    titulo: property.observacion || '',
    descripcion: property.observacion_portales || property.observacion || '',
    descripcion_corta: property.observacion || '',
    area_construida: parseFloat(property.area_total) || null,
    area_privada: parseFloat(property.area_privada) || null,
    area_terreno: parseFloat(property.area_terreno) || null,
    habitaciones: property.alcobas || null,
    banos: property.baños || null,
    garajes: property.caracteristicas?.find(c => c.nombre === 'NUM PARQUEADEROS')?.valor || null,
    estrato: property.estrato || null,
    precio_venta: property.valor_venta || null,
    precio_canon: property.valor_canon || null,
    precio_administracion: property.valor_admon || null,
    precio_total: property.valor_venta || property.valor_canon || null,
    latitud: property.latitud || null,
    longitud: property.longitud || null,
    direccion: property.direccion || '',
    imagenes: property.imagenes || [],
    // Extraer datos relacionales de la API
    ciudad_nombre: property.ciudad || '',
    barrio_nombre: property.barrio || '',
    tipo_inmueble_nombre: property.tipo_inmueble || '',
    uso_inmueble_nombre: property.uso || '',
    estado_inmueble_nombre: property.estado_actual || '',
    tipo_consignacion_nombre: property.tipo_consignacion || '',
    caracteristicas: property.caracteristicas || []
  }));
}

// Función para generar el slug de un inmueble
function generateSlug(propertyOrCodigo, id) {
  // Detectar si se pasó un objeto completo o parámetros individuales
  let ref, codigo_sincronizacion;
  
  if (typeof propertyOrCodigo === 'object' && propertyOrCodigo !== null) {
    // Se pasó un objeto property completo
    ref = propertyOrCodigo.ref;
    codigo_sincronizacion = propertyOrCodigo.codigo_sincronizacion;
  } else {
    // Se pasaron parámetros individuales
    codigo_sincronizacion = propertyOrCodigo;
    ref = id; // En este caso, el segundo parámetro es el id/ref
  }
  
  console.log('generateSlug - Datos:', {
    codigo_sincronizacion: codigo_sincronizacion || 'N/A',
    ref: ref || 'N/A'
  });

  // Función auxiliar para limpiar texto para slugs (elimina espacios y caracteres especiales)
  function cleanForSlug(text) {
    if (!text) return '';
    // Reemplazar espacios por guiones y eliminar caracteres especiales
    return text.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  }

  // Regla 1: Si existe codigo_sincronizacion, el slug debe ser "Inmueble-" + codigo_sincronizacion
  if (codigo_sincronizacion && codigo_sincronizacion.trim && codigo_sincronizacion.trim() !== '') {
    const cleanCode = cleanForSlug(codigo_sincronizacion);
    const slug = `Inmueble-${cleanCode}`;
    console.log(`Inmueble #${ref}: Generando slug con codigo_sincronizacion: ${slug}`);
    return slug;
  }
  // Regla 2: Si no existe codigo_sincronizacion, el slug debe ser "inmueble-scv-" + ref
  else {
    const cleanRef = cleanForSlug(ref ? ref.toString() : '');
    const slug = `inmueble-scv-${cleanRef}`;
    console.log(`Inmueble #${ref}: Generando slug con ref: ${slug}`);
    return slug;
  }
}

// Función para ejecutar operaciones dentro de una transacción
async function withTransaction(callback) {
  const trx = await db.transaction();
  try {
    const result = await callback(trx);
    await trx.commit();
    return result;
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

// Función para procesar un inmueble
// Función para validar y truncar el título si es necesario
function validateTitle(property) {
  // Máxima longitud permitida para el campo título en la base de datos
  const MAX_TITLE_LENGTH = 255;
  
  // Usar codigo_consignacion_sincronizacion como título si está disponible
  if (property.codigo_consignacion_sincronizacion && property.codigo_consignacion_sincronizacion.trim() !== '') {
    property.titulo = property.codigo_consignacion_sincronizacion;
    console.log(`Inmueble #${property.ref}: Usando codigo_consignacion_sincronizacion como título: ${property.titulo}`);
  }
  // Si no hay codigo_consignacion_sincronizacion pero hay tipo_inmueble_nombre y ciudad_nombre, crear un título descriptivo
  else if (property.tipo_inmueble_nombre && property.ciudad_nombre) {
    property.titulo = `${property.tipo_inmueble_nombre} en ${property.ciudad_nombre} - Ref: ${property.ref}`;
    console.log(`Inmueble #${property.ref}: Generando título descriptivo: ${property.titulo}`);
  }
  // Si no hay suficiente información, usar un título genérico con la referencia
  else {
    property.titulo = `Inmueble Ref: ${property.ref}`;
    console.log(`Inmueble #${property.ref}: Generando título genérico: ${property.titulo}`);
  }
  
  // Verificación final para asegurar que el título no exceda la longitud máxima
  if (property.titulo && property.titulo.length > MAX_TITLE_LENGTH) {
    console.log(`Inmueble #${property.ref}: Truncando título de ${property.titulo.length} caracteres a ${MAX_TITLE_LENGTH}`);
    property.titulo = property.titulo.substring(0, MAX_TITLE_LENGTH - 3) + '...';
  }
  
  return property;
}

// Función para calcular el hash de los datos de un inmueble
function calculateHash(property) {
  const dataToHash = {
    ref: property.ref,
    titulo: property.titulo,
    descripcion: property.descripcion,
    area_construida: property.area_construida,
    area_privada: property.area_privada,
    area_terreno: property.area_terreno,
    area: property.area_construida, // También incluimos area para compatibilidad
    habitaciones: property.habitaciones,
    banos: property.banos,
    garajes: property.garajes,
    estrato: property.estrato,
    precio_venta: property.precio_venta,
    precio_canon: property.precio_canon,
    precio_administracion: property.precio_administracion,
    precio_total: property.precio_total,
    latitud: property.latitud,
    longitud: property.longitud,
    direccion: property.direccion
  };
  
  return crypto
    .createHash('md5')
    .update(JSON.stringify(dataToHash))
    .digest('hex');
}

async function processProperty(property, downloadImages = true, trackChanges = true) {
  try {
    // Iniciar medición de tiempo para este inmueble
    perfLogger.start(`inmueble_${property.ref}`);
    stats.inmuebles_procesados++;
    
    // Validar y ajustar el título del inmueble
    property = validateTitle(property);
    
    // Calcular el hash de los datos del inmueble para detectar cambios
    const nuevoHash = calculateHash(property);
    
    // Buscar si el inmueble ya existe en la base de datos
    const existingProperty = await db('inmuebles')
      .where('ref', property.ref)
      .first();
    
    let newProperty = null;
    
    if (existingProperty) {
      // El inmueble ya existe, verificar si hay cambios
      if (existingProperty.hash_datos === nuevoHash) {
        // No hay cambios en los datos
        console.log(`Inmueble #${property.ref}: Sin cambios en los datos`);
        stats.inmuebles_sin_cambios++;
        
        // Verificar si el inmueble tiene estados guardados en inmuebles_estados
        const estadosGuardados = await db('inmuebles_estados')
          .where('inmueble_ref', property.ref)
          .where('codigo_sincronizacion', property.codigo_sincronizacion || '')
          .first();
        
        // Si hay estados guardados, usar esos valores
        // Si no hay estados guardados, mantener los valores actuales
        const valorActivo = estadosGuardados ? estadosGuardados.activo : existingProperty.activo;
        const valorDestacado = estadosGuardados ? estadosGuardados.destacado : existingProperty.destacado;
        const valorEnCaliente = estadosGuardados ? estadosGuardados.en_caliente : (existingProperty.en_caliente || false);
        
        console.log(`Inmueble #${property.ref}: Manteniendo estados (activo=${valorActivo}, destacado=${valorDestacado}, en_caliente=${valorEnCaliente})`);
        
        // Actualizar solo la fecha de actualización sin cambiar los estados personalizados
        await db('inmuebles')
          .where('ref', property.ref)
          .update({ 
            fecha_actualizacion: db.fn.now()
          });
          
        // Procesar características aunque no haya cambios en los datos principales
        if (property.caracteristicas && property.caracteristicas.length > 0) {
          await processCharacteristics(existingProperty.id, property.caracteristicas);
        }
      } else {
        // Hay cambios en los datos
        console.log(`Inmueble #${property.ref}: Actualizando datos`);
        stats.inmuebles_actualizados++;
        
        // Verificar si el inmueble tiene estados guardados en inmuebles_estados
        const estadosGuardados = await db('inmuebles_estados')
          .where('inmueble_ref', property.ref)
          .where('codigo_sincronizacion', property.codigo_sincronizacion || '')
          .first();
        
        // Si hay estados guardados, usar esos valores
        // Si no hay estados guardados, mantener los valores actuales
        const valorActivo = estadosGuardados ? estadosGuardados.activo : existingProperty.activo;
        const valorDestacado = estadosGuardados ? estadosGuardados.destacado : existingProperty.destacado;
        const valorEnCaliente = estadosGuardados ? estadosGuardados.en_caliente : (existingProperty.en_caliente || false);
        
        console.log(`Inmueble #${property.ref}: Manteniendo estados (activo=${valorActivo}, destacado=${valorDestacado}, en_caliente=${valorEnCaliente})`);
        
        // Generar el slug si no existe o si ha cambiado el código de sincronización
        let slug = existingProperty.slug;
        if (!slug || (property.codigo_sincronizacion !== existingProperty.codigo_sincronizacion)) {
          console.log(`Inmueble #${property.ref}: Datos para generar slug:`, {
            codigo_sincronizacion: property.codigo_sincronizacion || 'N/A',
            titulo: property.titulo || 'N/A',
            tipo_inmueble_nombre: property.tipo_inmueble_nombre || 'N/A',
            ciudad_nombre: property.ciudad_nombre || 'N/A'
          });
          slug = generateSlug(property);
          console.log(`Inmueble #${property.ref}: Generando slug: ${slug}`);
        } else {
          console.log(`Inmueble #${property.ref}: Manteniendo slug existente: ${slug}`);
        }
        
        // Actualizar los datos del inmueble sin modificar los estados personalizados
        await db('inmuebles')
          .where('ref', property.ref)
          .update({
            titulo: property.titulo,
            slug: slug, // Agregar el slug al lado del título
            descripcion: property.descripcion,
            descripcion_corta: property.descripcion_corta,
            area_construida: property.area_construida,
            area_privada: property.area_privada,
            area_terreno: property.area_terreno,
            area: property.area_construida, // También actualizamos area para compatibilidad
            habitaciones: property.habitaciones,
            banos: property.banos,
            garajes: property.garajes,
            estrato: property.estrato,
            precio_venta: property.precio_venta,
            precio_canon: property.precio_canon,
            precio_administracion: property.precio_administracion,
            latitud: property.latitud,
            longitud: property.longitud,
            direccion: property.direccion,
            tipo_consignacion_id: property.tipo_consignacion_id,
            // No actualizamos los campos relacionales para mantener los valores existentes
            // ciudad_id, barrio_id, tipo_inmueble_id, uso_inmueble_id, estado_inmueble_id, asesor_id se mantienen
            hash_datos: nuevoHash,
            // Mantenemos los valores de activo, destacado y en_caliente que ya tenía o los guardados
            activo: valorActivo,
            destacado: valorDestacado,
            en_caliente: valorEnCaliente,
            fecha_actualizacion: db.fn.now()
          });
          
        // Si alguno de los estados ha cambiado, actualizar inmuebles_estados
        if (existingProperty.activo !== valorActivo || existingProperty.destacado !== valorDestacado || existingProperty.en_caliente !== valorEnCaliente) {
          await managePropertyStates(property.ref, property.codigo_sincronizacion, valorActivo, valorDestacado, valorEnCaliente);
          console.log(`Inmueble #${property.ref}: Estados actualizados (activo=${valorActivo}, destacado=${valorDestacado}, en_caliente=${valorEnCaliente})`);
        }
          
        // Procesar características para inmuebles actualizados
        if (property.caracteristicas && property.caracteristicas.length > 0) {
          await processCharacteristics(existingProperty.id, property.caracteristicas);
        }
        
        // Registrar el cambio en el historial
        if (trackChanges) {
          // En lugar de guardar todo el objeto, guardamos los cambios específicos
          // Comparamos los campos que han cambiado
          const changedFields = [];
          
          // Lista de campos a comparar
          const fieldsToCompare = [
            'titulo', 'descripcion', 'area', 'habitaciones', 'banos',
            'garajes', 'estrato', 'precio_venta', 'precio_canon',
            'precio_administracion', 'latitud', 'longitud', 'direccion'
          ];
          
          // Registrar cada campo que ha cambiado
          for (const field of fieldsToCompare) {
            if (existingProperty[field] !== property[field] && 
                (existingProperty[field] !== null || property[field] !== null)) {
              changedFields.push({
                inmueble_id: existingProperty.id,
                campo: field,
                valor_anterior: existingProperty[field],
                valor_nuevo: property[field],
                fecha_cambio: db.fn.now()
              });
            }
          }
          
          // Si hay campos que cambiaron, registrarlos
          if (changedFields.length > 0) {
            for (const change of changedFields) {
              await db('historial_cambios').insert(change);
            }
            console.log(`Inmueble #${property.ref}: Registrados ${changedFields.length} cambios en el historial`);
          }
        }
      }
    } else {
      // El inmueble no existe, crearlo
      console.log(`Inmueble #${property.ref}: Nuevo inmueble`);
      stats.inmuebles_nuevos++;
      
      // Verificar si el inmueble tiene estados guardados en inmuebles_estados
      const estadosGuardados = await db('inmuebles_estados')
        .where('inmueble_ref', property.ref)
        .where('codigo_sincronizacion', property.codigo_sincronizacion || '')
        .first();
      
      // Si hay estados guardados, usar esos valores
      // Si no hay estados guardados, usar valores por defecto (activo=true, destacado=false)
      const valorActivo = estadosGuardados ? estadosGuardados.activo : true;
      const valorDestacado = estadosGuardados ? estadosGuardados.destacado : false;
      
      console.log(`Inmueble #${property.ref}: ${estadosGuardados ? 'Restaurando' : 'Estableciendo'} estados (activo=${valorActivo}, destacado=${valorDestacado})`);
      
      // Generar el slug inicial si es posible (con código de sincronización)
      // Para inmuebles nuevos sin código de sincronización, el slug se actualizará después de la inserción
      let initialSlug = generateSlug(property);
      console.log(`Inmueble #${property.ref}: Generando slug inicial: ${initialSlug || 'pendiente (se generará con ID)'}`);      
      
      // Insertar el inmueble
      const [newId] = await db('inmuebles').insert({
        ref: property.ref,
        codigo_sincronizacion: property.codigo_sincronizacion,
        titulo: property.titulo,
        slug: initialSlug, // Agregar el slug al lado del título
        descripcion: property.descripcion,
        descripcion_corta: property.descripcion_corta,
        ciudad_id: property.ciudad_id,
        ciudad_nombre: property.ciudad_nombre,
        barrio_id: property.barrio_id,
        barrio_nombre: property.barrio_nombre,
        tipo_inmueble_id: property.tipo_inmueble_id,
        tipo_inmueble_nombre: property.tipo_inmueble_nombre,
        uso_inmueble_id: property.uso_inmueble_id,
        uso_inmueble_nombre: property.uso_inmueble_nombre,
        estado_inmueble_id: property.estado_inmueble_id,
        estado_inmueble_nombre: property.estado_inmueble_nombre,
        tipo_consignacion_id: property.tipo_consignacion_id,
        tipo_consignacion_nombre: property.tipo_consignacion_nombre,
        asesor_id: property.asesor_id || 1,
        asesor_nombre: property.asesor_nombre,
        area_construida: property.area_construida,
        area_privada: property.area_privada,
        area_terreno: property.area_terreno,
        area: property.area_construida, // También actualizamos area para compatibilidad
        habitaciones: property.habitaciones,
        banos: property.banos,
        garajes: property.garajes,
        estrato: property.estrato,
        precio_venta: property.precio_venta,
        precio_canon: property.precio_canon,
        precio_administracion: property.precio_administracion,
        precio_total: property.precio_total,
        direccion: property.direccion,
        latitud: property.latitud,
        longitud: property.longitud,
        hash_datos: nuevoHash,
        // Usar el valor de activo guardado o true por defecto
        activo: valorActivo,
        destacado: valorDestacado, // Usar el valor de destacado guardado o false por defecto
        fecha_creacion: db.fn.now(),
        fecha_actualizacion: db.fn.now(),
        fecha_sincronizacion: db.fn.now()
      });
      
      // Obtenemos el ID del inmueble recién creado para procesar características
      newProperty = await db('inmuebles')
        .where('ref', property.ref)
        .first();
      
      // Procesar características para nuevos inmuebles
      if (newProperty && property.caracteristicas && property.caracteristicas.length > 0) {
        await processCharacteristics(newProperty.id, property.caracteristicas);
      }
      
      // Si no se pudo generar el slug inicialmente porque no había código de sincronización,
      // ahora podemos generarlo con el ID
      if (!initialSlug && newProperty) {
        const slugWithId = generateSlug(newProperty);
        console.log(`Inmueble #${property.ref}: Actualizando slug con ID: ${slugWithId}`);
        await db('inmuebles')
          .where('id', newProperty.id)
          .update({ slug: slugWithId });
      }
      
      // Registrar el cambio en el historial para un nuevo inmueble
      if (trackChanges && newProperty) {
        // Para un nuevo inmueble, registramos la creación como un cambio en cada campo
        const fieldsToRecord = [
          'titulo', 'descripcion', 'area', 'habitaciones', 'banos',
          'garajes', 'estrato', 'precio_venta', 'precio_canon',
          'precio_administracion', 'latitud', 'longitud', 'direccion'
        ];
        
        if (newProperty) {
          // Registrar cada campo como nuevo
          for (const field of fieldsToRecord) {
            if (property[field] !== null && property[field] !== undefined) {
              await db('historial_cambios').insert({
                inmueble_id: newProperty.id,
                campo: field,
                valor_anterior: null,
                valor_nuevo: property[field],
                fecha_cambio: db.fn.now()
              });
            }
          }
          console.log(`Inmueble #${property.ref}: Registrada creación en el historial`);
        }
      }
    }
    
    // Procesar imágenes
    if (downloadImages && property.imagenes && Array.isArray(property.imagenes)) {
      // Obtener el ID interno del inmueble
      const inmuebleRecord = await db('inmuebles').where('ref', property.ref).first('id');
      if (inmuebleRecord && inmuebleRecord.id) {
        await processImages(inmuebleRecord.id, property.ref, property.imagenes);
      } else {
        console.error(`Error: No se pudo encontrar el ID interno para el inmueble #${property.ref}`);
      }
    }
    
    // Finalizar medición de tiempo para este inmueble
    const duration = perfLogger.end(`inmueble_${property.ref}`);
    console.log(`Inmueble #${property.ref}: Procesamiento completado en ${duration.toFixed(2)}ms`);
    
    // Si es un inmueble existente, usar su ID, si es nuevo usar el ID recién creado
    const propertyId = existingProperty ? existingProperty.id : (newProperty && newProperty.id ? newProperty.id : null);
    return { propertyId, propertyRef: property.ref };
  } catch (error) {
    // Finalizar medición de tiempo incluso en caso de error
    if (perfLogger.isRunning(`inmueble_${property.ref}`)) {
      perfLogger.end(`inmueble_${property.ref}`);
    }
    
    console.error(`Error al procesar inmueble #${property.ref}: ${error.message}`);
    throw error;
  }
}

// Función para procesar características de un inmueble
async function processCharacteristics(propertyId, characteristics) {
  try {
    if (!characteristics || !Array.isArray(characteristics) || characteristics.length === 0) {
      return;
    }
    
    console.log(`Procesando ${characteristics.length} características para inmueble #${propertyId}`);
    
    // Eliminar características existentes para este inmueble
    await db('inmueble_caracteristicas')
      .where('inmueble_id', propertyId)
      .delete();
    
    // Insertar características
    for (const characteristic of characteristics) {
      try {
        // Verificar si la característica ya existe en la base de datos
        let caracteristicaRow = await db('caracteristicas')
          .where('nombre', characteristic.nombre)
          .first();
        
        let caracteristicaId;
        
        if (caracteristicaRow) {
          // Si la característica existe, usar su ID
          caracteristicaId = caracteristicaRow.id;
        } else {
          // Si no existe la característica, crearla
          try {
            const [newId] = await db('caracteristicas').insert({
              nombre: characteristic.nombre,
              tipo: characteristic.tipo || 'texto',
              unidad: characteristic.unidad || null,
              descripcion: characteristic.descripcion || null,
              created_at: db.fn.now(),
              updated_at: db.fn.now()
            });
            caracteristicaId = newId;
          } catch (insertError) {
            // Si hay un error de duplicado, intentar obtener el ID nuevamente
            if (insertError.code === 'ER_DUP_ENTRY') {
              const existingRow = await db('caracteristicas')
                .where('nombre', characteristic.nombre)
                .first();
              
              if (existingRow) {
                caracteristicaId = existingRow.id;
              } else {
                console.error(`No se pudo obtener ID para característica '${characteristic.nombre}': ${insertError.message}`);
                continue; // Saltar esta característica
              }
            } else {
              throw insertError; // Re-lanzar otros errores
            }
          }
        }
        
        // Determinar el tipo de característica basado en el valor
        let tipo = caracteristicaRow ? caracteristicaRow.tipo : (characteristic.tipo || 'texto');
        let valorTexto = null;
        let valorNumerico = null;
        let valorBooleano = null;
        
        if (tipo === 'booleano') {
          valorBooleano = (characteristic.valor === true || characteristic.valor === 'true' || 
                          characteristic.valor === 'Si' || characteristic.valor === 'si') ? 1 : 0;
        } else if (tipo === 'numerico') {
          valorNumerico = !isNaN(parseFloat(characteristic.valor)) ? parseFloat(characteristic.valor) : null;
        } else {
          // tipo texto
          valorTexto = characteristic.valor !== null && characteristic.valor !== undefined ? 
            characteristic.valor.toString() : null;
        }
        
        // Insertar relación inmueble-característica
        await db('inmueble_caracteristicas').insert({
          inmueble_id: propertyId,
          caracteristica_id: caracteristicaId,
          valor_texto: valorTexto,
          valor_numerico: valorNumerico,
          valor_booleano: valorBooleano,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
      } catch (charError) {
        console.error(`Error procesando característica '${characteristic.nombre}' para inmueble #${propertyId}: ${charError.message}`);
      }
    }
    
    console.log(`Inmueble #${propertyId}: Características procesadas correctamente`);
  } catch (error) {
    console.error(`Error al procesar características para inmueble #${propertyId}: ${error.message}`);
  }
}

// Función para optimizar una imagen con Sharp
async function optimizeImage(inputPath, outputPath, options = {}) {
  try {
    // Opciones por defecto
    const defaults = {
      quality: 80,
      width: 1200,
      format: 'jpeg'
    };
    
    // Combinar opciones por defecto con las proporcionadas
    const settings = { ...defaults, ...options };
    
    // Si la ruta de entrada y salida son iguales, crear un archivo temporal
    const isSamePath = inputPath === outputPath;
    const tempPath = isSamePath ? `${outputPath}.temp` : outputPath;
    
    // Leer metadatos de la imagen original
    const metadata = await sharp(inputPath).metadata();
    
    // Calcular nuevo ancho manteniendo la relación de aspecto
    const width = Math.min(metadata.width, settings.width);
    
    // Procesar la imagen
    await sharp(inputPath)
      .resize(width) // Redimensionar manteniendo la relación de aspecto
      .toFormat(settings.format, { quality: settings.quality })
      .toFile(tempPath);
    
    // Si es la misma ruta, reemplazar el archivo original
    if (isSamePath) {
      fs.unlinkSync(inputPath); // Eliminar el archivo original
      fs.renameSync(tempPath, outputPath); // Renombrar el archivo temporal
    }
    
    // Obtener estadísticas de tamaño
    const originalSize = fs.statSync(inputPath).size;
    const optimizedSize = fs.statSync(outputPath).size;
    const savingsPercent = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
    
    return {
      success: true,
      originalSize,
      optimizedSize,
      savings: originalSize - optimizedSize,
      savingsPercent,
      width,
      height: Math.round(width * (metadata.height / metadata.width))
    };
  } catch (error) {
    console.error(`Error al optimizar imagen ${inputPath}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Función para calcular el hash MD5 de una imagen
async function calculateImageHash(imagePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(imagePath);
      
      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    } catch (error) {
      reject(error);
    }
  });
}

// Función para procesar imágenes
// Función optimizada para procesar imágenes en paralelo
async function processImagesParallel(propertyId, propertyRef, images, maxConcurrent = 3) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    console.log(`Inmueble #${propertyRef}: No hay imágenes para procesar`);
    return [];
  }
  
  perfLogger.start(`imagenes_${propertyRef}`);
  console.log(`Inmueble #${propertyRef}: Procesando ${images.length} imágenes en paralelo (máx ${maxConcurrent} simultáneas)...`);
  
  // Crear carpeta para las imágenes del inmueble
  const propertyFolder = path.join(config.imagesFolder, `inmueble_${propertyRef}`);
  if (!fs.existsSync(propertyFolder)) {
    fs.mkdirSync(propertyFolder, { recursive: true });
  }
  
  // Obtener imágenes existentes de la base de datos (usar caché si está disponible)
  const cacheKey = `imagenes_${propertyId}`;
  let existingImages = cache.get(cacheKey);
  
  if (existingImages === null) {
    try {
      existingImages = await db('imagenes')
        .where('inmueble_id', propertyId)
        .select('id', 'url', 'url_local', 'orden');
      
      // Guardar en caché
      cache.set(cacheKey, existingImages);
      
      if (existingImages.length > 0) {
        console.log(`Inmueble #${propertyRef}: Se encontraron ${existingImages.length} imágenes en la base de datos`);
      }
    } catch (dbError) {
      console.log(`Inmueble #${propertyRef}: No se pudieron obtener imágenes de la base de datos: ${dbError.message}`);
      existingImages = [];
    }
  } else {
    console.log(`Inmueble #${propertyRef}: Usando caché para ${existingImages.length} imágenes existentes`);
  }
  
  // Mapear URLs existentes para comparación rápida
  const existingUrlMap = new Map();
  existingImages.forEach(img => {
    existingUrlMap.set(img.url, img);
  });
  
  // Preparar tareas para procesar imágenes
  const tasks = [];
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const imageUrl = image.url || image.imagen || image.src || image;
    const orden = i + 1;
    
    if (!imageUrl) {
      console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} no tiene URL`);
      continue;
    }
    
    tasks.push({
      orden,
      imageUrl,
      process: async () => {
        try {
          // Obtener nombre de archivo de la URL
          const urlParts = imageUrl.split('/');
          const originalFilename = urlParts[urlParts.length - 1];
          
          // Crear nombre de archivo local
          const localFilename = `${propertyRef}_${orden}_${originalFilename}`;
          const localPath = path.join(propertyFolder, localFilename);
          
          let hash = null;
          let existingImage = null;
          
          // Verificar si la imagen ya existe en la base de datos
          if (existingUrlMap.has(imageUrl)) {
            existingImage = existingUrlMap.get(imageUrl);
            console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} ya existe en la base de datos (ID: ${existingImage.id})`);
            
            // Si la imagen ya existe y tiene la misma ruta local, no descargarla de nuevo
            if (existingImage.url_local && fs.existsSync(existingImage.url_local)) {
              console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} ya existe localmente en ${existingImage.url_local}`);
              
              return {
                id: existingImage.id,
                url: imageUrl,
                url_local: existingImage.url_local,
                orden: i,
                descargada: 1
              };
            }
          }
          
          // Si la imagen no está registrada en la base de datos, verificar si existe en el sistema de archivos
          if (!existingImage && fs.existsSync(localPath)) {
            // Si la imagen ya existe en disco, calcular su hash
            hash = await calculateImageHash(localPath);
            console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} ya existe localmente con hash ${hash}`);
          } else {
            // Descargar la imagen
            try {
              console.log(`Inmueble #${propertyRef}: Descargando imagen ${orden}/${images.length} desde ${imageUrl}`);
              
              const response = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'stream'
              });
              
              // Guardar la imagen en el sistema de archivos
              const writer = fs.createWriteStream(localPath);
              response.data.pipe(writer);
              
              await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
              });
              
              // Optimizar la imagen descargada
              console.log(`Inmueble #${propertyRef}: Optimizando imagen ${orden}/${images.length}...`);
              const optimizeResult = await optimizeImage(localPath, localPath, {
                quality: 80,
                width: 1200,
                format: 'jpeg'
              });
              
              if (optimizeResult.success) {
                console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} optimizada: ${optimizeResult.savingsPercent}% de ahorro (${(optimizeResult.savings / 1024).toFixed(2)} KB)`);
                stats.imagenes_optimizadas = (stats.imagenes_optimizadas || 0) + 1;
              }
              
              // Calcular el hash de la imagen optimizada
              hash = await calculateImageHash(localPath);
              console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} descargada y optimizada con hash ${hash}`);
              
              stats.imagenes_descargadas++;
            } catch (downloadError) {
              console.error(`Error al descargar imagen ${orden}/${images.length}: ${downloadError.message}`);
              stats.errores_imagenes++;
              return null;
            }
          }
          
          // Si la imagen ya existe en la base de datos, actualizarla
          if (existingImage) {
            await db('imagenes')
              .where('id', existingImage.id)
              .update({
                orden: i,
                updated_at: db.fn.now()
              });
            
            console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} actualizada en la base de datos (ID: ${existingImage.id})`);
            
            return {
              id: existingImage.id,
              url: imageUrl,
              url_local: localPath,
              orden: i,
              descargada: 1
            };
          }
          
          // Si la imagen no existe en la base de datos, insertarla
          const [imageId] = await db('imagenes').insert({
            inmueble_id: propertyId,
            url: imageUrl,
            url_local: localPath,
            orden: i,
            created_at: db.fn.now(),
            updated_at: db.fn.now()
          });
          
          console.log(`Inmueble #${propertyRef}: Imagen ${orden}/${images.length} insertada en la base de datos (ID: ${imageId})`);
          stats.imagenes_nuevas++;
          
          return {
            id: imageId,
            url: imageUrl,
            url_local: localPath,
            orden: i,
            descargada: 1
          };
        } catch (error) {
          console.error(`Error al procesar imagen ${orden} para inmueble #${propertyRef}: ${error.message}`);
          return null;
        }
      }
    });
  }
  
  // Procesar imágenes en lotes con límite de concurrencia
  const processedImages = [];
  
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent);
    
    // Procesar este lote en paralelo
    const batchResults = await Promise.all(batch.map(task => task.process()));
    
    // Filtrar resultados nulos y añadir a imágenes procesadas
    batchResults.filter(result => result !== null).forEach(result => {
      processedImages.push(result);
    });
    
    // Mostrar progreso
    console.log(`Inmueble #${propertyRef}: Procesadas ${Math.min(i + batch.length, tasks.length)}/${tasks.length} imágenes`);
  }
  
  // Mostrar tiempo total de procesamiento de imágenes
  const duration = perfLogger.end(`imagenes_${propertyRef}`);
  console.log(`Inmueble #${propertyRef}: Procesamiento de imágenes completado en ${duration.toFixed(2)}ms`);
  
  return processedImages;
}

async function processImages(propertyId, propertyRef, images) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    console.log(`Inmueble #${propertyRef}: No hay imágenes para procesar`);
    return [];
  }
  
  // Usar la versión optimizada para procesar imágenes en paralelo
  return processImagesParallel(propertyId, propertyRef, images, 3);
  
  console.log(`Inmueble #${propertyRef}: Procesando ${images.length} imágenes...`);
  
  // Crear carpeta para las imágenes del inmueble
  const propertyFolder = path.join(config.imagesFolder, `inmueble_${propertyRef}`);
  if (!fs.existsSync(propertyFolder)) {
    fs.mkdirSync(propertyFolder, { recursive: true });
  }
  
  // Obtener imágenes existentes en la base de datos
  let existingImages = [];
  try {
    existingImages = await db('imagenes')
      .where('inmueble_id', propertyId)
      .select('id', 'url', 'url_local', 'orden');
    
    if (existingImages.length > 0) {
      console.log(`Inmueble #${propertyRef}: Se encontraron ${existingImages.length} imágenes en la base de datos`);
    }
  } catch (dbError) {
    console.log(`Inmueble #${propertyRef}: No se pudieron obtener imágenes de la base de datos: ${dbError.message}`);
    existingImages = [];
  }
  
  // Mapear URLs existentes para comparación rápida
  const existingUrlMap = new Map();
  existingImages.forEach(img => {
    existingUrlMap.set(img.url, img);
  });
  
  const processedImages = [];
  
  // Procesar cada imagen
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const imageUrl = image.url || image.imagen || image.src || image;
    
    if (!imageUrl) {
      console.log(`Inmueble #${propertyRef}: Imagen ${i+1}/${images.length} no tiene URL`);
      continue;
    }
    
    try {
      // Obtener nombre de archivo de la URL
      const urlParts = imageUrl.split('/');
      const originalFilename = urlParts[urlParts.length - 1];
      
      // Crear nombre de archivo local
      const localFilename = `${propertyRef}_${i+1}_${originalFilename}`;
      const localPath = path.join(propertyFolder, localFilename);
      
      let hash = null;
      let imageRegistered = false;
      let existingImageId = null;
      
      // Verificar si la imagen ya existe en la base de datos
      if (existingUrlMap.has(imageUrl)) {
        const existingImage = existingUrlMap.get(imageUrl);
        existingImageId = existingImage.id;
        
        // Si la imagen ya existe y tiene la misma ruta local, no descargarla de nuevo
        if (fs.existsSync(existingImage.url_local)) {
          console.log(`Inmueble #${propertyRef}: Imagen ${i+1}/${images.length} ya existe localmente en ${existingImage.url_local}`);
          
          // Agregar la imagen a la lista de procesadas con su ID existente
          processedImages.push({
            id: existingImage.id,
            url: imageUrl,
            url_local: existingImage.url_local,
            orden: i,
            descargada: 1
          });
          
          imageRegistered = true;
          continue; // Pasar a la siguiente imagen
        } 
        console.log(`Inmueble #${propertyRef}: Imagen ${i+1}/${images.length} existe en la base de datos pero no en disco, descargando nuevamente`);
      }
      
      // Si la imagen no está registrada en la base de datos, verificar si existe en el sistema de archivos
      if (!imageRegistered && fs.existsSync(localPath)) {
        // Si la imagen ya existe en disco, calcular su hash
        hash = await calculateImageHash(localPath);
        console.log(`Inmueble #${propertyRef}: Imagen ${i+1}/${images.length} ya existe localmente con hash ${hash}`);
        
        processedImages.push({
          url: imageUrl,
          url_local: localPath,
          orden: i,
          descargada: 1
        });
        
        imageRegistered = true;
      }
      
      // Si la imagen no está registrada y no existe en disco, descargarla
      if (!imageRegistered) {
        console.log(`Inmueble #${propertyRef}: Descargando imagen ${i+1}/${images.length}: ${imageUrl}`);
        
        try {
          // Descargar la imagen
          const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'arraybuffer'
          });
          
          // Guardar la imagen localmente
          fs.writeFileSync(localPath, response.data);
          
          // Calcular hash MD5 de la imagen
          hash = await calculateImageHash(localPath);
          console.log(`Inmueble #${propertyRef}: Imagen ${i+1}/${images.length} descargada con hash ${hash}`);
          
          // Agregar la imagen a la lista de procesadas
          processedImages.push({
            url: imageUrl,
            url_local: localPath,
            orden: i,
            descargada: 1
          });
          
          // Incrementar contador de imágenes descargadas
          stats.imagenes_descargadas++;
        } catch (downloadError) {
          console.error(`Error al descargar imagen ${i+1}/${images.length} para inmueble #${propertyRef}: ${downloadError.message}`);
          continue; // Pasar a la siguiente imagen
        }
      }
    } catch (error) {
      console.error(`Error al procesar imagen ${i+1}/${images.length} para inmueble #${propertyRef}: ${error.message}`);
    }
  }
  
  // Guardar las imágenes procesadas en la base de datos
  try {
    // Eliminar imágenes existentes que ya no están en la lista actual
    if (existingImages.length > 0) {
      const processedUrls = processedImages.map(img => img.url);
      const imagesToDelete = existingImages.filter(img => !processedUrls.includes(img.url));
      
      if (imagesToDelete.length > 0) {
        console.log(`Inmueble #${propertyRef}: Eliminando ${imagesToDelete.length} imágenes obsoletas de la base de datos`);
        await db('imagenes')
          .whereIn('id', imagesToDelete.map(img => img.id))
          .delete();
      }
    }
    
    // Insertar o actualizar imágenes en la base de datos
    for (const img of processedImages) {
      if (img.id) {
        // Actualizar imagen existente
        await db('imagenes')
          .where('id', img.id)
          .update({
            orden: img.orden,
            updated_at: db.fn.now()
          });
      } else {
        // Insertar nueva imagen
        await db('imagenes').insert({
          inmueble_id: propertyId,
          url: img.url,
          url_local: img.url_local,
          orden: img.orden,
          descargada: img.descargada || 1
          // created_at y updated_at se generan automáticamente por MySQL
        });
      }
    }
    
    console.log(`Inmueble #${propertyRef}: ${processedImages.length} imágenes guardadas en la base de datos`);
  } catch (dbError) {
    console.error(`Error al guardar imágenes en la base de datos para inmueble #${propertyRef}: ${dbError.message}`);
  }
  
  return processedImages;
}

// Función para actualizar la ejecución
async function updateExecution(estado, error = null) {
  if (!executionId) {
    console.log('No se especificó ID de ejecución, no se actualizará el registro');
    return;
  }
  
  try {
    console.log(`Actualizando ejecución ${executionId} con estado: ${estado}`);
    
    const updateData = {
      fecha_fin: db.fn.now(),
      estado,
      total_inmuebles: stats.inmuebles_procesados,
      nuevos: stats.inmuebles_nuevos,
      actualizados: stats.inmuebles_actualizados,
      sin_cambios: stats.inmuebles_sin_cambios,
      errores: stats.errores
    };
    
    if (error) {
      updateData.error = error;
    }
    
    await db('ejecuciones')
      .where('id', executionId)
      .update(updateData);
    
    console.log(`Ejecución ${executionId} actualizada correctamente`);
  } catch (updateError) {
    console.error(`Error actualizando ejecución: ${updateError.message}`);
  }
}

// Ejecutar la función principal
main().catch(error => {
  console.error(`Error fatal: ${error.message}`);
  process.exit(1);
});
