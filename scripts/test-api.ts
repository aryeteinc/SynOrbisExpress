#!/usr/bin/env ts-node
/**
 * Script para probar la conexión con la API de Orbis
 * Este script verifica si la API está disponible y si los datos se pueden recuperar correctamente
 */

import dotenv from 'dotenv';
import axios from 'axios';
import config from '../src/config/config';

// Cargar variables de entorno
dotenv.config();

async function testApiConnection() {
  console.log('='.repeat(80));
  console.log('PRUEBA DE CONEXIÓN CON LA API DE ORBIS');
  console.log('='.repeat(80));
  
  const url = process.env.API_URL || config.apiUrl;
  console.log(`URL de la API: ${url}`);
  
  try {
    // Intentar una solicitud GET simple
    console.log('\n1. Probando solicitud GET básica...');
    const getResponse = await axios.get(url, {
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 segundos de timeout
    });
    
    console.log(`Código de estado: ${getResponse.status}`);
    console.log(`Tipo de respuesta: ${typeof getResponse.data}`);
    console.log(`Tamaño de la respuesta: ${JSON.stringify(getResponse.data).length} bytes`);
    
    if (getResponse.data) {
      if (Array.isArray(getResponse.data)) {
        console.log(`La respuesta es un array con ${getResponse.data.length} elementos`);
      } else if (typeof getResponse.data === 'object') {
        console.log(`La respuesta es un objeto con ${Object.keys(getResponse.data).length} propiedades`);
        console.log('Propiedades principales:', Object.keys(getResponse.data));
      }
    }
    
    // Intentar una solicitud POST con filtros
    console.log('\n2. Probando solicitud POST con filtros...');
    const postData = {
      filtros: {
        // Filtros básicos para probar
        limite: 5
      }
    };
    
    const postResponse = await axios.post(url, postData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 segundos de timeout
    });
    
    console.log(`Código de estado: ${postResponse.status}`);
    console.log(`Tipo de respuesta: ${typeof postResponse.data}`);
    console.log(`Tamaño de la respuesta: ${JSON.stringify(postResponse.data).length} bytes`);
    
    if (postResponse.data) {
      if (Array.isArray(postResponse.data)) {
        console.log(`La respuesta es un array con ${postResponse.data.length} elementos`);
        
        if (postResponse.data.length > 0) {
          console.log('\nEstructura del primer elemento:');
          const firstItem = postResponse.data[0];
          Object.keys(firstItem).forEach(key => {
            console.log(`- ${key}: ${typeof firstItem[key]}`);
          });
        }
      } else if (typeof postResponse.data === 'object') {
        console.log(`La respuesta es un objeto con ${Object.keys(postResponse.data).length} propiedades`);
        console.log('Propiedades principales:', Object.keys(postResponse.data));
        
        // Si hay una propiedad 'data' o similar, mostrar su estructura
        if (postResponse.data.data && Array.isArray(postResponse.data.data)) {
          console.log(`\nLa propiedad 'data' es un array con ${postResponse.data.data.length} elementos`);
          
          if (postResponse.data.data.length > 0) {
            console.log('\nEstructura del primer elemento:');
            const firstItem = postResponse.data.data[0];
            Object.keys(firstItem).forEach(key => {
              console.log(`- ${key}: ${typeof firstItem[key]}`);
            });
          }
        }
      }
    }
    
    console.log('\n✅ Prueba de API completada con éxito');
    
  } catch (error) {
    console.error('\n❌ Error al conectar con la API:');
    
    if (axios.isAxiosError(error)) {
      console.error(`Código de estado: ${error.response?.status || 'N/A'}`);
      console.error(`Mensaje: ${error.message}`);
      
      if (error.response) {
        console.error('Datos de respuesta:', error.response.data);
      }
      
      if (error.request) {
        console.error('La solicitud se realizó pero no se recibió respuesta');
        console.error('URL solicitada:', error.config?.url);
        console.error('Método:', error.config?.method?.toUpperCase());
        console.error('Cabeceras:', error.config?.headers);
      }
    } else {
      console.error(`Error: ${(error as Error).message}`);
    }
    
    process.exit(1);
  }
}

// Ejecutar la prueba
testApiConnection().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
