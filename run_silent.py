import sys
import os
import time

if sys.stdout is None:
    sys.stdout = open("app_stdout.log", "a", encoding="utf-8", buffering=1)
if sys.stderr is None:
    sys.stderr = open("app_stderr.log", "a", encoding="utf-8", buffering=1)

import uvicorn

if __name__ == "__main__":
    for attempt in range(30):
        try:
            config = uvicorn.Config("main:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
            server = uvicorn.Server(config)
            server.run()
            break
        except Exception as e:
            if sys.stderr:
                sys.stderr.write(f"Server start retry {attempt}: {e}\n")
            time.sleep(2)
