import { RedisManager, Subscriber } from '../src/index.js';

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

// Función para procesar mensajes
function handleMessage(job, done) {
    console.log('Procesando mensaje:', job);
    
    // Simular algún procesamiento
    setTimeout(() => {
        console.log(`Mensaje ${job.id} procesado exitosamente`);
        done(); // Llamar done() sin argumentos indica éxito
    }, 1000);

    // Para simular un error, podrías hacer:
    // done(new Error('Error procesando mensaje'));
}

// Función principal
async function main() {
    try {
        // Inicializar el RedisManager
        await redisManager.init();

        // Crear subscribers para diferentes grupos
        const subscribers = [];
        const numBatches = 3;

        for (let i = 1; i <= numBatches; i++) {
            const subscriber = new Subscriber(
                `session_${i}`,
                'WHATSAPP',
                handleMessage,
                'debug'
            );

            subscribers.push(subscriber);

            // Simular procesamiento de mensajes
            setInterval(async () => {
                try {
                    const client = await redisManager.getClient();
                    const scriptSha = redisManager.getScriptSha('dequeue');
                    
                    if (!scriptSha) {
                        console.error('Script de dequeue no encontrado');
                        return;
                    }

                    const groupKey = `qtask:WHATSAPP:group:batch${i}`;
                    const result = await client.evalsha(scriptSha, 1, groupKey);

                    if (result && Array.isArray(result)) {
                        const [jobId, jobDataStr, groupName] = result;
                        const jobData = JSON.parse(jobDataStr);
                        
                        await subscriber.process({
                            id: jobId,
                            data: jobData,
                            groupName
                        });
                    }

                    await redisManager.releaseClient(client);
                } catch (error) {
                    console.error(`Error en subscriber ${i}:`, error);
                }
            }, 2000); // Revisar cada 2 segundos
        }

        console.log(`${numBatches} subscribers iniciados`);

        // Mantener el proceso corriendo
        process.on('SIGINT', async () => {
            console.log('\nCerrando subscribers...');
            await redisManager.close();
            process.exit(0);
        });

    } catch (error) {
        console.error('Error en el subscriber:', error);
        await redisManager.close();
        process.exit(1);
    }
}

// Ejecutar el ejemplo
main().catch(console.error);
