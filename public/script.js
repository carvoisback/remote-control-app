const socket = io();

document.getElementById('screenshotButton').addEventListener('click', () => {
    socket.emit('getScreenshot');
});

document.getElementById('systemInfoButton').addEventListener('click', () => {
    socket.emit('getSystemInfo');
});

socket.on('screenshotReady', (imagePath) => {
    document.getElementById('screenshot').src = imagePath + '?' + new Date().getTime(); // Agrega un timestamp para evitar caché
});

socket.on('systemInfo', (info) => {
    document.getElementById('systemInfo').textContent = info;
});
