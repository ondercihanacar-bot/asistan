import os
import sys
import socket
import time
import subprocess
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

def is_server_running(host="127.0.0.1", port=8000):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.6)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False

def start_server():
    pythonw = os.path.join(BASE_DIR, ".venv", "Scripts", "pythonw.exe")
    if not os.path.exists(pythonw):
        pythonw = sys.executable

    run_silent = os.path.join(BASE_DIR, "run_silent.py")
    
    # Windows detached background process flags
    DETACHED_PROCESS = 0x00000008
    CREATE_NO_WINDOW = 0x08000000
    flags = DETACHED_PROCESS | CREATE_NO_WINDOW

    subprocess.Popen(
        [pythonw, run_silent],
        cwd=BASE_DIR,
        creationflags=flags,
        close_fds=True
    )

def open_app():
    url = "http://localhost:8000"
    chrome_candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe")
    ]
    for cp in chrome_candidates:
        if os.path.exists(cp):
            try:
                subprocess.Popen([cp, f"--app={url}"])
                return
            except Exception:
                pass
    webbrowser.open(url)

def main():
    if not is_server_running():
        start_server()
        # Sunucunun ayağa kalkmasını bekle (en fazla 10 saniye)
        for _ in range(25):
            time.sleep(0.4)
            if is_server_running():
                break

    open_app()

if __name__ == "__main__":
    main()
