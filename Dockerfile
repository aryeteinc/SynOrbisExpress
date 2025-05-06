FROM node:16-alpine

WORKDIR /app

# Instalar solo las dependencias de producción
COPY package*.json ./
RUN npm ci --only=production

# Copiar solo los archivos necesarios
COPY app.js ./
COPY scripts ./scripts
COPY src ./src
COPY .env.example ./

# Exponer puerto (Railway asigna PORT automáticamente)
EXPOSE 3000

# Crear directorios para imágenes
RUN mkdir -p /app/public/images/inmuebles /app/logs

# Comando para iniciar la aplicación
CMD ["node", "app.js"]
