import { RedisManager } from '../src/index.js';

// Configuración de Redis
const redisConfig = {
    credentials: {
        host: 'localhost',
        port: 6379,
        // password: 'tu_contraseña', // Descomenta si necesitas autenticación
    }
};

// Crear instancia del RedisManager
const redisManager = new RedisManager({
    credentials: redisConfig.credentials,
    logLevel: 'debug'
});

// Función principal
async function main() {
    try {
        // Inicializar el RedisManager
        await redisManager.init();

        // Obtener un cliente Redis
        const client = await redisManager.getClient();

        // Publicar algunos mensajes de ejemplo
        const messages = [
            { id: 1, text: "Mensaje de prueba 1", priority: 1 },
            { id: 2, text: "Mensaje de prueba 2", priority: 2 },
            { id: 3, text: "Mensaje de prueba 3", priority: 3 }
        ];

        // Publicar mensajes en diferentes grupos
        for (const message of messages) {
            try {
                const scriptSha = redisManager.getScriptSha('enqueue');
                if (!scriptSha) {
                    console.error('Script de enqueue no encontrado');
                    continue;
                }

                const queueKey = 'qtask:WHATSAPP:groups';
                const groupKey = `qtask:WHATSAPP:group:batch${message.priority}`;

                await client.evalsha(
                    scriptSha,
                    2,
                    queueKey,
                    groupKey,
                    JSON.stringify(message),
                    `batch${message.priority}`,
                    message.priority,
                    0, // delay
                    3600 // TTL: 1 hora
                );

                console.log(`Mensaje ${message.id} publicado en batch${message.priority}`);
            } catch (error) {
                console.error(`Error publicando mensaje ${message.id}:`, error);
            }
        }

        // Liberar el cliente Redis
        await redisManager.releaseClient(client);

        // Cerrar el RedisManager
        await redisManager.close();
        
        console.log('Publicación completada');
    } catch (error) {
        console.error('Error en el publisher:', error);
    }
}

// Ejecutar el ejemplo
main().catch(console.error);
