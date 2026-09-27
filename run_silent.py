import sys
import os

# Windows pythonw has sys.stdout and sys.stderr as None
if sys.stdout is None:
    sys.stdout = open("app_stdout.log", "a", encoding="utf-8", buffering=1)
if sys.stderr is None:
    sys.stderr = open("app_stderr.log", "a", encoding="utf-8", buffering=1)

import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
