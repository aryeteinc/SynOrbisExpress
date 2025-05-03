FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3001

# Crear volumen para imágenes y base de datos SQLite
VOLUME ["/app/imagenes_inmuebles", "/app/data"]

# Comando para iniciar la aplicación
CMD ["node", "dist/index.js"]
