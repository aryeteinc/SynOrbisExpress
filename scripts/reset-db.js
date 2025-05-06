 /**
 * Script para reiniciar la base de datos y permitir una sincronización desde cero
 * 
 * Este script elimina todas las tablas relacionadas con inmuebles y las vuelve a crear
 * con su estructura correcta. También elimina todas las imágenes descargadas.
 * 
 * Uso:
 * node reset-db.js [--confirmar]
 */

const fs = require('fs');
const path = require('path');
const knex = require('knex');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos
const args = process.argv.slice(2);
const confirmar = args.some(arg => arg === '--confirmar');
const sinCatalogos = args.some(arg => arg === '--sin-catalogos');

if (!confirmar) {
  console.log('ADVERTENCIA: Este script eliminará TODOS los datos de inmuebles y sus imágenes.');
  console.log('Opciones disponibles:');
  console.log('  --confirmar       Confirma la ejecución del script');
  console.log('  --sin-catalogos   No inserta los datos de catálogo (ciudades, barrios, etc.)');
  console.log('Ejemplo: node reset-db.js --confirmar');
  console.log('Ejemplo: node reset-db.js --confirmar --sin-catalogos');
  process.exit(1);
}

// Configuración
const config = {
  dbType: process.env.DB_TYPE || 'sqlite',
  sqlitePath: process.env.SQLITE_PATH || 'inmuebles_db.sqlite',
  mysqlHost: process.env.MYSQL_HOST || 'localhost',
  mysqlPort: process.env.MYSQL_PORT || 3306,
  mysqlUser: process.env.MYSQL_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || 'rootpassword',
  mysqlDatabase: process.env.MYSQL_DATABASE || 'inmuebles',
  imagesFolder: process.env.IMAGES_FOLDER || path.join(__dirname, '../public/images/inmuebles')
};

// Inicializar conexión a la base de datos
let db;

if (config.dbType === 'mysql') {
  console.log('Configurando conexión a MySQL...');
  db = knex({
    client: 'mysql2',
    connection: {
      host: config.mysqlHost,
      port: config.mysqlPort,
      user: config.mysqlUser,
      password: config.mysqlPassword,
      database: config.mysqlDatabase
    }
  });
} else {
  console.log('Configurando conexión a SQLite...');
  db = knex({
    client: 'sqlite3',
    connection: {
      filename: config.sqlitePath
    },
    useNullAsDefault: true
  });
}

// Función para insertar datos de catálogo necesarios
async function insertCatalogData() {
  try {
    console.log('Insertando datos de catálogo iniciales...');
    
    // Insertar ciudades
    const ciudades = [
      { nombre: 'Sincelejo (Suc)' },
      { nombre: 'Bogotá' },
      { nombre: 'Medellín' },
      { nombre: 'Cali' },
      { nombre: 'Barranquilla' }
    ];
    
    for (const ciudad of ciudades) {
      try {
        await db('ciudades').insert(ciudad);
      } catch (error) {
        // Ignorar errores de duplicados
        if (!error.message.includes('Duplicate entry')) {
          console.error(`Error al insertar ciudad ${ciudad.nombre}: ${error.message}`);
        }
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
      try {
        await db('barrios').insert(barrio);
      } catch (error) {
        // Ignorar errores de duplicados
        if (!error.message.includes('Duplicate entry')) {
          console.error(`Error al insertar barrio ${barrio.nombre}: ${error.message}`);
        }
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
      try {
        await db('tipos_inmueble').insert(tipo);
      } catch (error) {
        // Ignorar errores de duplicados
        if (!error.message.includes('Duplicate entry')) {
          console.error(`Error al insertar tipo de inmueble ${tipo.nombre}: ${error.message}`);
        }
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
      try {
        await db('usos_inmueble').insert(uso);
      } catch (error) {
        // Ignorar errores de duplicados
        if (!error.message.includes('Duplicate entry')) {
          console.error(`Error al insertar uso de inmueble ${uso.nombre}: ${error.message}`);
        }
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
      try {
        await db('estados_inmueble').insert(estado);
      } catch (error) {
        // Ignorar errores de duplicados
        if (!error.message.includes('Duplicate entry')) {
          console.error(`Error al insertar estado de inmueble ${estado.nombre}: ${error.message}`);
        }
      }
    }
    
    // Insertar asesor por defecto si no existe
    try {
      await db('asesores').insert({
        id: 1,
        nombre: 'Asesor Por Defecto',
        email: 'asesor@ejemplo.com',
        telefono: '123456789'
      });
    } catch (error) {
      // Ignorar errores de duplicados
      if (!error.message.includes('Duplicate entry')) {
        console.error(`Error al insertar asesor por defecto: ${error.message}`);
      }
    }
    
    console.log('Datos de catálogo insertados correctamente.');
  } catch (error) {
    console.error(`Error al insertar datos de catálogo: ${error.message}`);
  }
}

async function resetDatabase() {
  console.log('Iniciando reinicio de la base de datos...');
  
  try {
    // Probar la conexión a la base de datos
    try {
      await db.raw('SELECT 1');
      console.log('Conexión a la base de datos establecida correctamente.');
    } catch (dbError) {
      console.error(`Error conectando a la base de datos: ${dbError.message}`);
      process.exit(1);
    }
    
    // 1. Eliminar tablas si existen
    console.log('Eliminando tablas existentes...');
    
    // Desactivar restricciones de clave foránea temporalmente
    if (config.dbType === 'sqlite') {
      await db.raw('PRAGMA foreign_keys = OFF');
    } else if (config.dbType === 'mysql') {
      await db.raw('SET FOREIGN_KEY_CHECKS = 0');
    }
    
    // Vaciar todas las tablas existentes
    try {
      if (config.dbType === 'mysql') {
        console.log(`Vaciando todas las tablas de la base de datos ${config.mysqlDatabase}...`);
        
        // Desactivar verificación de claves foráneas para poder vaciar las tablas en cualquier orden
        await db.raw('SET FOREIGN_KEY_CHECKS = 0');
        
        // Obtener todas las tablas de la base de datos
        const tablesResult = await db.raw(
          `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${config.mysqlDatabase}'`
        );
        
        // Extraer los nombres de las tablas
        const tables = tablesResult[0].map(row => row.TABLE_NAME);
        console.log(`Tablas encontradas: ${tables.join(', ')}`);
        
        // Vaciar cada tabla
        for (const table of tables) {
          try {
            await db.raw(`TRUNCATE TABLE \`${table}\``);
            console.log(`Tabla ${table} vaciada`);
          } catch (truncateError) {
            console.error(`Error vaciando tabla ${table}: ${truncateError.message}`);
          }
        }
        
        // Reactivar verificación de claves foráneas
        await db.raw('SET FOREIGN_KEY_CHECKS = 1');
      } else {
        // Para SQLite, vaciar todas las tablas existentes
        console.log('Vaciando todas las tablas en SQLite...');
        
        // Lista de tablas a vaciar
        const tablesToEmpty = [
          'historial_cambios',
          'imagenes',
          'inmueble_caracteristicas',
          'caracteristicas',
          'ejecuciones',
          'inmuebles',
          'barrios',
          'ciudades',
          'tipos_inmueble',
          'usos_inmueble',
          'estados_inmueble',
          'asesores',
          'etiquetas',
          'inmuebles_etiquetas'
        ];
        
        // Vaciar cada tabla si existe
        for (const table of tablesToEmpty) {
          try {
            const exists = await db.schema.hasTable(table);
            if (exists) {
              await db(table).delete();
              console.log(`Tabla ${table} vaciada`);
            }
          } catch (error) {
            console.error(`Error vaciando tabla ${table}: ${error.message}`);
          }
        }
      }
      
      console.log('Todas las tablas han sido vaciadas');
    } catch (error) {
      console.error(`Error vaciando las tablas: ${error.message}`);
      process.exit(1);
    }
    
    // Desactivar restricciones de clave foránea antes de eliminar tablas
    if (config.dbType === 'mysql') {
      console.log('Desactivando restricciones de clave foránea...');
      await db.raw('SET FOREIGN_KEY_CHECKS = 0');
    }
    
    // 2. Crear tablas siempre, para asegurar tipos correctos
    // Tabla de inmuebles
    // Eliminar siempre la tabla si existe, para asegurar el tipo correcto
    if (await db.schema.hasTable('inmuebles')) {
      console.log('Eliminando tabla inmuebles...');
      await db.schema.dropTable('inmuebles');
    }
    await db.schema.createTable('inmuebles', table => {
      table.increments('id').primary();
      table.integer('ref').notNullable().unique();
      table.string('codigo_sincronizacion');
      table.integer('ciudad_id').unsigned();
      table.integer('barrio_id').unsigned();
      table.integer('tipo_inmueble_id').unsigned();
      table.integer('uso_id').unsigned();
      table.integer('estado_actual_id').unsigned();
      table.integer('tipo_consignacion_id').unsigned().nullable();
      table.integer('asesor_id').unsigned().defaultTo(1);
      table.string('titulo');
      table.string('direccion');
      table.float('area');
      table.float('area_construida').nullable();
      table.float('area_privada').nullable();
      table.float('area_terreno').nullable();
      table.integer('habitaciones');
      table.integer('banos');
      table.integer('garajes');
      table.integer('estrato');
      table.decimal('precio_venta', 15, 2).nullable();
      table.decimal('precio_canon', 15, 2).nullable();
      table.decimal('precio_administracion', 15, 2).nullable();
      table.text('descripcion');
      table.text('descripcion_corta');
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

    // Tabla de imágenes
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('imagenes'))) {
      await db.schema.createTable('imagenes', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().notNullable();
        table.string('url_original').notNullable();
        table.string('ruta_local');
        table.string('hash_md5');
        table.integer('ancho');
        table.integer('alto');
        table.integer('tamano_bytes');
        table.boolean('es_principal').defaultTo(false);
        table.integer('orden').defaultTo(0);
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
        if (config.dbType === 'mysql') {
          table.foreign('inmueble_id').references('id').inTable('inmuebles').onDelete('CASCADE');
        }
      });
    }

    // Tabla de características
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('caracteristicas'))) {
      await db.schema.createTable('caracteristicas', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('categoria');
        table.string('icono');
      });
    }
    
    // Tabla de relación inmueble-característica
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('inmueble_caracteristicas'))) {
      await db.schema.createTable('inmueble_caracteristicas', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().notNullable();
        table.integer('caracteristica_id').unsigned().notNullable();
        table.string('valor');
        
        // Añadir claves foráneas solo para MySQL
        if (config.dbType === 'mysql') {
          table.foreign('inmueble_id').references('id').inTable('inmuebles').onDelete('CASCADE');
          table.foreign('caracteristica_id').references('id').inTable('caracteristicas').onDelete('CASCADE');
        }
      });
    }
    
    // Tabla de ejecuciones
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('ejecuciones'))) {
      await db.schema.createTable('ejecuciones', table => {
        table.increments('id').primary();
        table.string('estado').defaultTo('pendiente');
        table.datetime('fecha_inicio').defaultTo(db.fn.now());
        table.datetime('fecha_fin');
        table.text('resultado');
        table.text('error');
        table.text('log');  // Añadida columna log para almacenar la salida detallada
        table.integer('total_inmuebles').defaultTo(0);
        table.integer('nuevos').defaultTo(0);
        table.integer('actualizados').defaultTo(0);
        table.integer('sin_cambios').defaultTo(0);
        table.integer('imagenes_descargadas').defaultTo(0);
        table.integer('errores').defaultTo(0);
        table.string('tipo').defaultTo('manual');
        table.string('usuario');
      });
    }
    
    // Tabla de historial de cambios
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('historial_cambios'))) {
      await db.schema.createTable('historial_cambios', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().notNullable();
        table.string('campo').notNullable();
        table.text('valor_anterior');
        table.text('valor_nuevo');
        table.timestamp('fecha_cambio').defaultTo(db.fn.now());
        
        // Añadir clave foránea solo para MySQL
        if (config.dbType === 'mysql') {
          table.foreign('inmueble_id').references('id').inTable('inmuebles').onDelete('CASCADE');
        }
      });
    }
    
    // Tabla para mantener los estados de los inmuebles entre sincronizaciones
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('inmuebles_estados'))) {
      // Si existe la tabla inmuebles_estado anterior, migrarla a la nueva estructura
      const oldTableExists = await db.schema.hasTable('inmuebles_estado');
      let oldData = [];
      
      if (oldTableExists) {
        console.log('Migrando datos de inmuebles_estado a inmuebles_estados...');
        oldData = await db('inmuebles_estado').select('*');
        await db.schema.dropTable('inmuebles_estado');
      }
      
      // Crear la nueva tabla con los campos de estados personalizados
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
        
        // Índices para búsqueda rápida
        table.unique(['inmueble_ref', 'codigo_sincronizacion']);
        table.index('inmueble_ref');
        table.index('codigo_sincronizacion');
      });
      
      // Migrar datos de la tabla anterior si existían
      if (oldData.length > 0) {
        for (const record of oldData) {
          await db('inmuebles_estados').insert({
            inmueble_ref: record.inmueble_ref,
            codigo_sincronizacion: record.codigo_sincronizacion,
            activo: record.activo,
            destacado: false, // Valor por defecto para registros migrados
            en_caliente: false, // Valor por defecto para registros migrados
            fecha_modificacion: record.fecha_modificacion,
            created_at: record.created_at,
            updated_at: record.updated_at
          });
        }
        console.log(`Migrados ${oldData.length} registros a la nueva tabla inmuebles_estados`);
      }
      
      console.log('Tabla inmuebles_estados creada');
    }
    
    // Crear tablas de catálogo
    // Tabla de ciudades
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('ciudades'))) {
      await db.schema.createTable('ciudades', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.string('codigo').nullable();
        table.string('departamento').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla ciudades creada');
    }
    
    // Tabla de barrios
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('barrios'))) {
      await db.schema.createTable('barrios', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.integer('ciudad_id').unsigned().nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
        
        // Añadir clave foránea solo para MySQL
        if (config.dbType === 'mysql') {
          table.foreign('ciudad_id').references('id').inTable('ciudades').onDelete('SET NULL');
        }
      });
      console.log('Tabla barrios creada');
    }
    
    // Tabla de tipos de inmueble
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('tipos_inmueble'))) {
      await db.schema.createTable('tipos_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.string('descripcion').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla tipos_inmueble creada');
    }
    
    // Tabla de usos de inmueble
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('usos_inmueble'))) {
      await db.schema.createTable('usos_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.string('descripcion').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla usos_inmueble creada');
    }
    
    // Tabla de estados de inmueble
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('estados_inmueble'))) {
      await db.schema.createTable('estados_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.string('descripcion').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla estados_inmueble creada');
    }
    
    // Tabla de tipos de consignación
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('tipo_consignacion'))) {
      await db.schema.createTable('tipo_consignacion', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.string('descripcion').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla tipo_consignacion creada');
    }
    
    // Tabla de asesores
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('asesores'))) {
      await db.schema.createTable('asesores', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('apellido').nullable();
        table.string('email').nullable();
        table.string('telefono').nullable();
        table.string('foto').nullable();
        table.boolean('activo').defaultTo(true);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla asesores creada');
    }
    
    // Tabla de etiquetas
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('etiquetas'))) {
      await db.schema.createTable('etiquetas', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.string('color').defaultTo('#3498db');
        table.text('descripcion').nullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla etiquetas creada');
    }
    
    // Tabla de relación muchos a muchos entre inmuebles y etiquetas
    if (config.dbType === 'sqlite' || !(await db.schema.hasTable('inmuebles_etiquetas'))) {
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
    
    // Insertar datos de catálogo básicos si no se especificó --sin-catalogos
    if (!sinCatalogos) {
      console.log('Insertando datos de catálogo iniciales...');
      await insertCatalogData();
      console.log('Datos de catálogo insertados correctamente.');
    } else {
      console.log('Se omitió la inserción de datos de catálogo (--sin-catalogos).');
    }
    
    // Añadir tipos de consignación básicos
    const tiposConsignacion = [
      { nombre: 'Venta' },
      { nombre: 'Arriendo' },
      { nombre: 'Venta y Arriendo' }
    ];
    
    for (const tipo of tiposConsignacion) {
      try {
        await db('tipo_consignacion').insert(tipo);
        console.log(`Tipo de consignación '${tipo.nombre}' insertado`);
      } catch (error) {
        // Ignorar errores de duplicados
        if (!error.message.includes('Duplicate entry')) {
          console.error(`Error al insertar tipo de consignación ${tipo.nombre}: ${error.message}`);
        }
      }
    }
    
    // Insertar etiquetas predeterminadas si la tabla está vacía
    const etiquetasCount = await db('etiquetas').count('id as count').first();
    if (etiquetasCount.count === 0) {
      await db('etiquetas').insert([
        { nombre: 'Promoción', color: '#e74c3c', descripcion: 'Inmuebles en promoción especial' },
        { nombre: 'Nuevo', color: '#2ecc71', descripcion: 'Inmuebles recién añadidos' },
        { nombre: 'Rebajado', color: '#f39c12', descripcion: 'Inmuebles con precio rebajado' },
        { nombre: 'Exclusivo', color: '#9b59b6', descripcion: 'Inmuebles exclusivos' },
        { nombre: 'Oportunidad', color: '#e67e22', descripcion: 'Oportunidades de inversión' }
      ]);
      console.log('Etiquetas predeterminadas insertadas.');
    }
    
    // Reactivar restricciones de clave foránea
    if (config.dbType === 'sqlite') {
      await db.raw('PRAGMA foreign_keys = ON');
    } else if (config.dbType === 'mysql') {
      await db.raw('SET FOREIGN_KEY_CHECKS = 1');
    }
    
    console.log('Tablas creadas correctamente');
    
    // 3. Eliminar imágenes
    console.log('Eliminando imágenes descargadas...');
    
    if (fs.existsSync(config.imagesFolder)) {
      // Eliminar recursivamente el directorio de imágenes
      fs.rmSync(config.imagesFolder, { recursive: true, force: true });
      
      // Recrear el directorio vacío
      fs.mkdirSync(config.imagesFolder, { recursive: true });
      
      console.log('Imágenes eliminadas correctamente');
    } else {
      console.log('El directorio de imágenes no existe, creándolo...');
      fs.mkdirSync(config.imagesFolder, { recursive: true });
    }
    // Reactivar restricciones de clave foránea al finalizar
    if (config.dbType === 'mysql') {
      console.log('Reactivando restricciones de clave foránea...');
      await db.raw('SET FOREIGN_KEY_CHECKS = 1');
    }
    
    console.log('\n¡Base de datos reiniciada correctamente!');
    console.log('Ahora puedes ejecutar una sincronización desde cero.');
    
  } catch (error) {
    console.error('Error reiniciando la base de datos:', error);
    throw error; // Propagar el error para que main() pueda manejarlo
  }
}

// Función para guardar el estado de los inmuebles inactivos
async function saveInactivePropertiesState() {
  console.log('Verificando y guardando estado de inmuebles inactivos...');
  
  try {
    // Verificar si las tablas existen
    const hasInmueblesTable = await db.schema.hasTable('inmuebles');
    if (!hasInmueblesTable) {
      console.log('La tabla inmuebles no existe, no hay estados que guardar.');
      return [];
    }
    
    // Verificar si existe la tabla inmuebles_estados o la antigua inmuebles_estado
    const hasInmueblesEstadosTable = await db.schema.hasTable('inmuebles_estados');
    const hasInmueblesEstadoTable = await db.schema.hasTable('inmuebles_estado');
    
    if (!hasInmueblesEstadosTable && !hasInmueblesEstadoTable) {
      console.log('La tabla inmuebles_estados no existe, se creará durante el reset.');
      return [];
    }
    
    // 1. Obtener todos los inmuebles y sus estados
    const hasDestacadoColumn = await db.schema.hasColumn('inmuebles', 'destacado');
    let allProperties;
    
    if (hasDestacadoColumn) {
      allProperties = await db('inmuebles')
        .select('id', 'ref', 'codigo_sincronizacion', 'activo', 'destacado');
    } else {
      allProperties = await db('inmuebles')
        .select('id', 'ref', 'codigo_sincronizacion', 'activo')
        .then(props => props.map(p => ({ ...p, destacado: false })));
    }
    
    // 2. Obtener todos los registros de estados
    let allPropertyStates = [];
    
    if (hasInmueblesEstadosTable) {
      allPropertyStates = await db('inmuebles_estados')
        .select('id', 'inmueble_ref', 'activo', 'destacado');
    } else if (hasInmueblesEstadoTable) {
      // Migrar datos de la tabla antigua
      allPropertyStates = await db('inmuebles_estado')
        .select('id', 'inmueble_ref', 'activo')
        .then(states => states.map(s => ({ ...s, destacado: false })));
    }
    
    // Crear un mapa de inmuebles por referencia para búsqueda rápida
    const propertiesMap = {};
    allProperties.forEach(prop => {
      propertiesMap[prop.ref] = prop;
    });
    
    // 3. Identificar registros a eliminar (inconsistentes) y a mantener
    const stateRecordsToDelete = [];
    const inactiveProperties = [];
    
    // Verificar cada registro en inmuebles_estado
    for (const state of allPropertyStates) {
      const property = propertiesMap[state.inmueble_ref];
      
      // Si el inmueble no existe o su estado activo no coincide con inmuebles_estado
      if (!property || property.activo !== state.activo) {
        stateRecordsToDelete.push(state.id);
      }
    }
    
    // Identificar inmuebles inactivos que necesitan ser guardados
    for (const property of allProperties) {
      if (property.activo === 0) {
        inactiveProperties.push(property);
      }
    }
    
    // 4. Eliminar registros inconsistentes
    if (stateRecordsToDelete.length > 0) {
      await db('inmuebles_estado')
        .whereIn('id', stateRecordsToDelete)
        .delete();
      console.log(`Se eliminaron ${stateRecordsToDelete.length} registros inconsistentes de inmuebles_estado.`);
    }
    
    // 5. Guardar estado de inmuebles inactivos
    console.log(`Se guardarán ${inactiveProperties.length} estados de inmuebles inactivos.`);
    
    // Si no hay inmuebles inactivos, no hay nada que guardar
    if (inactiveProperties.length === 0) {
      return [];
    }
    
    // Preparar array para retornar los estados guardados
    const savedStates = [];
    
    // Guardar el estado de cada inmueble inactivo en la tabla inmuebles_estado
    for (const property of inactiveProperties) {
      // Verificar si ya existe un registro para este inmueble
      const existingState = await db('inmuebles_estado')
        .where('inmueble_ref', property.ref)
        .first();
      
      if (existingState) {
        // Actualizar el registro existente
        await db('inmuebles_estado')
          .where('id', existingState.id)
          .update({
            activo: 0,
            updated_at: db.fn.now()
          });
      } else {
        // Crear un nuevo registro
        await db('inmuebles_estado').insert({
          inmueble_ref: property.ref,
          codigo_sincronizacion: property.codigo_sincronizacion || '',
          activo: 0,
          fecha_modificacion: db.fn.now(),
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
      }
      
      // Añadir al array de estados guardados
      savedStates.push({
        inmueble_ref: property.ref,
        codigo_sincronizacion: property.codigo_sincronizacion || '',
        activo: 0
      });
    }
    
    return savedStates;
  } catch (error) {
    console.error(`Error al guardar estados de inmuebles inactivos: ${error.message}`);
    return [];
  }
}

// Función para restaurar el estado de los inmuebles inactivos
async function restoreInactivePropertiesState(inactiveStates) {
  try {
    if (!inactiveStates || inactiveStates.length === 0) {
      console.log('No hay estados de inmuebles inactivos para restaurar.');
      return;
    }

    console.log(`Restaurando ${inactiveStates.length} estados de inmuebles inactivos...`);
    
    // Insertar los estados en la tabla inmuebles_estado
    for (const state of inactiveStates) {
      await db('inmuebles_estado').insert({
        inmueble_ref: state.inmueble_ref,
        codigo_sincronizacion: state.codigo_sincronizacion,
        activo: state.activo,
        fecha_modificacion: db.fn.now(),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
    }

    console.log('Estados de inmuebles inactivos restaurados correctamente.');
  } catch (error) {
    console.error(`Error al restaurar estados de inmuebles inactivos: ${error.message}`);
  }
}

// Crear tablas de etiquetas (tags)
async function createTagsTables() {
  try {
    console.log('Creando tablas de etiquetas...');
    
    // Tabla de etiquetas
    if (!await db.schema.hasTable('etiquetas')) {
      await db.schema.createTable('etiquetas', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique().comment('Nombre de la etiqueta');
        table.string('color').defaultTo('#3498db').comment('Color en formato hexadecimal');
        table.text('descripcion').nullable().comment('Descripción de la etiqueta');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Tabla etiquetas creada.');
    } else {
      console.log('La tabla etiquetas ya existe.');
    }
    
    // Tabla de relación muchos a muchos entre inmuebles y etiquetas
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
      console.log('Tabla inmuebles_etiquetas creada.');
    } else {
      console.log('La tabla inmuebles_etiquetas ya existe.');
    }
    
    // Insertar etiquetas predeterminadas si la tabla está vacía
    const etiquetasCount = await db('etiquetas').count('id as count').first();
    if (etiquetasCount.count === 0) {
      await db('etiquetas').insert([
        { nombre: 'Promoción', color: '#e74c3c', descripcion: 'Inmuebles en promoción especial' },
        { nombre: 'Nuevo', color: '#2ecc71', descripcion: 'Inmuebles recién añadidos' },
        { nombre: 'Rebajado', color: '#f39c12', descripcion: 'Inmuebles con precio rebajado' },
        { nombre: 'Exclusivo', color: '#9b59b6', descripcion: 'Inmuebles exclusivos' },
        { nombre: 'Oportunidad', color: '#e67e22', descripcion: 'Oportunidades de inversión' }
      ]);
      console.log('Etiquetas predeterminadas insertadas.');
    }
    
    console.log('Tablas de etiquetas creadas correctamente.');
  } catch (error) {
    console.error('Error al crear las tablas de etiquetas:', error);
    throw error;
  }
}

// Ejecutar reinicio con preservación de estados inactivos
async function main() {
  // 1. Guardar estados de inmuebles inactivos
  const inactiveStates = await saveInactivePropertiesState();
  
  // 2. Resetear la base de datos
  await resetDatabase();
  
  // 3. Restaurar estados de inmuebles inactivos
  await restoreInactivePropertiesState(inactiveStates);
  
  // 4. Cerrar la conexión
  await db.destroy();
  process.exit(0);
}

// Ejecutar el proceso principal
main();
