require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net'); // Para comunicación con listener.js

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('getScreenshot', () => {
        // Conectar con listener.js
        const client = new net.Socket();
        client.connect(65432, '192.168.18.35', () => { // Cambié '127.0.0.1' a tu IP
            console.log('Connected to listener.js');
            client.write('capture'); // Mandar la orden de captura al listener.js
        });

        client.on('data', (data) => {
            console.log('Listener response:', data.toString());
            socket.emit('screenshotReady', data.toString()); // Envía la URL de la captura al cliente
            client.destroy(); // Cerrar conexión después de recibir la respuesta
        });

        client.on('error', (err) => {
            console.error('Error connecting to listener:', err);
            socket.emit('error', 'Failed to connect to listener');
        });

        client.on('close', () => {
            console.log('Connection closed');
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
