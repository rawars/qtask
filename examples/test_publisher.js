import { Queue } from '../src/index.js';

// Configuración del publisher
const publisher = new Queue({
    credentials: {
        host: 'localhost',
        port: 6379,
        // password: 'your_password' // opcional
    },
    type: 'publisher',
    logLevel: 'debug' // más información en los logs
});

// Función principal
async function main() {
    try {
        // Inicializar el publisher
        await publisher.init();
        console.log('Publisher inicializado correctamente');

        // Ejemplo 1: Enviar un trabajo simple
        const jobId1 = await publisher.add(
            'emails',
            'notifications',
            {
                to: 'usuario@ejemplo.com',
                subject: 'Bienvenido',
                body: 'Bienvenido a nuestra plataforma'
            }
        );
        console.log(`Trabajo 1 agregado con ID: ${jobId1}`);

        // Ejemplo 2: Enviar múltiples trabajos
        const jobs = [];
        for (let i = 0; i < 5; i++) {
            const jobId = await publisher.add(
                'emails',
                'notifications',
                {
                    to: `usuario${i}@ejemplo.com`,
                    subject: `Notificación ${i}`,
                    body: `Este es el contenido de la notificación ${i}`
                }
            );
            jobs.push(jobId);
            console.log(`Trabajo ${i + 2} agregado con ID: ${jobId}`);
        }

        // Ejemplo 3: Enviar un trabajo a una cola diferente
        const jobId2 = await publisher.add(
            'push_notifications',
            'mobile',
            {
                userId: '12345',
                title: 'Nueva actualización',
                message: 'Hay una nueva versión disponible'
            }
        );
        console.log(`Trabajo de notificación push agregado con ID: ${jobId2}`);

        // Cerrar el publisher cuando hayamos terminado
        await publisher.close();
        console.log('Publisher cerrado correctamente');

    } catch (error) {
        console.error('Error:', error);
        // Intentar cerrar el publisher en caso de error
        try {
            await publisher.close();
        } catch (closeError) {
            console.error('Error al cerrar el publisher:', closeError);
        }
    }
}

// Manejar el cierre graceful de la aplicación
process.on('SIGINT', async () => {
    console.log('\nCerrando el publisher...');
    try {
        await publisher.close();
        console.log('Publisher cerrado correctamente');
        process.exit(0);
    } catch (error) {
        console.error('Error al cerrar el publisher:', error);
        process.exit(1);
    }
});

// Ejecutar el ejemplo
main();
