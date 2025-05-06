/**
 * Script para configurar la base de datos MySQL en Docker
 * 
 * Este script configura un contenedor Docker con MySQL para ser utilizado
 * por SyncOrbisExpress. Ideal para entornos de DESARROLLO donde se prefiere
 * usar Docker para simplificar la configuración.
 * 
 * NOTA: Este script es COMPLETAMENTE OPCIONAL. Si prefieres usar una base de datos
 * MySQL local o en producción, simplemente no ejecutes este script y configura
 * las variables de entorno en el archivo .env para apuntar a tu servidor MySQL.
 * 
 * Uso:
 * node scripts/setup-docker.js [--force]
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// Implementación simple para colorear la salida
const chalk = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

// Cargar variables de entorno
dotenv.config();

// Procesar argumentos de línea de comandos
const args = process.argv.slice(2);
const force = args.includes('--force');

// Configuración
const config = {
  dbType: process.env.DB_TYPE || 'mysql',
  mysqlHost: process.env.MYSQL_HOST || process.env.DB_HOST || 'mysql',
  mysqlPort: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
  mysqlUser: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  mysqlDatabase: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'inmuebles',
  dockerNetwork: process.env.DOCKER_NETWORK || 'syncorbis-network',
  dockerMysqlContainer: process.env.DOCKER_MYSQL_CONTAINER || 'syncorbis-mysql',
  dockerMysqlRootPassword: process.env.DOCKER_MYSQL_ROOT_PASSWORD || 'syncorbis',
  force: force
};

/**
 * Verifica si Docker está instalado y configurado
 */
function checkDocker() {
  console.log(chalk.blue('Verificando Docker...'));
  try {
    execSync('docker --version', { stdio: 'pipe' });
    console.log(chalk.green('✓ Docker está instalado'));
    return true;
  } catch (error) {
    console.log(chalk.red('✗ Docker no está instalado o no está disponible'));
    console.log(chalk.yellow('Por favor instala Docker para continuar.'));
    process.exit(1);
  }
}

/**
 * Configura la red de Docker
 */
function setupDockerNetwork() {
  console.log(chalk.blue(`Verificando red Docker '${config.dockerNetwork}'...`));
  
  try {
    // Verificar si la red de Docker existe
    const networkExists = execSync(`docker network ls --filter name=${config.dockerNetwork} --format "{{.Name}}"`, { stdio: 'pipe' }).toString().trim() === config.dockerNetwork;
    
    if (!networkExists) {
      console.log(chalk.yellow(`Red Docker '${config.dockerNetwork}' no encontrada. Creando...`));
      execSync(`docker network create ${config.dockerNetwork}`, { stdio: 'pipe' });
      console.log(chalk.green(`✓ Red Docker '${config.dockerNetwork}' creada correctamente`));
    } else {
      console.log(chalk.green(`✓ Red Docker '${config.dockerNetwork}' encontrada`));
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`✗ Error al configurar la red Docker: ${error.message}`));
    return false;
  }
}

/**
 * Configura el contenedor MySQL en Docker
 */
function setupMySQLContainer() {
  console.log(chalk.blue(`Verificando contenedor MySQL '${config.dockerMysqlContainer}'...`));
  
  try {
    // Verificar si el contenedor MySQL existe
    const containerExists = execSync(`docker ps -a --filter name=${config.dockerMysqlContainer} --format "{{.Names}}"`, { stdio: 'pipe' }).toString().trim() === config.dockerMysqlContainer;
    
    if (!containerExists || config.force) {
      if (containerExists && config.force) {
        console.log(chalk.yellow(`Eliminando contenedor MySQL existente '${config.dockerMysqlContainer}'...`));
        execSync(`docker rm -f ${config.dockerMysqlContainer}`, { stdio: 'pipe' });
      }
      
      console.log(chalk.yellow(`Creando contenedor MySQL '${config.dockerMysqlContainer}'...`));
      execSync(`docker run --name ${config.dockerMysqlContainer} \
        -e MYSQL_ROOT_PASSWORD=${config.dockerMysqlRootPassword} \
        -e MYSQL_DATABASE=${config.mysqlDatabase} \
        -p ${config.mysqlPort}:3306 \
        --network ${config.dockerNetwork} \
        -d mysql:5.7`, { stdio: 'pipe' });
      console.log(chalk.green(`✓ Contenedor MySQL '${config.dockerMysqlContainer}' creado correctamente`));
      
      // Esperar a que MySQL esté listo
      console.log(chalk.blue('Esperando a que MySQL esté listo...'));
      let ready = false;
      let attempts = 0;
      
      while (!ready && attempts < 30) {
        try {
          execSync(`docker exec ${config.dockerMysqlContainer} mysqladmin ping -h localhost -u root -p${config.dockerMysqlRootPassword}`, { stdio: 'pipe' });
          ready = true;
        } catch (e) {
          process.stdout.write('.');
          attempts++;
          // Esperar 1 segundo antes de intentar de nuevo
          execSync('sleep 1');
        }
      }
      
      if (ready) {
        console.log('\n' + chalk.green('✓ MySQL en Docker está listo'));
      } else {
        console.log('\n' + chalk.red('✗ Tiempo de espera agotado para MySQL en Docker'));
        return false;
      }
    } else {
      // Verificar si el contenedor está en ejecución
      const containerRunning = execSync(`docker ps --filter name=${config.dockerMysqlContainer} --format "{{.Names}}"`, { stdio: 'pipe' }).toString().trim() === config.dockerMysqlContainer;
      
      if (!containerRunning) {
        console.log(chalk.yellow(`Contenedor MySQL '${config.dockerMysqlContainer}' no está en ejecución. Iniciando...`));
        execSync(`docker start ${config.dockerMysqlContainer}`, { stdio: 'pipe' });
        console.log(chalk.green(`✓ Contenedor MySQL '${config.dockerMysqlContainer}' iniciado correctamente`));
        
        // Esperar a que MySQL esté listo
        console.log(chalk.blue('Esperando a que MySQL esté listo...'));
        let ready = false;
        let attempts = 0;
        
        while (!ready && attempts < 15) {
          try {
            execSync(`docker exec ${config.dockerMysqlContainer} mysqladmin ping -h localhost -u root -p${config.dockerMysqlRootPassword}`, { stdio: 'pipe' });
            ready = true;
          } catch (e) {
            process.stdout.write('.');
            attempts++;
            // Esperar 1 segundo antes de intentar de nuevo
            execSync('sleep 1');
          }
        }
        
        if (ready) {
          console.log('\n' + chalk.green('✓ MySQL en Docker está listo'));
        } else {
          console.log('\n' + chalk.yellow('⚠ No se pudo verificar que MySQL esté listo, pero continuaremos...'));
        }
      } else {
        console.log(chalk.green(`✓ Contenedor MySQL '${config.dockerMysqlContainer}' está en ejecución`));
      }
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red(`✗ Error al configurar el contenedor MySQL: ${error.message}`));
    return false;
  }
}

/**
 * Actualiza el archivo .env con la configuración de Docker
 */
function updateEnvFile() {
  console.log(chalk.blue('Actualizando archivo .env...'));
  
  try {
    // Verificar si existe el archivo .env
    if (!fs.existsSync('.env')) {
      if (fs.existsSync('.env.example')) {
        console.log(chalk.yellow('Archivo .env no encontrado. Copiando desde .env.example...'));
        fs.copyFileSync('.env.example', '.env');
      } else {
        console.log(chalk.yellow('Archivo .env no encontrado. Creando uno básico...'));
        fs.writeFileSync('.env', `DB_TYPE=mysql
MYSQL_HOST=${config.mysqlHost}
MYSQL_PORT=${config.mysqlPort}
MYSQL_USER=${config.mysqlUser}
MYSQL_PASSWORD=${config.dockerMysqlRootPassword}
MYSQL_DATABASE=${config.mysqlDatabase}
DOCKER_NETWORK=${config.dockerNetwork}
DOCKER_MYSQL_CONTAINER=${config.dockerMysqlContainer}
DOCKER_MYSQL_ROOT_PASSWORD=${config.dockerMysqlRootPassword}
IMAGES_FOLDER=./public/images/inmuebles`);
      }
    }
    
    // Leer el archivo .env
    let envContent = fs.readFileSync('.env', 'utf8');
    
    // Actualizar o añadir variables de entorno para Docker
    const envVars = {
      'DB_TYPE': 'mysql',
      'MYSQL_HOST': config.mysqlHost,
      'MYSQL_PORT': config.mysqlPort.toString(),
      'MYSQL_USER': config.mysqlUser,
      'MYSQL_PASSWORD': config.dockerMysqlRootPassword,
      'MYSQL_DATABASE': config.mysqlDatabase,
      'DOCKER_NETWORK': config.dockerNetwork,
      'DOCKER_MYSQL_CONTAINER': config.dockerMysqlContainer,
      'DOCKER_MYSQL_ROOT_PASSWORD': config.dockerMysqlRootPassword
    };
    
    // Actualizar cada variable de entorno
    for (const [key, value] of Object.entries(envVars)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (envContent.match(regex)) {
        // La variable existe, actualizarla
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // La variable no existe, añadirla
        envContent += `\n${key}=${value}`;
      }
    }
    
    // Guardar el archivo .env actualizado
    fs.writeFileSync('.env', envContent);
    
    console.log(chalk.green('✓ Archivo .env actualizado correctamente'));
    return true;
  } catch (error) {
    console.log(chalk.red(`✗ Error al actualizar el archivo .env: ${error.message}`));
    return false;
  }
}

/**
 * Muestra instrucciones para usar la base de datos en Docker
 */
function showInstructions() {
  console.log('\n' + chalk.bold('=== Instrucciones para usar la base de datos en Docker ==='));
  console.log(chalk.blue('1. La base de datos MySQL está configurada en Docker'));
  console.log(chalk.blue(`2. Contenedor: ${config.dockerMysqlContainer}`));
  console.log(chalk.blue(`3. Puerto: ${config.mysqlPort}`));
  console.log(chalk.blue(`4. Usuario: ${config.mysqlUser}`));
  console.log(chalk.blue(`5. Contraseña: ${config.dockerMysqlRootPassword}`));
  console.log(chalk.blue(`6. Base de datos: ${config.mysqlDatabase}`));
  console.log(chalk.blue('7. Para conectarte a la base de datos desde la aplicación:'));
  console.log(chalk.blue(`   - Host: ${config.mysqlHost}`));
  console.log(chalk.blue(`   - Puerto: ${config.mysqlPort}`));
  console.log('\n' + chalk.bold('=== Comandos útiles ==='));
  console.log(chalk.blue(`- Ver logs del contenedor: docker logs ${config.dockerMysqlContainer}`));
  console.log(chalk.blue(`- Acceder a MySQL: docker exec -it ${config.dockerMysqlContainer} mysql -u root -p${config.dockerMysqlRootPassword}`));
  console.log(chalk.blue(`- Detener el contenedor: docker stop ${config.dockerMysqlContainer}`));
  console.log(chalk.blue(`- Iniciar el contenedor: docker start ${config.dockerMysqlContainer}`));
  console.log('\n' + chalk.bold('=== Siguiente paso ==='));
  console.log(chalk.blue('Ejecuta el script de configuración principal:'));
  console.log(chalk.blue('node scripts/setup.js --docker'));
}

/**
 * Función principal
 */
async function main() {
  console.log(chalk.bold('=== Configuración de MySQL en Docker para SyncOrbisExpress ===\n'));
  
  // Verificar Docker
  if (!checkDocker()) {
    return;
  }
  
  // Configurar red de Docker
  if (!setupDockerNetwork()) {
    return;
  }
  
  // Configurar contenedor MySQL
  if (!setupMySQLContainer()) {
    return;
  }
  
  // Actualizar archivo .env
  if (!updateEnvFile()) {
    return;
  }
  
  console.log('\n' + chalk.green('✓ Configuración de MySQL en Docker completada correctamente'));
  
  // Mostrar instrucciones
  showInstructions();
}

// Ejecutar la función principal
main().catch(error => {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
});
