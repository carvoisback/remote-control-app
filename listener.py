import socket
import os
import pyautogui
from datetime import datetime

# Configuración del servidor
HOST = '0.0.0.0'  # Escucha en todas las interfaces
PORT = 65432      # Puerto que debe coincidir con el que envía la orden desde el servidor

# Crear la carpeta screenshots si no existe
screenshots_dir = 'screenshots'
if not os.path.exists(screenshots_dir):
    os.makedirs(screenshots_dir)

# Función para capturar pantalla
def capture_screenshot():
    screenshot = pyautogui.screenshot()
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    screenshot_path = os.path.join(screenshots_dir, f'screenshot_{timestamp}.png')
    screenshot.save(screenshot_path)
    return screenshot_path

# Inicia el servidor
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind((HOST, PORT))
    s.listen()
    print(f'Listener running on {HOST}:{PORT}, waiting for commands...')

    while True:
        conn, addr = s.accept()
        with conn:
            print(f'Connected by {addr}')
            data = conn.recv(1024).decode('utf-8')
            
            if data == 'captureScreenshot':
                print('Capturing screenshot...')
                screenshot_path = capture_screenshot()
                print(f'Screenshot saved to {screenshot_path}')
                conn.sendall(b'Screenshot captured')

