/**
 * Property manager class
 * Handles property data processing
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import imageSize from 'image-size';
import { Knex } from 'knex';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { 
  PropertyFromAPI, 
  ApiFilters, 
  Statistics, 
  CommandLineArgs,
  PropertyImage,
  PropertyCharacteristic,
  PropertyChange
} from '../models/types';
import config from '../config/config';

export class InmuebleManager {
  private db: DatabaseConnection;
  private stats: Statistics = {
    inmuebles_procesados: 0,
    inmuebles_nuevos: 0,
    inmuebles_actualizados: 0,
    inmuebles_sin_cambios: 0,
    imagenes_descargadas: 0,
    imagenes_eliminadas: 0,
    errores: 0,
    inicio: new Date()
  };

  /**
   * Constructor
   * @param db Database connection
   */
  constructor(db: DatabaseConnection) {
    this.db = db;
    this.resetStatistics();
  }

  /**
   * Gets statistics for the current synchronization
   * @returns Statistics object
   */
  public getStatistics(): Statistics {
    this.stats.fin = new Date();
    return this.stats;
  }
  
  /**
   * Resets statistics
   */
  public resetStatistics(): void {
    this.stats = {
      inmuebles_procesados: 0,
      inmuebles_nuevos: 0,
      inmuebles_actualizados: 0,
      inmuebles_sin_cambios: 0,
      imagenes_descargadas: 0,
      imagenes_eliminadas: 0,
      errores: 0,
      inicio: new Date()
    };
  }

  /**
   * Gets data from the API
   * @param inmuebleId Specific property ID to get
   * @param filtros Additional filters
   * @returns API data
   */
  public async obtenerDatosApi(inmuebleId?: string, filtros?: ApiFilters): Promise<PropertyFromAPI[] | null> {
    const url = process.env.API_URL || config.apiUrl;
    
    // Prepare POST data
    const postData: { filtros: ApiFilters } = { filtros: {} };
    
    // Add specific property filter if provided
    if (inmuebleId) {
      postData.filtros.ref = parseInt(inmuebleId, 10);
    }
    
    // Add additional filters if provided
    if (filtros) {
      postData.filtros = { ...postData.filtros, ...filtros };
    }
    
    // Determine if we should use POST
    const usePost = Object.keys(postData.filtros).length > 0;
    
    console.log(`Querying API at: ${url}`);
    if (usePost) {
      console.log(`Filters: ${JSON.stringify(postData)}`);
    }
    
    try {
      let response;
      
      if (usePost) {
        response = await axios.post(url, postData, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
      } else {
        response = await axios.get(url, {
          headers: {
            'Accept': 'application/json'
          }
        });
      }
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`Response received. Status code: ${response.status}`);
        console.log(`Response size: ${JSON.stringify(response.data).length} bytes`);
        
        return this.extractPropertyData(response.data);
      } else {
        console.log(`Error getting data from API. Status code: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error(`Error in API request: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Extracts property data from API response
   * @param data API response data
   * @returns Array of properties
   */
  private extractPropertyData(data: any): PropertyFromAPI[] {
    // Get the list of properties according to the response structure
    let properties: PropertyFromAPI[] = [];
    
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
        // If it's a single property
        properties = [data];
      }
    }
    
    return properties;
  }

  /**
   * Gets or creates a catalog ID
   * @param tabla Catalog table
   * @param nombre Value to search or get
   * @returns Catalog ID
   */
  public async obtenerOCrearIdCatalogo(tabla: string, nombre?: string): Promise<number> {
    // If name is null or empty, create a default value
    if (!nombre) {
      // Check if "No especificado" already exists
      const result = await this.db.getConnection()
        .table(tabla)
        .where('nombre', 'No especificado')
        .first();
      
      if (result) {
        return result.id;
      }
      
      // If it doesn't exist, insert it
      const [id] = await this.db.getConnection()
        .table(tabla)
        .insert({ nombre: 'No especificado' });
      
      return id;
    }
    
    // Check if it already exists
    const result = await this.db.getConnection()
      .table(tabla)
      .where('nombre', nombre)
      .first();
    
    if (result) {
      return result.id;
    }
    
    // If it doesn't exist, insert it
    const [id] = await this.db.getConnection()
      .table(tabla)
      .insert({ nombre });
    
    return id;
  }

  /**
   * Processes a property from the API
   * @param property Property data from API
   * @param downloadImages Whether to download images
   * @param trackChanges Whether to track changes
   * @returns Property ID
   */
  public async procesarInmueble(property: PropertyFromAPI, downloadImages: boolean = true, trackChanges: boolean = true): Promise<number | null> {
    try {
      // Get or create catalog IDs
      const ciudadId = await this.obtenerOCrearIdCatalogo('ciudades', property.ciudad);
      const barrioId = await this.obtenerOCrearIdCatalogo('barrios', property.barrio);
      const tipoInmuebleId = await this.obtenerOCrearIdCatalogo('tipos_inmueble', property.tipo_inmueble);
      const usoId = await this.obtenerOCrearIdCatalogo('usos', property.uso);
      const estadoActualId = await this.obtenerOCrearIdCatalogo('estados', property.estado_actual);
      
      // Check if property already exists
      const existingProperty = await this.db.getConnection()
        .table('inmuebles')
        .where('ref', property.ref)
        .first();
      
      // Calculate property hash for change detection
      const propertyData = {
        ref: property.ref,
        codigo_consignacion: property.codigo_consignacion || '',
        codigo_sincronizacion: property.codigo_sincronizacion || '',
        ciudad_id: ciudadId,
        barrio_id: barrioId,
        tipo_inmueble_id: tipoInmuebleId,
        uso_id: usoId,
        estado_actual_id: estadoActualId,
        direccion: property.direccion || '',
        area: property.area || 0,
        habitaciones: property.habitaciones || 0,
        banos: property.banos || 0,
        garajes: property.garajes || 0,
        estrato: property.estrato || 0,
        precio_venta: property.precio_venta || 0,
        precio_canon: property.precio_canon || 0,
        precio_administracion: property.precio_administracion || 0,
        descripcion: property.descripcion || '',
        descripcion_corta: property.descripcion_corta || '',
        latitud: property.latitud || '',
        longitud: property.longitud || ''
      };
      
      // Calculate hash for change detection
      const nuevoHash = crypto.createHash('md5')
        .update(JSON.stringify(propertyData))
        .digest('hex');
      
      let propertyId: number;
      
      if (existingProperty) {
        // If hash is the same, no changes
        if (existingProperty.hash_md5 === nuevoHash) {
          this.stats.inmuebles_sin_cambios++;
          return existingProperty.id;
        }
        
        // Update existing property
        await this.db.getConnection()
          .table('inmuebles')
          .where('id', existingProperty.id)
          .update({
            ...propertyData,
            hash_md5: nuevoHash,
            activo: true,
            updated_at: this.db.getConnection().fn.now()
          });
        
        propertyId = existingProperty.id;
        this.stats.inmuebles_actualizados++;
      } else {
        // Insert new property
        [propertyId] = await this.db.getConnection()
          .table('inmuebles')
          .insert({
            ...propertyData,
            hash_md5: nuevoHash,
            activo: true,
            created_at: this.db.getConnection().fn.now(),
            updated_at: this.db.getConnection().fn.now()
          });
        
        this.stats.inmuebles_nuevos++;
      }
      
      // Process images if available
      if (downloadImages && property.imagenes && property.imagenes.length > 0) {
        await this.procesarImagenes(propertyId, property.imagenes);
      }
      
      // Process characteristics if available
      if (property.caracteristicas && property.caracteristicas.length > 0) {
        await this.procesarCaracteristicas(propertyId, property.caracteristicas);
      }
      
      this.stats.inmuebles_procesados++;
      return propertyId;
    } catch (error) {
      console.error(`Error processing property ${property.ref}: ${(error as Error).message}`);
      this.stats.errores++;
      return null;
    }
  }

  /**
   * Processes property images
   * @param propertyId Property ID
   * @param images Array of images
   */
  private async procesarImagenes(propertyId: number, images: PropertyImage[]): Promise<void> {
    if (!this.db) {
      console.error('Database connection not available');
      return;
    }

    const knex = this.db.getConnection();
    if (!knex) {
      console.error('Knex connection not available');
      return;
    }

    const imagesFolder = config.imagesFolder;
    
    // Create property folder if it doesn't exist
    const propertyFolder = path.join(imagesFolder, propertyId.toString());
    if (!fs.existsSync(propertyFolder)) {
      fs.mkdirSync(propertyFolder, { recursive: true });
    }
    
    // Get existing images for this property
    const existingImages = await knex('imagenes')
      .where('inmueble_id', propertyId)
      .select('url_original', 'hash_md5', 'id', 'ruta_local');
    
    // Create a map of existing images by URL
    const existingImageMap = new Map<string, { id: number, hash_md5: string | null, ruta_local: string | null, es_principal: boolean }>();
    for (const img of existingImages) {
      existingImageMap.set(img.url_original, { 
        id: img.id, 
        hash_md5: img.hash_md5 || null, 
        ruta_local: img.ruta_local || null,
        es_principal: Boolean(img.es_principal)
      });
    }
    
    // Create a set of current image URLs from the API
    const currentImageUrls = new Set<string>();
    for (const image of images) {
      if (image && image.url) {
        currentImageUrls.add(image.url);
      }
    }
    
    // Process each image from the API
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      if (!image || !image.url) {
        console.error(`Image at index ${i} has no URL, skipping`);
        continue;
      }
      
      try {
        // Check if image already exists
        const existing = existingImageMap.get(image.url);
        
        // Generate file name
        const fileExtension = path.extname(image.url) || '.jpg';
        const fileName = `${i + 1}${fileExtension}`;
        const localPath = path.join(propertyFolder, fileName);
        
        // Download the image if it doesn't exist or if we don't have a hash
        if (!existing || !existing.hash_md5) {
          // Download the image
          const response = await axios.get(image.url, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(response.data);
          
          // Calculate MD5 hash
          const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
          
          // Save the image
          fs.writeFileSync(localPath, imageBuffer);
          
          // Get image dimensions
          let width = 0;
          let height = 0;
          try {
            const dimensions = imageSize(Buffer.from(fs.readFileSync(localPath)));
            width = dimensions.width || 0;
            height = dimensions.height || 0;
          } catch (e) {
            console.error(`Error getting image dimensions: ${(e as Error).message}`);
          }
          
          // Determine if it's the main image (orden=0)
          const orden = typeof image.orden === 'number' ? image.orden : i;
          
          // Determine if it's the main image, respecting existing value
          let esPrincipal: boolean;
          if (existing) {
            // Si la imagen ya existe, respetamos su valor de es_principal
            // a menos que explícitamente venga como principal desde la API
            esPrincipal = orden === 0 ? true : 
                         (image.es_principal === true) ? true : 
                         existing.es_principal;
          } else {
            // Para nuevas imágenes, usamos la lógica original
            esPrincipal = orden === 0 ? true : Boolean(image.es_principal);
          }
          
          // Update or insert the image record
          if (existing) {
            await knex('imagenes')
              .where('id', existing.id)
              .update({
                ruta_local: localPath,
                hash_md5: hash,
                ancho: width,
                alto: height,
                tamano_bytes: imageBuffer.length,
                es_principal: esPrincipal,
                orden: orden,
                updated_at: knex.fn.now()
              });
          } else {
            await knex('imagenes').insert({
              inmueble_id: propertyId,
              url_original: image.url,
              ruta_local: localPath,
              hash_md5: hash,
              ancho: width,
              alto: height,
              tamano_bytes: imageBuffer.length,
              es_principal: esPrincipal,
              orden: orden,
              created_at: knex.fn.now(),
              updated_at: knex.fn.now()
            });
          }
          
          if (this.stats) {
            this.stats.imagenes_descargadas = (this.stats.imagenes_descargadas || 0) + 1;
          }
        }
      } catch (error) {
        console.error(`Error downloading image: ${error instanceof Error ? error.message : String(error)}`);
        if (this.stats) {
          this.stats.errores = (this.stats.errores || 0) + 1;
        }
      }
    }
    
    // Delete images that no longer exist in the API
    for (const [url, imageData] of existingImageMap.entries()) {
      if (!currentImageUrls.has(url)) {
        try {
          // Delete the image record from the database
          await knex('imagenes')
            .where('id', imageData.id)
            .delete();
          
          // Delete the physical file if it exists
          if (imageData.ruta_local && fs.existsSync(imageData.ruta_local)) {
            fs.unlinkSync(imageData.ruta_local);
          }
          
          console.log(`Deleted image that no longer exists in API: ${url}`);
          if (this.stats) {
            this.stats.imagenes_eliminadas = (this.stats.imagenes_eliminadas || 0) + 1;
          }
        } catch (error) {
          console.error(`Error deleting image: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  /**
   * Processes property characteristics
   * @param propertyId Property ID
   * @param characteristics Array of characteristics
   */
  private async procesarCaracteristicas(propertyId: number, characteristics: PropertyCharacteristic[]): Promise<void> {
    if (!this.db) {
      console.error('Database connection not available');
      return;
    }

    const knex = this.db.getConnection();
    if (!knex) {
      console.error('Knex connection not available');
      return;
    }
    
    // Clear existing characteristics for this property
    await knex('inmueble_caracteristicas')
      .where('inmueble_id', propertyId)
      .delete();
    
    // Process each characteristic
    for (const characteristic of characteristics) {
      try {
        if (!characteristic || !characteristic.nombre) {
          console.error('Characteristic has no name, skipping');
          continue;
        }
        
        // Get or create the characteristic definition
        const caracteristicaId = await this.obtenerOCrearCaracteristica(
          characteristic.nombre,
          (typeof characteristic.tipo === 'string' && ['booleano', 'numerico', 'texto', 'auto'].includes(characteristic.tipo) 
            ? characteristic.tipo as 'booleano' | 'numerico' | 'texto' | 'auto' 
            : 'auto'),
          characteristic.unidad || undefined
        );
        
        // Get the characteristic type
        const caracteristicaInfo = await knex('caracteristicas')
          .where('id', caracteristicaId)
          .first();
        
        if (!caracteristicaInfo) {
          console.error(`Characteristic with ID ${caracteristicaId} not found, skipping`);
          continue;
        }
        
        // Insert the characteristic value
        const insertData: Record<string, any> = {
          inmueble_id: propertyId,
          caracteristica_id: caracteristicaId,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        };
        
        // Set the value according to the type
        if (caracteristicaInfo.tipo === 'booleano') {
          insertData.valor = Boolean(characteristic.valor) ? '1' : '0';
        } else if (caracteristicaInfo.tipo === 'numerico') {
          if (typeof characteristic.valor === 'number') {
            insertData.valor = String(characteristic.valor);
          } else if (characteristic.valor !== undefined && characteristic.valor !== null) {
            const parsedValue = parseFloat(String(characteristic.valor));
            insertData.valor = isNaN(parsedValue) ? null : String(parsedValue);
          } else {
            insertData.valor = null;
          }
        } else {
          insertData.valor = characteristic.valor !== undefined && characteristic.valor !== null 
            ? String(characteristic.valor) 
            : '';
        }
        
        await knex('inmueble_caracteristicas').insert(insertData);
      } catch (error) {
        console.error(`Error processing characteristic ${characteristic?.nombre || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`);
        if (this.stats) {
          this.stats.errores = (this.stats.errores || 0) + 1;
        }
      }
    }
  }

  /**
   * Gets or creates a characteristic definition
   * @param nombre Characteristic name
   * @param tipo Characteristic type
   * @param unidad Unit of measurement for numeric characteristics
   * @param descripcion Characteristic description
   * @returns Characteristic ID
   */
  public async obtenerOCrearCaracteristica(
    nombre: string, 
    tipo: string = 'auto', 
    unidad?: string, 
    descripcion?: string
  ): Promise<number> {
    // Validar que tipo sea uno de los valores permitidos
    const tipoValido = ['booleano', 'numerico', 'texto', 'auto'].includes(tipo) ? 
      tipo : 'auto';
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    const knex = this.db.getConnection();
    if (!knex) {
      throw new Error('Knex connection not available');
    }
    
    // Determine type based on name if not provided
    let finalTipo: 'booleano' | 'numerico' | 'texto' = 'texto';
    
    if (tipoValido === 'auto') {
      // These terms usually indicate boolean characteristics
      const terminos_booleanos = ['tiene', 'con', 'sin', 'posee', 'incluye'];
      const nombres_booleanos = [
        'Baño Auxiliar', 'Estufa', 'Gas Natural', 'Cocina Integral', 'Piso en Cerámica',
        'Terraza', 'Balcón', 'Garaje/Parqueadero(s)'
      ];
      
      for (const termino of terminos_booleanos) {
        if (nombre.toLowerCase().includes(termino.toLowerCase())) {
          finalTipo = 'booleano';
          break;
        }
      }
      
      for (const nombreBool of nombres_booleanos) {
        if (nombre.toLowerCase() === nombreBool.toLowerCase()) {
          finalTipo = 'booleano';
          break;
        }
      }
      
      // These terms usually indicate numeric characteristics
      const terminos_numericos = ['número', 'cantidad', 'area', 'área', 'metros', 'precio', 'valor'];
      const unidades_numericas = ['m2', 'mt2', 'mts2', '$', 'pesos', 'metros'];
      
      for (const termino of terminos_numericos) {
        if (nombre.toLowerCase().includes(termino.toLowerCase())) {
          finalTipo = 'numerico';
          break;
        }
      }
      
      if (unidad) {
        for (const unidadNum of unidades_numericas) {
          if (unidad.toLowerCase().includes(unidadNum.toLowerCase())) {
            finalTipo = 'numerico';
            break;
          }
        }
      }
    } else {
      // Usar el tipo proporcionado si no es 'auto'
      finalTipo = tipoValido === 'auto' ? 'texto' : tipoValido as 'booleano' | 'numerico' | 'texto';
    }
    
    // Check if characteristic already exists
    const existing = await knex('caracteristicas')
      .where('nombre', nombre)
      .first();
    
    if (existing) {
      // Update the type if it's different
      if (existing.tipo !== finalTipo || existing.unidad !== unidad) {
        await knex('caracteristicas')
          .where('id', existing.id)
          .update({
            tipo: finalTipo,
            unidad: unidad,
            descripcion: descripcion,
            updated_at: knex.fn.now()
          });
      }
      
      return existing.id;
    }
    
    // Insert new characteristic
    const [id] = await knex('caracteristicas').insert({
      nombre,
      tipo: finalTipo,
      unidad,
      descripcion,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });
    
    return id;
  }

  /**
   * Marks properties as inactive if they are not in the API
   * @param activePropertyRefs Array of active property references
   * @returns Number of properties marked as inactive
   */
  public async marcarInactivosNoPresentes(activePropertyRefs: string[]): Promise<number> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    const knex = this.db.getConnection();
    if (!knex) {
      throw new Error('Knex connection not available');
    }
    
    try {
      const result = await knex('inmuebles')
        .whereNotIn('ref', activePropertyRefs)
        .where('activo', true)
        .update({
          activo: false,
          fecha_actualizacion: knex.fn.now()
        });
      
      console.log(`Marcados ${result} inmuebles como inactivos`);
      return result;
    } catch (error) {
      console.error(`Error marcando inmuebles inactivos: ${error instanceof Error ? error.message : String(error)}`);
      if (this.stats) {
        this.stats.errores = (this.stats.errores || 0) + 1;
      }
      return 0;
    }
  }

  /**
   * Registers execution statistics
   * @param stats Statistics object
   * @param detalles Additional details
   * @returns Execution ID
   */
  public async registrarEjecucion(stats: Statistics, detalles?: string): Promise<number> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    const knex = this.db.getConnection();
    if (!knex) {
      throw new Error('Knex connection not available');
    }
    
    const [id] = await knex('ejecuciones').insert({
      fecha_inicio: stats.inicio,
      fecha_fin: stats.fin || new Date(),
      inmuebles_procesados: stats.inmuebles_procesados,
      inmuebles_nuevos: stats.inmuebles_nuevos,
      inmuebles_actualizados: stats.inmuebles_actualizados,
      inmuebles_sin_cambios: stats.inmuebles_sin_cambios,
      imagenes_descargadas: stats.imagenes_descargadas,
      errores: stats.errores,
      detalles
    });
    
    return id;
  }
}
