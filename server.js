require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuración de AWS S3 usando variables de entorno
const s3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY, // Usando variables de entorno
    secretAccessKey: process.env.SECRET_KEY, // Usando variables de entorno
    region: process.env.REGION, // Usando la variable de entorno para la región
});

// Asegurarte de que la carpeta screenshots existe
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('getScreenshot', () => {
        // Lógica para encontrar el siguiente número de captura
        let screenshotNumber = 1;
        let screenshotPath;

        do {
            screenshotPath = path.join(screenshotsDir, `screenshot${screenshotNumber}.png`);
            screenshotNumber++;
        } while (fs.existsSync(screenshotPath));

        // Comando para capturar la pantalla
        exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}'); Start-Sleep -Milliseconds 100; $img = [Windows.Forms.Clipboard]::GetImage(); $img.Save('${screenshotPath}');"`, (err) => {
            if (err) {
                console.error('Error capturing screenshot:', err);
                return;
            }

            // Subir la captura a S3
            const screenshotKey = `screenshots/screenshot${screenshotNumber - 1}.png`;
            s3.upload({
                Bucket: process.env.BUCKET_NAME, // Usando la variable de entorno para el nombre del bucket
                Key: screenshotKey,
                Body: fs.createReadStream(screenshotPath),
            }, (err, data) => {
                if (err) {
                    console.error('Error uploading to S3:', err);
                    return;
                }
                socket.emit('screenshotReady', data.Location); // data.Location contiene la URL de la imagen
            });
        });
    });

    socket.on('getSystemInfo', () => {
        exec('systeminfo', (err, stdout, stderr) => {
            if (err) {
                console.error('Error getting system info:', err);
                return;
            }
            socket.emit('systemInfo', stdout);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
