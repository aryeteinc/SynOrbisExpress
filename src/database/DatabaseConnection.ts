import knex, { Knex } from 'knex';
import fs from 'fs';
import path from 'path';

interface DatabaseConfig {
  type: string;
  sqlitePath: string;
  mysql: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
}

export class DatabaseConnection {
  private connection: Knex;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.connection = this.createConnection();
  }

  private createConnection(): Knex {
    if (this.config.type === 'mysql') {
      return knex({
        client: 'mysql2',
        connection: {
          host: this.config.mysql.host,
          port: this.config.mysql.port,
          user: this.config.mysql.user,
          password: this.config.mysql.password,
          database: this.config.mysql.database
        },
        pool: { min: 0, max: 7 }
      });
    } else {
      // Ensure the directory exists
      const dir = path.dirname(this.config.sqlitePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      return knex({
        client: 'better-sqlite3',
        connection: {
          filename: this.config.sqlitePath
        },
        useNullAsDefault: true
      });
    }
  }

  public getConnection(): Knex {
    return this.connection;
  }

  public async setupTables(): Promise<void> {
    const knex = this.connection;

    // Check if tables exist
    const hasInmuebles = await knex.schema.hasTable('inmuebles');

    if (!hasInmuebles) {
      console.log('Creating database tables...');

      // Create catalogs tables
      
      // Create asesores table
      await knex.schema.createTable('asesores', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable();
        table.string('apellido').nullable();
        table.string('email').nullable();
        table.string('telefono').nullable();
        table.string('imagen').nullable();
        table.boolean('activo').defaultTo(true);
        table.timestamps(true, true);
      });
      
      // Insert default asesor 'Oficina'
      await knex('asesores').insert({
        id: 1,
        nombre: 'Oficina',
        activo: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
      
      // Create ciudades table
      await knex.schema.createTable('ciudades', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      await knex.schema.createTable('barrios', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      await knex.schema.createTable('tipos_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      await knex.schema.createTable('usos_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      await knex.schema.createTable('estados_inmueble', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.timestamps(true, true);
      });

      // Create main properties table
      await knex.schema.createTable('inmuebles', table => {
        table.increments('id').primary();
        table.integer('ref').notNullable().unique();
        table.string('codigo_sincronizacion').nullable();
        table.string('slug').nullable().unique();
        table.integer('ciudad_id').unsigned().references('id').inTable('ciudades');
        table.integer('barrio_id').unsigned().references('id').inTable('barrios');
        table.integer('tipo_inmueble_id').unsigned().references('id').inTable('tipos_inmueble');
        table.integer('uso_id').unsigned().references('id').inTable('usos_inmueble');
        table.integer('estado_actual_id').unsigned().references('id').inTable('estados_inmueble');
        table.integer('asesor_id').unsigned().references('id').inTable('asesores').defaultTo(1);
        table.string('direccion').nullable();
        table.decimal('area', 10, 2).nullable();
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
        table.timestamp('fecha_actualizacion').defaultTo(knex.fn.now());
        table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
        table.timestamp('fecha_sincronizacion').defaultTo(knex.fn.now());
        table.text('hash_datos').nullable();
      });

      // Create images table
      await knex.schema.createTable('imagenes', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.string('url_original').notNullable();
        table.string('ruta_local').nullable();
        table.string('hash_md5').nullable();
        table.integer('ancho').nullable();
        table.integer('alto').nullable();
        table.integer('tamano_bytes').nullable();
        table.boolean('es_principal').defaultTo(false);
        table.integer('orden').defaultTo(0);
        table.timestamps(true, true);
      });

      // Create characteristics table
      await knex.schema.createTable('caracteristicas', table => {
        table.increments('id').primary();
        table.string('nombre').notNullable().unique();
        table.enum('tipo', ['booleano', 'numerico', 'texto']).defaultTo('texto');
        table.string('unidad').nullable();
        table.string('descripcion').nullable();
        table.timestamps(true, true);
      });

      // Create property-characteristics relationship table
      await knex.schema.createTable('inmueble_caracteristicas', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.integer('caracteristica_id').unsigned().references('id').inTable('caracteristicas');
        table.string('valor_texto').nullable();
        table.decimal('valor_numerico', 15, 2).nullable();
        table.boolean('valor_booleano').nullable();
        table.timestamps(true, true);
      });

      // Create change history table
      await knex.schema.createTable('historial_cambios', table => {
        table.increments('id').primary();
        table.integer('inmueble_id').unsigned().references('id').inTable('inmuebles').onDelete('CASCADE');
        table.string('campo').notNullable();
        table.text('valor_anterior').nullable();
        table.text('valor_nuevo').nullable();
        table.timestamp('fecha_cambio').defaultTo(knex.fn.now());
      });

      // Create execution log table
      await knex.schema.createTable('ejecuciones', table => {
        table.increments('id').primary();
        table.timestamp('fecha_inicio').defaultTo(knex.fn.now());
        table.timestamp('fecha_fin').nullable();
        table.string('estado').defaultTo('en_progreso');
        table.string('tipo').defaultTo('manual');
        table.string('usuario').nullable();
        table.integer('total_inmuebles').defaultTo(0);
        table.integer('nuevos').defaultTo(0);
        table.integer('actualizados').defaultTo(0);
        table.integer('sin_cambios').defaultTo(0);
        table.integer('inmuebles_procesados').defaultTo(0);
        table.integer('inmuebles_nuevos').defaultTo(0);
        table.integer('inmuebles_actualizados').defaultTo(0);
        table.integer('inmuebles_sin_cambios').defaultTo(0);
        table.integer('imagenes_descargadas').defaultTo(0);
        table.integer('errores').defaultTo(0);
        table.text('detalles').nullable();
        table.text('log').nullable();
        table.text('error').nullable();
      });

      console.log('Database tables created successfully');
    }
  }

  public async resetDatabase(): Promise<void> {
    const knex = this.connection;
    
    // Drop tables in the correct order to respect foreign key constraints
    const tables = [
      'historial_cambios',
      'inmueble_caracteristicas',
      'caracteristicas',
      'imagenes',
      'inmuebles',
      'estados_inmueble',
      'usos_inmueble',
      'tipos_inmueble',
      'barrios',
      'ciudades',
      'asesores',
      'ejecuciones'
    ];

    for (const table of tables) {
      if (await knex.schema.hasTable(table)) {
        await knex.schema.dropTable(table);
        console.log(`Table ${table} dropped`);
      }
    }

    // Recreate tables
    await this.setupTables();
  }

  public async actualizarEstructuraDB(): Promise<void> {
    const knex = this.connection;
    
    try {
      // Verificar si la tabla asesores existe
      const hasAsesoresTable = await knex.schema.hasTable('asesores');
      
      if (!hasAsesoresTable) {
        console.log('Creando tabla asesores...');
        
        // Crear la tabla asesores
        await knex.schema.createTable('asesores', table => {
          table.increments('id').primary();
          table.string('nombre').notNullable();
          table.string('apellido').nullable();
          table.string('email').nullable();
          table.string('telefono').nullable();
          table.string('imagen').nullable();
          table.boolean('activo').defaultTo(true);
          table.timestamps(true, true);
        });
        
        // Insertar el asesor por defecto 'Oficina'
        await knex('asesores').insert({
          id: 1,
          nombre: 'Oficina',
          activo: true,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });
        
        console.log('Tabla asesores creada y asesor por defecto insertado');
      }
      
      // Verificar si la tabla inmuebles existe
      const hasInmueblesTable = await knex.schema.hasTable('inmuebles');
      
      if (hasInmueblesTable) {
        // Verificar si la columna asesor_id existe en la tabla inmuebles
        const hasAsesorIdColumn = await knex.schema.hasColumn('inmuebles', 'asesor_id');
        
        if (!hasAsesorIdColumn) {
          console.log('Añadiendo columna asesor_id a la tabla inmuebles...');
          
          // Añadir la columna asesor_id a la tabla inmuebles
          await knex.schema.table('inmuebles', table => {
            table.integer('asesor_id').unsigned().references('id').inTable('asesores').defaultTo(1);
          });
          
          // Asignar todos los inmuebles existentes al asesor por defecto
          await knex('inmuebles').update({ asesor_id: 1 });
          
          console.log('Columna asesor_id añadida a la tabla inmuebles');
        }
        
        // Verificar si la columna activo existe en la tabla inmuebles
        const hasActivoColumn = await knex.schema.hasColumn('inmuebles', 'activo');
        
        if (!hasActivoColumn) {
          console.log('Añadiendo columna activo a la tabla inmuebles...');
          
          // Añadir la columna activo a la tabla inmuebles
          await knex.schema.table('inmuebles', table => {
            table.boolean('activo').defaultTo(true);
          });
          
          // Marcar todos los inmuebles existentes como activos
          await knex('inmuebles').update({ activo: true });
          
          console.log('Columna activo añadida a la tabla inmuebles');
        }
      }
      
      // Verificar si la columna imagen existe en la tabla asesores
      if (hasAsesoresTable) {
        const hasImagenColumn = await knex.schema.hasColumn('asesores', 'imagen');
        
        if (!hasImagenColumn) {
          console.log('Añadiendo columna imagen a la tabla asesores...');
          
          // Añadir la columna imagen a la tabla asesores
          await knex.schema.table('asesores', table => {
            table.string('imagen').nullable();
          });
          
          console.log('Columna imagen añadida a la tabla asesores');
        }
      }
      
      // Verificar otras tablas y columnas necesarias
      await this.setupTables();
      
      // Crear triggers para mantener la consistencia de datos
      await this.crearTriggers();
      
      // Actualizar imágenes principales existentes
      await this.actualizarImagenesPrincipales();
      
      console.log('Estructura de la base de datos actualizada correctamente');
    } catch (error) {
      console.error(`Error actualizando la estructura de la base de datos: ${(error as Error).message}`);
      throw error;
    }
  }

  private async actualizarImagenesPrincipales(): Promise<void> {
    const knex = this.connection;
    
    try {
      // Actualizar todas las imágenes con orden = 0 para que tengan es_principal = 1
      const updated = await knex('imagenes')
        .where('orden', 0)
        .update({ es_principal: 1 });
      
      console.log(`Actualizadas ${updated} imágenes principales (orden = 0)`);
    } catch (error) {
      console.error(`Error actualizando imágenes principales: ${(error as Error).message}`);
    }
  }

  private async crearTriggers(): Promise<void> {
    const knex = this.connection;
    const dbType = process.env.DB_TYPE || 'sqlite';
    
    try {
      if (dbType === 'sqlite') {
        // SQLite triggers
        // Verificar si el trigger ya existe
        const existingTrigger = await knex.raw("SELECT name FROM sqlite_master WHERE type='trigger' AND name='set_principal_image_on_insert'");
        
        if (existingTrigger.length === 0) {
          // Trigger para nuevas inserciones
          await knex.raw(`
            CREATE TRIGGER IF NOT EXISTS set_principal_image_on_insert
            AFTER INSERT ON imagenes
            FOR EACH ROW
            WHEN NEW.orden = 0 AND NEW.es_principal = 0
            BEGIN
              UPDATE imagenes SET es_principal = 1 WHERE id = NEW.id;
            END;
          `);
          
          // Trigger para actualizaciones
          await knex.raw(`
            CREATE TRIGGER IF NOT EXISTS set_principal_image_on_update
            AFTER UPDATE OF orden ON imagenes
            FOR EACH ROW
            WHEN NEW.orden = 0 AND NEW.es_principal = 0
            BEGIN
              UPDATE imagenes SET es_principal = 1 WHERE id = NEW.id;
            END;
          `);
        }
      } else if (dbType === 'mysql') {
        // MySQL triggers
        // Eliminar triggers existentes si existen
        await knex.raw('DROP TRIGGER IF EXISTS set_principal_image_on_insert');
        await knex.raw('DROP TRIGGER IF EXISTS set_principal_image_on_update');
        
        // Trigger para nuevas inserciones
        await knex.raw(`
          CREATE TRIGGER set_principal_image_on_insert
          BEFORE INSERT ON imagenes
          FOR EACH ROW
          BEGIN
            IF NEW.orden = 0 THEN
              SET NEW.es_principal = 1;
            END IF;
          END;
        `);
        
        // Trigger para actualizaciones
        await knex.raw(`
          CREATE TRIGGER set_principal_image_on_update
          BEFORE UPDATE ON imagenes
          FOR EACH ROW
          BEGIN
            IF NEW.orden = 0 THEN
              SET NEW.es_principal = 1;
            END IF;
          END;
        `);
      }
      
      console.log(`Triggers creados correctamente para ${dbType}`);
    } catch (error) {
      console.error(`Error creando triggers: ${(error as Error).message}`);
    }
  }

  public async diagnosticarBaseDatos(): Promise<void> {
    const knex = this.connection;
    
    // Check record counts in main tables
    const tables = [
      'inmuebles',
      'imagenes',
      'caracteristicas',
      'inmueble_caracteristicas',
      'historial_cambios',
      'ejecuciones'
    ];

    console.log('Database diagnosis:');
    for (const table of tables) {
      if (await knex.schema.hasTable(table)) {
        const count = await knex(table).count('* as count').first();
        console.log(`- Table ${table}: ${count?.count || 0} records`);
      } else {
        console.log(`- Table ${table}: does not exist`);
      }
    }
  }

  public async close(): Promise<void> {
    await this.connection.destroy();
  }
}
