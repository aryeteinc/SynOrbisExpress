/**
 * Script para verificar el estado de los registros en la base de datos
 */

const knex = require('knex');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
const dbConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3307', 10),
    user: process.env.MYSQL_USER || 'syncorbis',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DATABASE || 'inmuebles'
  }
};

// Crear la conexión a la base de datos
const db = knex(dbConfig);

async function checkDatabase() {
  try {
    console.log('Verificando registros en la tabla inmuebles...');
    
    // Consultar inmuebles y su tipo de consignación, incluyendo los campos activo y destacado
    const inmuebles = await db('inmuebles')
      .select(
        'inmuebles.id', 
        'inmuebles.ref', 
        'inmuebles.tipo_consignacion_id', 
        'tipo_consignacion.nombre as tipo_consignacion_nombre',
        'inmuebles.activo',
        'inmuebles.destacado',
        'inmuebles.en_caliente'
      )
      .leftJoin('tipo_consignacion', 'inmuebles.tipo_consignacion_id', 'tipo_consignacion.id')
      .limit(5);
    
    console.log('\nRegistros de inmuebles:');
    console.table(inmuebles);
    
    // Verificar los tipos de consignación disponibles
    const tiposConsignacion = await db('tipo_consignacion').select('*');
    
    console.log('\nTipos de consignación disponibles:');
    console.table(tiposConsignacion);
    
    // Verificar si hay registros en la tabla inmuebles_estados
    const hasInmueblesEstadosTable = await db.schema.hasTable('inmuebles_estados');
    
    if (hasInmueblesEstadosTable) {
      // Verificar si existen estados personalizados guardados
      const estadosPersonalizados = await db('inmuebles_estados')
        .select('id', 'inmueble_ref', 'codigo_sincronizacion', 'activo', 'destacado', 'en_caliente', 'fecha_modificacion', 'created_at', 'updated_at');
      
      console.log('\nEstados personalizados guardados en inmuebles_estados:');
      if (estadosPersonalizados.length > 0) {
        console.table(estadosPersonalizados);
      } else {
        console.log('No hay estados personalizados guardados.');
      }
    } else {
      console.log('\nLa tabla inmuebles_estados no existe.');
    }
    
    // Consultar etiquetas disponibles
    const etiquetas = await db('etiquetas')
      .select('id', 'nombre', 'color', 'descripcion', 'created_at', 'updated_at');
    
    console.log('\nEtiquetas disponibles:');
    if (etiquetas.length > 0) {
      console.table(etiquetas);
    } else {
      console.log('No hay etiquetas disponibles.');
    }
    
    // Consultar relaciones entre inmuebles y etiquetas
    const inmueblesEtiquetas = await db('inmuebles_etiquetas as ie')
      .join('inmuebles as i', 'i.id', 'ie.inmueble_id')
      .join('etiquetas as e', 'e.id', 'ie.etiqueta_id')
      .select('ie.id', 'i.ref as inmueble_ref', 'e.nombre as etiqueta_nombre', 'e.color', 'ie.created_at')
      .orderBy('i.ref');
    
    console.log('\nRelaciones entre inmuebles y etiquetas:');
    if (inmueblesEtiquetas.length > 0) {
      console.table(inmueblesEtiquetas);
    } else {
      console.log('No hay relaciones entre inmuebles y etiquetas.');
    }
    
    // Cerrar la conexión
    await db.destroy();
  } catch (error) {
    console.error('Error al verificar la base de datos:', error);
    process.exit(1);
  }
}

// Ejecutar la función
checkDatabase();
