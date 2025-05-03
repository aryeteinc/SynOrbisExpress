/**
 * Script para limpiar sincronizaciones bloqueadas
 * 
 * Este script marca como error las sincronizaciones que están en progreso
 * pero que llevan más tiempo del esperado (sincronizaciones huérfanas)
 * 
 * Uso:
 * node clean-syncs.js [--sync-id=ID] [--minutes=30]
 */

const path = require('path');
const dotenv = require('dotenv');
const knex = require('knex');

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos
const args = process.argv.slice(2);
let syncId = null;
let timeoutMinutes = 30;

args.forEach(arg => {
  if (arg.startsWith('--sync-id=')) {
    syncId = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--minutes=')) {
    timeoutMinutes = parseInt(arg.split('=')[1], 10);
  }
});

// Configurar la conexión a la base de datos
const dbConfig = {
  client: 'sqlite3',
  connection: {
    filename: path.resolve(process.cwd(), process.env.SQLITE_PATH || 'inmuebles_db.sqlite')
  },
  useNullAsDefault: true
};

const db = knex(dbConfig);

async function cleanSyncs() {
  try {
    console.log('='.repeat(70));
    console.log('LIMPIEZA DE SINCRONIZACIONES BLOQUEADAS');
    console.log('='.repeat(70));
    
    let cleaned = 0;
    
    if (syncId) {
      // Limpiar una sincronización específica
      console.log(`Limpiando sincronización con ID: ${syncId}`);
      
      const updated = await db('ejecuciones')
        .where('id', syncId)
        .where('estado', 'en_progreso')
        .update({
          estado: 'error',
          fecha_fin: db.fn.now(),
          error: 'Sincronización marcada como error manualmente'
        });
      
      if (updated > 0) {
        console.log(`✅ Sincronización ${syncId} marcada como error correctamente`);
        cleaned = updated;
      } else {
        console.log(`⚠️ No se encontró la sincronización ${syncId} o no estaba en progreso`);
      }
    } else {
      // Limpiar sincronizaciones huérfanas
      console.log(`Limpiando sincronizaciones huérfanas (más de ${timeoutMinutes} minutos)...`);
      
      // Calcular el tiempo límite (ahora menos el timeout)
      const timeoutDate = new Date();
      timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);
      
      // Buscar sincronizaciones en progreso que hayan comenzado antes del tiempo límite
      const orphanedSyncs = await db('ejecuciones')
        .where('estado', 'en_progreso')
        .where('fecha_inicio', '<', timeoutDate.toISOString())
        .update({
          estado: 'error',
          fecha_fin: db.fn.now(),
          error: 'Sincronización marcada como error automáticamente por timeout'
        });
      
      if (orphanedSyncs > 0) {
        console.log(`✅ Se limpiaron ${orphanedSyncs} sincronizaciones huérfanas`);
        cleaned = orphanedSyncs;
      } else {
        console.log('ℹ️ No se encontraron sincronizaciones huérfanas');
      }
    }
    
    console.log(`\nTotal de sincronizaciones limpiadas: ${cleaned}`);
    console.log('='.repeat(70));
  } catch (error) {
    console.error('Error al limpiar sincronizaciones:', error);
  } finally {
    // Cerrar la conexión a la base de datos
    await db.destroy();
  }
}

// Ejecutar la función principal
cleanSyncs().catch(error => {
  console.error(`Error fatal: ${error.message}`);
  process.exit(1);
});
