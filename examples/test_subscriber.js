import { Queue } from '../src/index.js';

// Configuración del subscriber
const subscriber = new Queue({
    credentials: {
        host: 'localhost',
        port: 6379,
        // password: 'your_password' // opcional
    },
    type: 'subscriber',
    logLevel: 'debug',
    consumerLimits: {
        emails: 3, // máximo 3 consumidores para la cola 'emails'
        push_notifications: 2 // máximo 2 consumidores para la cola 'push_notifications'
    }
});

// Función para simular el envío de un email
async function sendEmail(data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log('📧 Enviando email:');
            console.log(`   Para: ${data.to}`);
            console.log(`   Asunto: ${data.subject}`);
            console.log(`   Contenido: ${data.body}`);
            resolve();
        }, 1000);
    });
}

// Función para simular el envío de una notificación push
async function sendPushNotification(data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log('📱 Enviando notificación push:');
            console.log(`   Usuario: ${data.userId}`);
            console.log(`   Título: ${data.title}`);
            console.log(`   Mensaje: ${data.message}`);
            resolve();
        }, 500);
    });
}

// Función principal
async function main() {
    try {
        // Inicializar el subscriber
        await subscriber.init();
        console.log('Subscriber inicializado correctamente');

        // Procesar trabajos de email
        subscriber.process('emails', async (job, done) => {
            console.log(`\n📨 Procesando trabajo de email ${job.id}`);
            try {
                await sendEmail(job.data);
                console.log(`✅ Email enviado correctamente (${job.id})`);
                done();
            } catch (error) {
                console.error(`❌ Error enviando email (${job.id}):`, error);
                done(error);
            }
        });

        // Procesar notificaciones push
        subscriber.process('push_notifications', async (job, done) => {
            console.log(`\n📱 Procesando notificación push ${job.id}`);
            try {
                await sendPushNotification(job.data);
                console.log(`✅ Notificación push enviada correctamente (${job.id})`);
                done();
            } catch (error) {
                console.error(`❌ Error enviando notificación push (${job.id}):`, error);
                done(error);
            }
        });

        console.log('\n🚀 Subscriber listo para procesar trabajos...');
        console.log('   Presiona Ctrl+C para salir');

    } catch (error) {
        console.error('Error:', error);
        await subscriber.close();
        process.exit(1);
    }
}

// Manejar el cierre graceful de la aplicación
process.on('SIGINT', async () => {
    console.log('\n👋 Cerrando el subscriber...');
    try {
        await subscriber.close();
        console.log('✅ Subscriber cerrado correctamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al cerrar el subscriber:', error);
        process.exit(1);
    }
});

// Ejecutar el ejemplo
main();
