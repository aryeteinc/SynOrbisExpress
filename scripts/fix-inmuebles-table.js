/**
 * Script para añadir las columnas faltantes a la tabla inmuebles
 * 
 * Este script añade las columnas area_construida, area_privada y area_terreno
 * a la tabla inmuebles si no existen.
 * 
 * Uso:
 * node fix-inmuebles-table.js
 */

const knex = require('knex');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración
const config = {
  dbType: process.env.DB_TYPE || 'mysql',
  mysqlHost: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  mysqlPort: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
  mysqlUser: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  mysqlDatabase: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'inmuebles',
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
    },
    pool: { min: 0, max: 7 }
  });
} else {
  console.error('Este script solo funciona con MySQL');
  process.exit(1);
}

async function fixInmueblesTable() {
  console.log('Iniciando corrección de la tabla inmuebles...');
  
  try {
    // Probar la conexión a la base de datos
    try {
      await db.raw('SELECT 1');
      console.log('Conexión a la base de datos establecida correctamente.');
    } catch (dbError) {
      console.error(`Error conectando a la base de datos: ${dbError.message}`);
      process.exit(1);
    }
    
    // Verificar si la tabla inmuebles existe
    const tableExists = await db.schema.hasTable('inmuebles');
    if (!tableExists) {
      console.error('La tabla inmuebles no existe.');
      process.exit(1);
    }
    
    // Verificar si las columnas ya existen
    const hasAreaConstruida = await db.schema.hasColumn('inmuebles', 'area_construida');
    const hasAreaPrivada = await db.schema.hasColumn('inmuebles', 'area_privada');
    const hasAreaTerreno = await db.schema.hasColumn('inmuebles', 'area_terreno');
    const hasDestacado = await db.schema.hasColumn('inmuebles', 'destacado');
    const hasSlug = await db.schema.hasColumn('inmuebles', 'slug');
    const hasFechaActualizacion = await db.schema.hasColumn('inmuebles', 'fechaActualizacion');
    const hasFechaCreacion = await db.schema.hasColumn('inmuebles', 'fechaCreacion');
    
    // Verificar columnas con nombres inconsistentes
    const hasUsoInmuebleId = await db.schema.hasColumn('inmuebles', 'uso_inmueble_id');
    const hasUsoId = await db.schema.hasColumn('inmuebles', 'uso_id');
    const hasEstadoInmuebleId = await db.schema.hasColumn('inmuebles', 'estado_inmueble_id');
    const hasEstadoActualId = await db.schema.hasColumn('inmuebles', 'estado_actual_id');
    const hasTipoConsignacionId = await db.schema.hasColumn('inmuebles', 'tipo_consignacion_id');
    const hasTitulo = await db.schema.hasColumn('inmuebles', 'titulo');
    
    // Añadir las columnas si no existen
    if (!hasAreaConstruida) {
      console.log('Añadiendo columna area_construida...');
      await db.schema.table('inmuebles', table => {
        table.float('area_construida').nullable();
      });
      console.log('Columna area_construida añadida correctamente.');
    } else {
      console.log('La columna area_construida ya existe.');
    }
    
    if (!hasAreaPrivada) {
      console.log('Añadiendo columna area_privada...');
      await db.schema.table('inmuebles', table => {
        table.float('area_privada').nullable();
      });
      console.log('Columna area_privada añadida correctamente.');
    } else {
      console.log('La columna area_privada ya existe.');
    }
    
    if (!hasAreaTerreno) {
      console.log('Añadiendo columna area_terreno...');
      await db.schema.table('inmuebles', table => {
        table.float('area_terreno').nullable();
      });
      console.log('Columna area_terreno añadida correctamente.');
    } else {
      console.log('La columna area_terreno ya existe.');
    }
    
    if (!hasDestacado) {
      console.log('Añadiendo columna destacado...');
      await db.schema.table('inmuebles', table => {
        table.boolean('destacado').defaultTo(false);
      });
      console.log('Columna destacado añadida correctamente.');
    } else {
      console.log('La columna destacado ya existe.');
    }
    
    if (!hasSlug) {
      console.log('Añadiendo columna slug...');
      await db.schema.table('inmuebles', table => {
        table.string('slug').nullable();
      });
      console.log('Columna slug añadida correctamente.');
    } else {
      console.log('La columna slug ya existe.');
    }
    
    if (!hasFechaActualizacion) {
      console.log('Añadiendo columna fechaActualizacion...');
      await db.schema.table('inmuebles', table => {
        table.timestamp('fechaActualizacion').defaultTo(db.fn.now());
      });
      console.log('Columna fechaActualizacion añadida correctamente.');
    } else {
      console.log('La columna fechaActualizacion ya existe.');
    }
    
    if (!hasFechaCreacion) {
      console.log('Añadiendo columna fechaCreacion...');
      await db.schema.table('inmuebles', table => {
        table.timestamp('fechaCreacion').defaultTo(db.fn.now());
      });
      console.log('Columna fechaCreacion añadida correctamente.');
    } else {
      console.log('La columna fechaCreacion ya existe.');
    }
    
    // Corregir discrepancias en los nombres de las columnas
    // Caso 1: Si existe uso_id pero no uso_inmueble_id, crear uso_inmueble_id como alias
    if (hasUsoId && !hasUsoInmuebleId) {
      console.log('Creando columna uso_inmueble_id como alias de uso_id...');
      try {
        // Crear la columna uso_inmueble_id
        await db.schema.table('inmuebles', table => {
          table.integer('uso_inmueble_id').nullable();
        });
        
        // Copiar los valores de uso_id a uso_inmueble_id
        await db.raw('UPDATE inmuebles SET uso_inmueble_id = uso_id');
        
        console.log('Columna uso_inmueble_id creada y valores copiados correctamente.');
      } catch (error) {
        console.error(`Error al crear uso_inmueble_id: ${error.message}`);
      }
    }
    
    // Caso 2: Si existe estado_actual_id pero no estado_inmueble_id, crear estado_inmueble_id como alias
    if (hasEstadoActualId && !hasEstadoInmuebleId) {
      console.log('Creando columna estado_inmueble_id como alias de estado_actual_id...');
      try {
        // Crear la columna estado_inmueble_id
        await db.schema.table('inmuebles', table => {
          table.integer('estado_inmueble_id').nullable();
        });
        
        // Copiar los valores de estado_actual_id a estado_inmueble_id
        await db.raw('UPDATE inmuebles SET estado_inmueble_id = estado_actual_id');
        
        console.log('Columna estado_inmueble_id creada y valores copiados correctamente.');
      } catch (error) {
        console.error(`Error al crear estado_inmueble_id: ${error.message}`);
      }
    }
    
    // Caso 3: Si no existe tipo_consignacion_id, crearla
    if (!hasTipoConsignacionId) {
      console.log('Creando columna tipo_consignacion_id...');
      try {
        // Crear la columna tipo_consignacion_id
        await db.schema.table('inmuebles', table => {
          table.integer('tipo_consignacion_id').nullable();
        });
        
        // Establecer valores predeterminados basados en precio_venta y precio_canon
        await db.raw(`
          UPDATE inmuebles 
          SET tipo_consignacion_id = 
            CASE 
              WHEN precio_venta > 0 THEN 1 -- Venta
              WHEN precio_canon > 0 THEN 2 -- Arriendo
              ELSE 1 -- Valor predeterminado: Venta
            END
        `);
        
        console.log('Columna tipo_consignacion_id creada y valores inicializados correctamente.');
      } catch (error) {
        console.error(`Error al crear tipo_consignacion_id: ${error.message}`);
      }
    } else {
      console.log('La columna tipo_consignacion_id ya existe.');
    }
    
    // Caso 4: Si no existe titulo, crearla
    if (!hasTitulo) {
      console.log('Creando columna titulo...');
      try {
        // Crear la columna titulo
        await db.schema.table('inmuebles', table => {
          table.string('titulo').nullable();
        });
        
        // Establecer valores predeterminados basados en codigo_sincronizacion
        await db.raw(`
          UPDATE inmuebles 
          SET titulo = CONCAT('Inmueble ', codigo_sincronizacion)
          WHERE codigo_sincronizacion IS NOT NULL
        `);
        
        console.log('Columna titulo creada y valores inicializados correctamente.');
      } catch (error) {
        console.error(`Error al crear titulo: ${error.message}`);
      }
    } else {
      console.log('La columna titulo ya existe.');
    }
    
    console.log('Todas las columnas han sido verificadas y añadidas si eran necesarias.');
    
    // Verificar la estructura de la tabla
    console.log('Verificando estructura de la tabla inmuebles...');
    const columns = await db.raw("SHOW COLUMNS FROM inmuebles");
    const columnNames = columns[0].map(col => col.Field);
    console.log('Columnas en la tabla inmuebles:');
    console.log(columnNames.join(', '));
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Ejecutar la función principal
fixInmueblesTable()
  .then(() => {
    console.log('Proceso completado correctamente.');
    process.exit(0);
  })
  .catch(error => {
    console.error(`Error en el proceso principal: ${error.message}`);
    process.exit(1);
  });
