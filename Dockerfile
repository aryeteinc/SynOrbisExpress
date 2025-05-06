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

# Railway no permite la directiva VOLUME
# Para datos persistentes, usa Railway Volumes desde el panel de control
# https://docs.railway.app/reference/volumes

# Crear directorios para imágenes y base de datos SQLite
RUN mkdir -p /app/imagenes_inmuebles /app/data

# Comando para iniciar la aplicación
CMD ["node", "app.js"]
