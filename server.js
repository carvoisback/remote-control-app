require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const net = require('net');  // Añadido para comunicarte con listener.exe

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuración de AWS S3 usando variables de entorno
const s3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY, 
    secretAccessKey: process.env.SECRET_KEY, 
    region: process.env.REGION,
});

// Comunicación con listener.exe (puerto y host del cliente)
const LISTENER_PORT = 65432;   // Puerto del listener.exe
const LISTENER_HOST = 'localhost';  // Si listener.exe se ejecuta en la misma máquina, usa localhost

// Asegúrate de que la carpeta screenshots existe
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('getScreenshot', () => {
        // Conexión al listener.exe para solicitar captura de pantalla
        const client = new net.Socket();
        client.connect(LISTENER_PORT, LISTENER_HOST, () => {
            console.log('Connected to listener.exe, sending capture command...');
            client.write('captureScreenshot');
        });

        client.on('data', (data) => {
            console.log('Response from listener.exe:', data.toString());

            // Una vez que la captura esté lista, se procesa
            let screenshotNumber = 1;
            let screenshotPath;

            do {
                screenshotPath = path.join(screenshotsDir, `screenshot${screenshotNumber}.png`);
                screenshotNumber++;
            } while (fs.existsSync(screenshotPath));

            // Subir la captura a S3
            const screenshotKey = `screenshots/screenshot${screenshotNumber - 1}.png`;
            s3.upload({
                Bucket: process.env.BUCKET_NAME, 
                Key: screenshotKey,
                Body: fs.createReadStream(screenshotPath),
            }, (err, data) => {
                if (err) {
                    console.error('Error uploading to S3:', err);
                    return;
                }
                socket.emit('screenshotReady', data.Location);
            });

            client.destroy();  // Cierra la conexión una vez que se recibió la respuesta
        });

        client.on('close', () => {
            console.log('Connection to listener.exe closed');
        });

        client.on('error', (err) => {
            console.error('Error connecting to listener.exe:', err);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
