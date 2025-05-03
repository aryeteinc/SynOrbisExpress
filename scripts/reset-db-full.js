/**
 * Script para resetear completamente la base de datos
 * 
 * Este script elimina TODAS las tablas y datos, incluyendo etiquetas y estados personalizados.
 * Usar con precaución ya que no preserva ningún dato personalizado.
 * 
 * Uso:
 * node reset-db-full.js [--sin-catalogos]
 */

const knex = require('knex');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos
const args = process.argv.slice(2);
const sinCatalogos = args.includes('--sin-catalogos');

// Configuración de la base de datos
let config = {
  dbType: process.env.DB_TYPE || 'sqlite'
};

// Configurar la conexión a la base de datos según el tipo
let dbConfig;

if (config.dbType.toLowerCase() === 'mysql') {
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
      filename: process.env.SQLITE_PATH || 'inmuebles_db.sqlite'
    },
    useNullAsDefault: true
  };
}

// Crear la conexión a la base de datos
const db = knex(dbConfig);

// Función para eliminar todas las tablas
async function dropAllTables() {
  try {
    console.log('Desactivando restricciones de clave foránea...');
    
    // Desactivar restricciones de clave foránea
    if (config.dbType === 'sqlite') {
      await db.raw('PRAGMA foreign_keys = OFF');
    } else {
      await db.raw('SET FOREIGN_KEY_CHECKS = 0');
    }
    
    console.log('Obteniendo lista de tablas...');
    
    let tables = [];
    
    // Obtener lista de tablas según el tipo de base de datos
    if (config.dbType === 'sqlite') {
      const result = await db.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      tables = result.map(row => row.name);
    } else {
      const result = await db.raw('SHOW TABLES');
      const key = Object.keys(result[0][0])[0];
      tables = result[0].map(row => row[key]);
    }
    
    console.log(`Se encontraron ${tables.length} tablas:`, tables);
    
    // Eliminar cada tabla
    for (const table of tables) {
      console.log(`Eliminando tabla: ${table}`);
      await db.schema.dropTableIfExists(table);
    }
    
    console.log('Todas las tablas han sido eliminadas.');
    
    // Reactivar restricciones de clave foránea
    if (config.dbType === 'sqlite') {
      await db.raw('PRAGMA foreign_keys = ON');
    } else {
      await db.raw('SET FOREIGN_KEY_CHECKS = 1');
    }
    
    console.log('Restricciones de clave foránea reactivadas.');
  } catch (error) {
    console.error('Error al eliminar tablas:', error);
    throw error;
  }
}

// Función para crear todas las tablas
async function createAllTables() {
  try {
    console.log('Creando tablas...');
    
    // Tabla ciudades
    if (!await db.schema.hasTable('ciudades')) {
      await db.schema.createTable('ciudades', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('departamento');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla ciudades creada');
    }
    
    // Tabla barrios
    if (!await db.schema.hasTable('barrios')) {
      await db.schema.createTable('barrios', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.integer('ciudad_id').unsigned();
        table.foreign('ciudad_id').references('id').inTable('ciudades');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla barrios creada');
    }
    
    // Tabla tipos_inmueble
    if (!await db.schema.hasTable('tipos_inmueble')) {
      await db.schema.createTable('tipos_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla tipos_inmueble creada');
    }
    
    // Tabla usos_inmueble
    if (!await db.schema.hasTable('usos_inmueble')) {
      await db.schema.createTable('usos_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla usos_inmueble creada');
    }
    
    // Tabla estados_inmueble
    if (!await db.schema.hasTable('estados_inmueble')) {
      await db.schema.createTable('estados_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla estados_inmueble creada');
    }
    
    // Tabla tipo_consignacion
    if (!await db.schema.hasTable('tipo_consignacion')) {
      await db.schema.createTable('tipo_consignacion', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('descripcion').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla tipo_consignacion creada');
    }
    
    // Tabla asesores
    if (!await db.schema.hasTable('asesores')) {
      await db.schema.createTable('asesores', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('telefono');
        table.string('email');
        table.string('foto');
        table.boolean('activo').defaultTo(true);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla asesores creada');
    }
    
    // Tabla inmuebles
    if (!await db.schema.hasTable('inmuebles')) {
      await db.schema.createTable('inmuebles', table => {
        table.increments('id').primary();
        table.integer('ref').notNullable().unique();
        table.string('codigo_sincronizacion');
        table.string('titulo');
        table.text('descripcion');
        table.text('descripcion_corta');
        table.integer('ciudad_id').unsigned();
        table.foreign('ciudad_id').references('id').inTable('ciudades');
        table.string('ciudad_nombre');
        table.integer('barrio_id').unsigned();
        table.foreign('barrio_id').references('id').inTable('barrios');
        table.string('barrio_nombre');
        table.integer('tipo_inmueble_id').unsigned();
        table.foreign('tipo_inmueble_id').references('id').inTable('tipos_inmueble');
        table.string('tipo_inmueble_nombre');
        table.integer('uso_inmueble_id').unsigned();
        table.foreign('uso_inmueble_id').references('id').inTable('usos_inmueble');
        table.string('uso_inmueble_nombre');
        table.integer('estado_inmueble_id').unsigned();
        table.foreign('estado_inmueble_id').references('id').inTable('estados_inmueble');
        table.string('estado_inmueble_nombre');
        table.integer('tipo_consignacion_id').unsigned();
        table.foreign('tipo_consignacion_id').references('id').inTable('tipo_consignacion');
        table.string('tipo_consignacion_nombre');
        table.integer('asesor_id').unsigned();
        table.foreign('asesor_id').references('id').inTable('asesores');
        table.string('asesor_nombre');
        table.decimal('area_construida', 15, 2);
        table.decimal('area_privada', 15, 2);
        table.decimal('area_terreno', 15, 2);
        table.decimal('area', 15, 2);
        table.integer('habitaciones');
        table.integer('banos');
        table.integer('garajes');
        table.integer('estrato');
        table.decimal('precio_venta', 15, 2);
        table.decimal('precio_canon', 15, 2);
        table.decimal('precio_administracion', 15, 2);
        table.decimal('precio_total', 15, 2);
        table.string('direccion');
        table.string('latitud');
        table.string('longitud');
        table.boolean('activo').defaultTo(true);
        table.boolean('destacado').defaultTo(false);
        table.boolean('en_caliente').defaultTo(false);
        table.timestamp('fecha_actualizacion').defaultTo(db.fn.now());
        table.timestamp('fecha_creacion').defaultTo(db.fn.now());
        table.timestamp('fecha_sincronizacion').defaultTo(db.fn.now());
        table.text('hash_datos');
      });
      console.log('Tabla inmuebles creada');
    }
    
    // Tabla inmuebles_estados
    if (!await db.schema.hasTable('inmuebles_estados')) {
      await db.schema.createTable('inmuebles_estados', table => {
        table.increments('id').primary();
        table.integer('inmueble_ref').notNullable().comment('Referencia del inmueble (campo ref de la tabla inmuebles)');
        table.string('codigo_sincronizacion').notNullable().comment('Código de sincronización del inmueble');
        table.boolean('activo').defaultTo(false).comment('Estado del campo activo que debe mantenerse entre sincronizaciones');
        table.boolean('destacado').defaultTo(false).comment('Estado del campo destacado que debe mantenerse entre sincronizaciones');
        table.boolean('en_caliente').defaultTo(false).comment('Estado del campo en_caliente que debe mantenerse entre sincronizaciones');
        table.timestamp('fecha_modificacion').defaultTo(db.fn.now());
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla inmuebles_estados creada');
    }
    
    // Tabla caracteristicas
    if (!await db.schema.hasTable('caracteristicas')) {
      await db.schema.createTable('caracteristicas', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.enum('tipo', ['booleano', 'numerico', 'texto']).defaultTo('texto');
        table.string('unidad').nullable();
        table.string('descripcion').nullable();
        table.timestamps(true, true);
      });
      console.log('Tabla caracteristicas creada');
    }
    
    // Tabla inmueble_caracteristicas
    if (!await db.schema.hasTable('inmueble_caracteristicas')) {
      await db.schema.createTable('inmueble_caracteristicas', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.integer('caracteristica_id').unsigned().references('id').inTable('caracteristicas');
        table.string('valor_texto').nullable();
        table.decimal('valor_numerico', 15, 2).nullable();
        table.boolean('valor_booleano').nullable();
        table.timestamps(true, true);
      });
      console.log('Tabla inmueble_caracteristicas creada');
    }
    
    // Tabla historial_cambios
    if (!await db.schema.hasTable('historial_cambios')) {
      await db.schema.createTable('historial_cambios', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.string('campo').notNullable();
        table.text('valor_anterior').nullable();
        table.text('valor_nuevo').nullable();
        table.timestamp('fecha_cambio').defaultTo(db.fn.now());
      });
      console.log('Tabla historial_cambios creada');
    }
    
    // Tabla imagenes
    if (!await db.schema.hasTable('imagenes')) {
      await db.schema.createTable('imagenes', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned();
        table.foreign('inmueble_id').references('id').inTable('inmuebles').onDelete('CASCADE');
        table.string('url').notNullable();
        table.string('url_local');
        table.integer('orden').defaultTo(0);
        table.boolean('descargada').defaultTo(false);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla imagenes creada');
    }
    
    // Tabla ejecuciones
    if (!await db.schema.hasTable('ejecuciones')) {
      await db.schema.createTable('ejecuciones', table => {
        table.increments('id').primary();
        table.string('tipo').notNullable();
        table.integer('total_inmuebles').defaultTo(0);
        table.integer('inmuebles_nuevos').defaultTo(0);
        table.integer('inmuebles_actualizados').defaultTo(0);
        table.integer('inmuebles_sin_cambios').defaultTo(0);
        table.integer('imagenes_descargadas').defaultTo(0);
        table.integer('errores').defaultTo(0);
        table.integer('tiempo_ejecucion').defaultTo(0);
        table.timestamp('fecha_inicio').defaultTo(db.fn.now());
        table.timestamp('fecha_fin').defaultTo(db.fn.now());
      });
      console.log('Tabla ejecuciones creada');
    }
    
    // Tabla etiquetas
    if (!await db.schema.hasTable('etiquetas')) {
      await db.schema.createTable('etiquetas', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique().comment('Nombre de la etiqueta');
        table.string('color').defaultTo('#3498db').comment('Color en formato hexadecimal');
        table.text('descripcion').nullable().comment('Descripción de la etiqueta');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla etiquetas creada');
    }
    
    // Tabla inmuebles_etiquetas
    if (!await db.schema.hasTable('inmuebles_etiquetas')) {
      await db.schema.createTable('inmuebles_etiquetas', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().notNullable();
        table.integer('etiqueta_id').unsigned().notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        
        // Índices y claves foráneas
        table.unique(['inmueble_id', 'etiqueta_id']);
        table.foreign('inmueble_id').references('id').inTable('inmuebles').onDelete('CASCADE');
        table.foreign('etiqueta_id').references('id').inTable('etiquetas').onDelete('CASCADE');
      });
      console.log('Tabla inmuebles_etiquetas creada');
    }
    
    console.log('Todas las tablas han sido creadas.');
  } catch (error) {
    console.error('Error al crear tablas:', error);
    throw error;
  }
}

// Función para insertar datos de catálogo
async function insertCatalogData() {
  try {
    if (sinCatalogos) {
      console.log('Omitiendo inserción de datos de catálogo (--sin-catalogos)');
      return;
    }
    
    console.log('Insertando datos de catálogo...');
    
    // Insertar tipos de consignación predeterminados
    await db('tipo_consignacion').insert([
      { nombre: 'Venta', descripcion: 'Inmuebles para venta' },
      { nombre: 'Arriendo', descripcion: 'Inmuebles para arriendo' },
      { nombre: 'Venta y Arriendo', descripcion: 'Inmuebles disponibles tanto para venta como para arriendo' }
    ]);
    console.log('Tipos de consignación insertados');
    
    // Insertar etiquetas predeterminadas
    await db('etiquetas').insert([
      { nombre: 'Promoción', color: '#e74c3c', descripcion: 'Inmuebles en promoción especial' },
      { nombre: 'Nuevo', color: '#2ecc71', descripcion: 'Inmuebles recién añadidos' },
      { nombre: 'Rebajado', color: '#f39c12', descripcion: 'Inmuebles con precio rebajado' },
      { nombre: 'Exclusivo', color: '#9b59b6', descripcion: 'Inmuebles exclusivos' },
      { nombre: 'Oportunidad', color: '#e67e22', descripcion: 'Oportunidades de inversión' }
    ]);
    console.log('Etiquetas predeterminadas insertadas');
    
    console.log('Datos de catálogo insertados correctamente.');
  } catch (error) {
    console.error('Error al insertar datos de catálogo:', error);
    throw error;
  }
}

// Función para crear directorios necesarios
async function createDirectories() {
  try {
    console.log('Creando directorios necesarios...');
    
    // Directorio para imágenes
    const imagesDir = path.join(__dirname, '..', 'public', 'images', 'inmuebles');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`Directorio creado: ${imagesDir}`);
    } else {
      console.log(`El directorio ya existe: ${imagesDir}`);
    }
    
    console.log('Directorios creados correctamente.');
  } catch (error) {
    console.error('Error al crear directorios:', error);
    throw error;
  }
}

// Función principal
async function main() {
  try {
    console.log('Iniciando reseteo completo de la base de datos...');
    
    // Eliminar todas las tablas
    await dropAllTables();
    
    // Crear todas las tablas
    await createAllTables();
    
    // Insertar datos de catálogo
    await insertCatalogData();
    
    // Crear directorios necesarios
    await createDirectories();
    
    console.log('Reseteo completo de la base de datos finalizado con éxito.');
  } catch (error) {
    console.error('Error durante el reseteo de la base de datos:', error);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Ejecutar la función principal
main();
