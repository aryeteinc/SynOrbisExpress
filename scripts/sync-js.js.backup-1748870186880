/**
 * Script para sincronizar datos desde el servidor de Orbis (versión JavaScript)
 * 
 * Este script es una versión simplificada que no depende de TypeScript
 * para evitar errores de compilación.
 * 
 * Uso:
 * node sync-js.js [--execution-id=ID] [--limite=100] [--no-imagenes]
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const knex = require('knex');

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

// Estadísticas
let stats = {
  inmuebles_procesados: 0,
  inmuebles_nuevos: 0,
  inmuebles_actualizados: 0,
  inmuebles_sin_cambios: 0,
  imagenes_descargadas: 0,
  imagenes_eliminadas: 0,
  errores: 0,
  inicio: new Date()
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
          .update({ activo: false, fechaActualizacion: db.fn.now() });
        
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
    
    // Procesar cada inmueble
    const activeRefs = [];
    let count = 0;
    
    for (const property of propertiesToProcess) {
      count++;
      console.log(`\nProcesando inmueble #${count}/${propertiesToProcess.length}: Ref ${property.ref}`);
      
      try {
        // Procesar el inmueble
        await processProperty(property, downloadImages, trackChanges);
        activeRefs.push(property.ref);
      } catch (error) {
        console.error(`ERROR al procesar inmueble #${property.ref}: ${error.message}`);
        stats.errores++;
      }
      
      // Mostrar progreso
      const progressPercent = Math.round((count / propertiesToProcess.length) * 100);
      console.log(`\nProgreso total: ${progressPercent}% [${count}/${propertiesToProcess.length}]`);
    }
    
    // Actualizar la ejecución con las estadísticas
    await updateExecution('completado');
    
    // Mostrar estadísticas
    console.log('\n='.repeat(70));
    console.log('RESULTADOS DE LA SINCRONIZACIÓN');
    console.log('='.repeat(70));
    
    const endTime = new Date();
    const durationMs = endTime.getTime() - stats.inicio.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = Math.floor((durationMs % 60000) / 1000);
    
    console.log(`Tiempo de ejecución: ${durationMinutes} minutos, ${durationSeconds} segundos`);
    console.log(`Total inmuebles procesados: ${stats.inmuebles_procesados}`);
    console.log(`Inmuebles nuevos: ${stats.inmuebles_nuevos}`);
    console.log(`Inmuebles actualizados: ${stats.inmuebles_actualizados}`);
    console.log(`Inmuebles sin cambios: ${stats.inmuebles_sin_cambios}`);
    console.log(`Imágenes descargadas: ${stats.imagenes_descargadas}`);
    console.log(`Errores: ${stats.errores}`);
    
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

// Función para procesar las características de un inmueble
async function processCharacteristics(propertyId, characteristics) {
  try {
    if (!characteristics || !Array.isArray(characteristics) || characteristics.length === 0) {
      return;
    }
    
    console.log(`Procesando ${characteristics.length} características para inmueble #${propertyId}`);
    
    // Eliminar características existentes para este inmueble
    await db('inmueble_caracteristicas').where('inmueble_id', propertyId).delete();
    
    // Procesar cada característica
    for (const caracteristica of characteristics) {
      // Verificar si la característica ya existe en la base de datos
      let caracteristicaId = null;
      const caracteristicaExistente = await db('caracteristicas')
        .where('nombre', caracteristica.nombre)
        .first();
      
      // Determinar el tipo de característica basado en el valor
      let tipo = 'texto';
      if (caracteristica.valor === 'true' || caracteristica.valor === 'false' || 
          caracteristica.valor === true || caracteristica.valor === false) {
        tipo = 'booleano';
      } else if (!isNaN(parseFloat(caracteristica.valor)) && caracteristica.valor !== '') {
        tipo = 'numerico';
      }
      
      if (caracteristicaExistente) {
        caracteristicaId = caracteristicaExistente.id;
      } else {
        // Crear nueva característica
        const [newId] = await db('caracteristicas').insert({
          nombre: caracteristica.nombre,
          tipo: tipo,
          descripcion: caracteristica.descripcion || null,
          unidad: caracteristica.unidad || null,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
        caracteristicaId = newId;
      }
      
      // Preparar los valores para las diferentes columnas
      let valorTexto = null;
      let valorNumerico = null;
      let valorBooleano = null;
      
      if (tipo === 'booleano') {
        valorBooleano = (caracteristica.valor === true || caracteristica.valor === 'true');
      } else if (tipo === 'numerico') {
        valorNumerico = parseFloat(caracteristica.valor);
      } else {
        // tipo texto
        valorTexto = caracteristica.valor !== null && caracteristica.valor !== undefined ? 
          caracteristica.valor.toString() : null;
      }
      
      // Guardar la relación inmueble-característica
      await db('inmueble_caracteristicas').insert({
        inmueble_id: propertyId,
        caracteristica_id: caracteristicaId,
        valor_texto: valorTexto,
        valor_numerico: valorNumerico,
        valor_booleano: valorBooleano,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
    }
    
    console.log(`Características guardadas para inmueble #${propertyId}`);
  } catch (error) {
    console.error(`Error procesando características para inmueble #${propertyId}: ${error.message}`);
  }
}

// Función para generar el slug de un inmueble
function generateSlug(codigoSincronizacion, id) {
  if (codigoSincronizacion && codigoSincronizacion.trim() !== '') {
    return `inmueble-${codigoSincronizacion}`;
  } else if (id) {
    return `ncr-${id}`;
  }
  return null; // Si no hay código ni ID, retornar null (se generará después de la inserción)
}

// Función para procesar un inmueble
async function processProperty(property, downloadImages = true, trackChanges = true) {
  try {
    stats.inmuebles_procesados++;
    
    // Verificar si el inmueble ya existe
    const existingProperty = await db('inmuebles')
      .where('ref', property.ref)
      .first();
    
    // Guardar los nombres de los campos relacionales para referencia
    // Estos podrían ser útiles en el futuro si se implementan las tablas de referencia
    const ciudad_nombre = property.ciudad_nombre;
    const barrio_nombre = property.barrio_nombre;
    const tipo_inmueble_nombre = property.tipo_inmueble_nombre;
    const uso_inmueble_nombre = property.uso_inmueble_nombre;
    const estado_inmueble_nombre = property.estado_inmueble_nombre;
    const tipo_consignacion_nombre = property.tipo_consignacion_nombre;
    
    // Registrar en consola los valores relacionales para depuración
    console.log(`Inmueble #${property.ref}: Datos relacionales:`);  
    console.log(`  Ciudad: ${ciudad_nombre}`);  
    console.log(`  Barrio: ${barrio_nombre}`);  
    console.log(`  Tipo: ${tipo_inmueble_nombre}`);  
    console.log(`  Uso: ${uso_inmueble_nombre}`);  
    console.log(`  Estado: ${estado_inmueble_nombre}`);
    console.log(`  Tipo Consignación: ${tipo_consignacion_nombre}`);
    
    // Preservar campos relacionales si el inmueble ya existe
    if (existingProperty) {
      // Mantener los campos relacionales que ya existen en la base de datos
      property.ciudad_id = existingProperty.ciudad_id;
      property.barrio_id = existingProperty.barrio_id;
      property.tipo_inmueble_id = existingProperty.tipo_inmueble_id;
      property.uso_inmueble_id = existingProperty.uso_inmueble_id;
      property.estado_inmueble_id = existingProperty.estado_inmueble_id;
      property.tipo_consignacion_id = existingProperty.tipo_consignacion_id;
      property.asesor_id = existingProperty.asesor_id; // Preservar el asesor_id existente
      
      // Si la descripción corta está vacía, mantener la existente
      if (!property.descripcion_corta && existingProperty.descripcion_corta) {
        property.descripcion_corta = existingProperty.descripcion_corta;
      }
      
      console.log(`Inmueble #${property.ref}: Preservando campos relacionales existentes`); 
    } else {
      // Para nuevos inmuebles, asignar valores predeterminados basados en los nombres si es posible
      property.ciudad_id = 1; // ID predeterminado para ciudad
      property.barrio_id = 1; // ID predeterminado para barrio
      
      // Asignar tipo_inmueble_id basado en el nombre
      if (tipo_inmueble_nombre && tipo_inmueble_nombre.includes('Casa')) {
        property.tipo_inmueble_id = 2; // Casa
      } else if (tipo_inmueble_nombre && tipo_inmueble_nombre.includes('Apartamento')) {
        property.tipo_inmueble_id = 1; // Apartamento
      } else if (tipo_inmueble_nombre && tipo_inmueble_nombre.includes('Local')) {
        property.tipo_inmueble_id = 3; // Local
      } else if (tipo_inmueble_nombre && tipo_inmueble_nombre.includes('Oficina')) {
        property.tipo_inmueble_id = 4; // Oficina
      } else {
        property.tipo_inmueble_id = 2; // Casa (predeterminado)
      }
      
      // Asignar uso_inmueble_id basado en el nombre
      if (uso_inmueble_nombre && uso_inmueble_nombre.includes('Comercial')) {
        property.uso_inmueble_id = 2; // Comercial
        property.uso_id = 2; // Comercial (para compatibilidad)
      } else {
        property.uso_inmueble_id = 1; // Vivienda (predeterminado)
        property.uso_id = 1; // Vivienda (para compatibilidad)
      }
      
      // Asignar estado_inmueble_id basado en el nombre
      if (estado_inmueble_nombre && estado_inmueble_nombre.includes('Arrendado')) {
        property.estado_inmueble_id = 2; // Arrendado
        property.estado_actual_id = 2; // Arrendado (para compatibilidad)
      } else if (estado_inmueble_nombre && estado_inmueble_nombre.includes('Vendido')) {
        property.estado_inmueble_id = 3; // Vendido
        property.estado_actual_id = 3; // Vendido (para compatibilidad)
      } else {
        property.estado_inmueble_id = 1; // Disponible (predeterminado)
        property.estado_actual_id = 1; // Disponible (para compatibilidad)
      }
      
      // Asignar tipo_consignacion_id predeterminado basado en el nombre
      property.tipo_consignacion_id = null; // Valor predeterminado si no se encuentra
      
      console.log(`Inmueble #${property.ref}: Asignando valores predeterminados para campos relacionales`);
      
      // Generar descripción corta a partir de la descripción completa
      if (property.descripcion && property.descripcion.length > 0) {
        // Extraer las primeras 150 caracteres de la descripción
        let descripcionCorta = property.descripcion.substring(0, 150);
        // Si cortamos en medio de una palabra, retroceder hasta el último espacio
        if (descripcionCorta.length === 150 && property.descripcion.length > 150) {
          const lastSpace = descripcionCorta.lastIndexOf(' ');
          if (lastSpace > 100) { // Asegurarse de que no retrocedemos demasiado
            descripcionCorta = descripcionCorta.substring(0, lastSpace);
          }
          descripcionCorta += '...';
        }
        property.descripcion_corta = descripcionCorta;
      } else if (property.titulo) {
        // Si no hay descripción, usar el título
        property.descripcion_corta = property.titulo;
      } else {
        // Si no hay título ni descripción, usar un texto genérico
        property.descripcion_corta = 'Propiedad inmobiliaria disponible';
      }
    }
    
    // Buscar o crear el tipo de consignación
    if (tipo_consignacion_nombre && tipo_consignacion_nombre.trim() !== '') {
      try {
        // Buscar si ya existe el tipo de consignación
        let tipoConsignacion = await db('tipo_consignacion')
          .where('nombre', tipo_consignacion_nombre)
          .first();
        
        if (!tipoConsignacion) {
          // Si no existe, crear nuevo registro
          console.log(`Creando nuevo tipo de consignación: ${tipo_consignacion_nombre}`);
          
          const [tipoConsignacionId] = await db('tipo_consignacion').insert({
            nombre: tipo_consignacion_nombre,
            created_at: db.fn.now(),
            updated_at: db.fn.now()
          });
          
          property.tipo_consignacion_id = tipoConsignacionId;
        } else {
          // Si existe, usar el ID existente
          property.tipo_consignacion_id = tipoConsignacion.id;
        }
        
        console.log(`Asignado tipo de consignación ID: ${property.tipo_consignacion_id} (${tipo_consignacion_nombre})`);
      } catch (error) {
        console.error(`Error al procesar tipo de consignación: ${error.message}`);
        // Si hay error, dejar el valor predeterminado o el existente
      }
    }
    
    // Validar y limpiar precios para evitar errores de rango en MySQL
    // Si el formato es inválido o fuera de rango, se guarda NULL y se deja registro en el log
    ["precio_venta", "precio_canon"].forEach((campo) => {
      if (property[campo] !== undefined && property[campo] !== null && property[campo] !== "") {
        let original = property[campo];
        let valor = original;
        // Si es string, intentar limpiar separadores
        if (typeof valor === "string") {
          // Quitar espacios y símbolos de moneda
          valor = valor.trim().replace(/[$€₡]/g, "");
          // Detectar formato europeo (1.234.567,89) o americano (1,234,567.89)
          if (/\d{1,3}(\.\d{3})+,\d{2}$/.test(valor)) {
            // Europeo: puntos miles, coma decimal
            valor = valor.replace(/\./g, "").replace(/,/g, ".");
          } else {
            // Americano: comas miles, punto decimal
            valor = valor.replace(/,/g, "");
          }
        }
        valor = parseFloat(valor);
        if (isNaN(valor)) {
          console.log(`Inmueble #${property.ref}: ${campo} inválido ('${original}'). Se guarda NULL.`);
          property[campo] = null;
        } else if (valor > 999999999) {
          console.log(`Inmueble #${property.ref}: ${campo} fuera de rango (${valor}). Se guarda NULL.`);
          property[campo] = null;
        } else {
          property[campo] = valor;
        }
      }
    });
    
    if (property.precio_administracion) {
      // Convertir a número si es string
      property.precio_administracion = typeof property.precio_administracion === 'string' ? 
        parseFloat(property.precio_administracion.replace(/[^0-9.]/g, '')) : 
        property.precio_administracion;
      
      // Verificar si el valor es demasiado grande para MySQL
      if (property.precio_administracion > 999999999) {
        console.log(`Inmueble #${property.ref}: Ajustando precio_administracion de ${property.precio_administracion} a 999999999`);
        property.precio_administracion = 999999999;
      }
    }
    
    // Limitar longitud del título para evitar errores en MySQL
    if (property.titulo && property.titulo.length > 255) {
      console.log(`Inmueble #${property.ref}: Truncando título de ${property.titulo.length} caracteres a 255`);
      property.titulo = property.titulo.substring(0, 252) + '...';
    }
    
    // Calcular hash de los datos para detectar cambios
    const dataToHash = {
      ref: property.ref,
      titulo: property.titulo,
      descripcion: property.descripcion,
      area_construida: property.area_construida,
      area_privada: property.area_privada,
      area_terreno: property.area_terreno,
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
    
    const nuevoHash = crypto
      .createHash('md5')
      .update(JSON.stringify(dataToHash))
      .digest('hex');
    
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
        const valorEnCaliente = estadosGuardados ? estadosGuardados.en_caliente : existingProperty.en_caliente;
        
        console.log(`Inmueble #${property.ref}: Manteniendo estados (activo=${valorActivo}, destacado=${valorDestacado}, en_caliente=${valorEnCaliente})`);
        
        // Actualizar solo la fecha de actualización sin cambiar los estados personalizados
        await db('inmuebles')
          .where('ref', property.ref)
          .update({ 
            fechaActualizacion: db.fn.now()
          });
          
        // Procesar características aunque no haya cambios en los datos principales
        if (property.caracteristicas && property.caracteristicas.length > 0) {
          await processCharacteristics(existingProperty.id, property.caracteristicas);
        }
      } else {
        // Hay cambios en los datos
        console.log(`Inmueble #${property.ref}: Actualizando datos`);
        stats.inmuebles_actualizados++;
        
        // --- LOGGING DETALLADO DE PRECIOS ANTES DE INSERTAR/ACTUALIZAR ---
        console.log(`Inmueble #${property.ref}: Valores a insertar/actualizar:`);
        ["precio_venta", "precio_canon"].forEach((campo) => {
          const valor = property[campo];
          console.log(`  ${campo}:`, valor, `| typeof:`, typeof valor);
        });
        // --- FIN LOGGING DETALLADO ---
        
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
          slug = generateSlug(property.codigo_sincronizacion, existingProperty.id);
          console.log(`Inmueble #${property.ref}: Generando slug: ${slug}`);
        }
        
        // Actualizar los datos del inmueble sin modificar los estados personalizados
        await db('inmuebles')
          .where('ref', property.ref)
          .update({
            titulo: property.titulo,
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
            slug: slug, // Actualizamos el slug
            fechaActualizacion: db.fn.now()
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
            'titulo', 'descripcion', 'area_construida', 'area_privada', 'area_terreno', 'habitaciones', 'banos',
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
      let initialSlug = generateSlug(property.codigo_sincronizacion, null);
      console.log(`Inmueble #${property.ref}: Generando slug inicial: ${initialSlug || 'pendiente (se generará con ID)'}`);      
      
      // Insertar el inmueble
      const [newId] = await db('inmuebles').insert({
        ref: property.ref,
        codigo_sincronizacion: property.codigo_sincronizacion,
        titulo: property.titulo,
        descripcion: property.descripcion,
        descripcion_corta: property.descripcion_corta,
        direccion: property.direccion,
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
        ciudad_id: property.ciudad_id,
        barrio_id: property.barrio_id,
        tipo_inmueble_id: property.tipo_inmueble_id,
        uso_inmueble_id: property.uso_inmueble_id,
        uso_id: property.uso_id, // Añadido para compatibilidad
        estado_inmueble_id: property.estado_inmueble_id,
        estado_actual_id: property.estado_actual_id, // Añadido para compatibilidad
        tipo_consignacion_id: property.tipo_consignacion_id,
        asesor_id: property.asesor_id || 1,
        hash_datos: nuevoHash,
        slug: initialSlug, // Asignar el slug inicial (puede ser null si no hay código de sincronización)
        activo: valorActivo, // Usar el valor de activo guardado o true por defecto
        destacado: valorDestacado, // Usar el valor de destacado guardado o false por defecto
        fechaCreacion: db.fn.now(),
        fechaActualizacion: db.fn.now(),
        fecha_sincronizacion: db.fn.now()
      });
      
      // Obtenemos el ID del inmueble recién creado para procesar características
      const newProperty = await db('inmuebles')
        .where('ref', property.ref)
        .first();
      
      // Procesar características para nuevos inmuebles
      if (newProperty && property.caracteristicas && property.caracteristicas.length > 0) {
        await processCharacteristics(newProperty.id, property.caracteristicas);
      }
      
      // Si no se pudo generar el slug inicialmente porque no había código de sincronización,
      // ahora podemos generarlo con el ID
      if (!initialSlug && newProperty) {
        const slugWithId = generateSlug(null, newProperty.id);
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
    
    return property.ref;
  } catch (error) {
    console.error(`Error procesando inmueble #${property.ref}: ${error.message}`);
    stats.errores++;
    throw error;
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
async function processImages(propertyId, propertyRef, images) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    console.log(`Inmueble #${propertyRef}: No hay imágenes para procesar`);
    return [];
  }
  
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
