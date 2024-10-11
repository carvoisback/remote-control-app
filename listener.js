require('dotenv').config();
const net = require('net');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

// Configuración de AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
    region: process.env.REGION,
});

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

const server = net.createServer((socket) => {
    console.log('Listener running on 0.0.0.0:65432, waiting for commands...');

    socket.on('data', (data) => {
        if (data.toString() === 'capture') {
            console.log('Capture command received');

            // Lógica para generar el nombre de la captura
            let screenshotNumber = 1;
            let screenshotPath;
            do {
                screenshotPath = path.join(screenshotsDir, `screenshot${screenshotNumber}.png`);
                screenshotNumber++;
            } while (fs.existsSync(screenshotPath));

            // Captura de pantalla usando PowerShell
            exec(`powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}'); Start-Sleep -Milliseconds 100; $img = [Windows.Forms.Clipboard]::GetImage(); $img.Save('${screenshotPath}');"`, (err) => {
                if (err) {
                    console.error('Error capturing screenshot:', err);
                    socket.write('Error capturing screenshot');
                    return;
                }

                // Subir captura a S3
                const screenshotKey = `screenshots/screenshot${screenshotNumber - 1}.png`;
                s3.upload({
                    Bucket: process.env.BUCKET_NAME,
                    Key: screenshotKey,
                    Body: fs.createReadStream(screenshotPath),
                }, (err, data) => {
                    if (err) {
                        console.error('Error uploading to S3:', err);
                        socket.write('Error uploading to S3');
                        return;
                    }

                    socket.write(data.Location); // Enviar la URL de la imagen al server.js
                });
            });
        }
    });

    socket.on('close', () => {
        console.log('Client disconnected');
    });
});

server.listen(65432, '0.0.0.0');
