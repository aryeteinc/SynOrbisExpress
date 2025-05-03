#!/bin/bash

# Script para construir la aplicación para producción
# Este script automatiza el proceso de construcción para entornos de producción
#
# Uso: ./scripts/build-prod.sh [--obfuscate]
#   --obfuscate: Ofusca el código JavaScript para protegerlo

# Colores para la consola
RESET="\033[0m"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
RED="\033[31m"

# Función para mostrar mensajes de sección
section() {
  echo -e "${BOLD}${BLUE}==> $1${RESET}"
}

# Función para mostrar mensajes de éxito
success() {
  echo -e "${GREEN}$1${RESET}"
}

# Función para mostrar mensajes de error
error() {
  echo -e "${RED}$1${RESET}"
  exit 1
}

# Procesar argumentos
OBFUSCATE=false
for arg in "$@"; do
  case $arg in
    --obfuscate)
      OBFUSCATE=true
      shift
      ;;
    *)
      # Argumento desconocido
      ;;
  esac
done

# Mostrar encabezado
echo -e "${BOLD}${YELLOW}=====================================================================${RESET}"
echo -e "${BOLD}${YELLOW}          CONSTRUCCIÓN DE SYNCORBIS EXPRESS PARA PRODUCCIÓN         ${RESET}"
echo -e "${BOLD}${YELLOW}=====================================================================${RESET}"

if [ "$OBFUSCATE" = true ]; then
  echo -e "${BOLD}${BLUE}Modo: Producción con ofuscación de código${RESET}"
else
  echo -e "${BOLD}${BLUE}Modo: Producción estándar${RESET}"
fi

# Verificar que estamos en la raíz del proyecto
if [ ! -f "package.json" ]; then
  error "Este script debe ejecutarse desde la raíz del proyecto"
fi

# Paso 1: Instalar dependencias
section "Instalando dependencias"
npm install || error "Error al instalar dependencias"
success "Dependencias instaladas correctamente"

# Paso 2: Limpiar la carpeta dist
section "Limpiando carpeta dist"
npm run clean || error "Error al limpiar la carpeta dist"
success "Carpeta dist limpiada correctamente"

# Paso 3: Compilar TypeScript
section "Compilando TypeScript"
npx tsc || error "Error al compilar TypeScript"
success "TypeScript compilado correctamente"

# Paso 4: Copiar scripts JavaScript
section "Copiando scripts JavaScript"
mkdir -p dist/scripts
cp scripts/*.js dist/scripts/ || error "Error al copiar scripts JavaScript"
success "Scripts JavaScript copiados correctamente"

# Paso 5: Copiar archivos estáticos
section "Copiando archivos estáticos"
# Crear carpeta para imágenes
mkdir -p dist/imagenes_inmuebles

# Copiar archivos de configuración
cp package.json dist/ || error "Error al copiar package.json"
cp .env dist/.env.example || error "Error al copiar .env"
success "Archivos estáticos copiados correctamente"

# Paso 6: Crear carpeta docs
section "Copiando documentación"
mkdir -p dist/docs
cp -R docs/* dist/docs/ 2>/dev/null || echo "No se encontraron archivos de documentación"
success "Documentación copiada correctamente"

# Paso 7: Optimizar package.json para producción
section "Optimizando package.json para producción"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('dist/package.json', 'utf8'));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: 'index.js',
  scripts: {
    start: 'node index.js',
    sync: 'node scripts/sync-js.js',
    'clean-syncs': 'node scripts/clean-syncs.js',
    'reset-db': 'node scripts/reset-db.js',
    'fix-nulls': 'node scripts/fix-nulls.js',
    'fix-relational-fields': 'node scripts/fix-relational-fields.js'
  },
  dependencies: pkg.dependencies,
  author: pkg.author,
  license: pkg.license
};
fs.writeFileSync('dist/package.json', JSON.stringify(prodPkg, null, 2));
" || error "Error al optimizar package.json"
success "package.json optimizado correctamente"

# Paso 8: Ofuscar código si se solicitó
if [ "$OBFUSCATE" = true ]; then
  section "Ofuscando código JavaScript"
  # Verificar si javascript-obfuscator está instalado
  if ! command -v javascript-obfuscator &> /dev/null; then
    echo -e "${YELLOW}JavaScript-Obfuscator no está instalado. Instalando...${RESET}"
    npm install -g javascript-obfuscator || error "Error al instalar JavaScript-Obfuscator"
  fi
  
  # Ejecutar script de ofuscación
  node scripts/obfuscate.js || error "Error al ofuscar el código"
  success "Código ofuscado correctamente"
fi

# Mostrar mensaje de finalización
echo -e "${BOLD}${GREEN}=====================================================================${RESET}"
echo -e "${BOLD}${GREEN}                CONSTRUCCIÓN COMPLETADA EXITOSAMENTE                 ${RESET}"
echo -e "${BOLD}${GREEN}=====================================================================${RESET}"
echo -e "${BOLD}${BLUE}Los archivos para producción están disponibles en la carpeta dist/${RESET}"
echo -e "${BOLD}${BLUE}Para desplegar la aplicación en producción:${RESET}"
echo -e "${BOLD}${BLUE}1. Copia la carpeta dist/ a tu servidor${RESET}"
echo -e "${BOLD}${BLUE}2. Renombra .env.example a .env y configura las variables de entorno${RESET}"
echo -e "${BOLD}${BLUE}3. Ejecuta 'npm install --production' dentro de la carpeta dist/${RESET}"
echo -e "${BOLD}${BLUE}4. Ejecuta 'npm start' para iniciar la aplicación${RESET}"

if [ "$OBFUSCATE" = true ]; then
  echo -e "${BOLD}${BLUE}NOTA: El código ha sido ofuscado para mayor seguridad${RESET}"
fi

echo -e "${BOLD}${YELLOW}=====================================================================${RESET}"
