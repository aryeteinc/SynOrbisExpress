/**
 * Script para crear un trigger en la base de datos que actualice automáticamente
 * la tabla inmuebles_estado cuando se modifique el campo activo en la tabla inmuebles.
 * 
 * Este trigger garantiza que cualquier cambio manual en el campo activo
 * (ya sea directamente en la base de datos o a través de una aplicación)
 * se refleje correctamente en la tabla inmuebles_estado.
 */

require('dotenv').config();
const knex = require('knex');

// Configuración de la base de datos
const dbConfig = {
  client: process.env.DB_CLIENT || 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'syncorbis',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'inmuebles'
  }
};

// Crear conexión a la base de datos
const db = knex(dbConfig);

async function crearTrigger() {
  try {
    console.log('Verificando tipo de base de datos...');
    
    // Verificar el tipo de base de datos
    const dbType = process.env.DB_CLIENT || 'mysql2';
    
    if (dbType.includes('sqlite')) {
      console.log('Base de datos SQLite detectada.');
      await crearTriggerSQLite();
    } else if (dbType.includes('mysql')) {
      console.log('Base de datos MySQL detectada.');
      await crearTriggerMySQL();
    } else {
      console.error(`Error: Tipo de base de datos no soportado: ${dbType}`);
      process.exit(1);
    }
    
    console.log('Trigger creado correctamente.');
  } catch (error) {
    console.error(`Error al crear el trigger: ${error.message}`);
    process.exit(1);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

async function crearTriggerMySQL() {
  console.log('Eliminando trigger existente si existe...');
  
  // Eliminar el trigger si ya existe
  await db.raw('DROP TRIGGER IF EXISTS actualizar_inmuebles_estado');
  
  console.log('Creando trigger para MySQL...');
  
  // Crear el trigger
  await db.raw(`
    CREATE TRIGGER actualizar_inmuebles_estado
    AFTER UPDATE ON inmuebles
    FOR EACH ROW
    BEGIN
      -- Si el campo activo ha cambiado
      IF OLD.activo <> NEW.activo THEN
        -- Si el nuevo valor es 1 (activo), eliminar el registro de inmuebles_estado
        IF NEW.activo = 1 THEN
          DELETE FROM inmuebles_estado WHERE inmueble_ref = NEW.ref;
          
          -- Registrar el cambio en el historial
          INSERT INTO historial_cambios (inmueble_id, campo, valor_anterior, valor_nuevo, fecha_cambio)
          VALUES (NEW.id, 'activo', '0', '1', NOW());
        -- Si el nuevo valor es 0 (inactivo), insertar o actualizar el registro en inmuebles_estado
        ELSE
          -- Verificar si ya existe un registro para este inmueble
          IF EXISTS (SELECT 1 FROM inmuebles_estado WHERE inmueble_ref = NEW.ref) THEN
            -- Actualizar el registro existente
            UPDATE inmuebles_estado 
            SET activo = 0, updated_at = NOW() 
            WHERE inmueble_ref = NEW.ref;
          ELSE
            -- Crear un nuevo registro
            INSERT INTO inmuebles_estado (inmueble_ref, codigo_sincronizacion, activo, fecha_modificacion, created_at, updated_at)
            VALUES (NEW.ref, NEW.codigo_sincronizacion, 0, NOW(), NOW(), NOW());
          END IF;
          
          -- Registrar el cambio en el historial
          INSERT INTO historial_cambios (inmueble_id, campo, valor_anterior, valor_nuevo, fecha_cambio)
          VALUES (NEW.id, 'activo', '1', '0', NOW());
        END IF;
      END IF;
    END
  `);
  
  console.log('Trigger para MySQL creado correctamente.');
}

async function crearTriggerSQLite() {
  console.log('Eliminando triggers existentes si existen...');
  
  // Eliminar los triggers si ya existen
  await db.raw('DROP TRIGGER IF EXISTS actualizar_inmuebles_estado_activar');
  await db.raw('DROP TRIGGER IF EXISTS actualizar_inmuebles_estado_desactivar');
  
  console.log('Creando triggers para SQLite...');
  
  // SQLite no soporta IF/ELSE en triggers, así que creamos dos triggers separados
  
  // Trigger para cuando se activa un inmueble (activo = 1)
  await db.raw(`
    CREATE TRIGGER actualizar_inmuebles_estado_activar
    AFTER UPDATE ON inmuebles
    FOR EACH ROW
    WHEN OLD.activo = 0 AND NEW.activo = 1
    BEGIN
      -- Eliminar el registro de inmuebles_estado
      DELETE FROM inmuebles_estado WHERE inmueble_ref = NEW.ref;
      
      -- Registrar el cambio en el historial
      INSERT INTO historial_cambios (inmueble_id, campo, valor_anterior, valor_nuevo, fecha_cambio)
      VALUES (NEW.id, 'activo', '0', '1', datetime('now'));
    END
  `);
  
  // Trigger para cuando se desactiva un inmueble (activo = 0)
  await db.raw(`
    CREATE TRIGGER actualizar_inmuebles_estado_desactivar
    AFTER UPDATE ON inmuebles
    FOR EACH ROW
    WHEN OLD.activo = 1 AND NEW.activo = 0
    BEGIN
      -- Insertar o reemplazar el registro en inmuebles_estado
      INSERT OR REPLACE INTO inmuebles_estado (inmueble_ref, codigo_sincronizacion, activo, fecha_modificacion, created_at, updated_at)
      VALUES (NEW.ref, NEW.codigo_sincronizacion, 0, datetime('now'), datetime('now'), datetime('now'));
      
      -- Registrar el cambio en el historial
      INSERT INTO historial_cambios (inmueble_id, campo, valor_anterior, valor_nuevo, fecha_cambio)
      VALUES (NEW.id, 'activo', '1', '0', datetime('now'));
    END
  `);
  
  console.log('Triggers para SQLite creados correctamente.');
}

// Ejecutar la función principal
crearTrigger();
