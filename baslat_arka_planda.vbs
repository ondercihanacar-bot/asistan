Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

' Pythonw ve run_silent.py ile penceresiz başlat
cmd = chr(34) & strPath & "\.venv\Scripts\pythonw.exe" & chr(34) & " " & chr(34) & strPath & "\run_silent.py" & chr(34)
WshShell.Run cmd, 0, False

' 2.5 saniye bekle ve tarayıcıyı aç
WScript.Sleep 2500
WshShell.Run "http://localhost:8000"
Set WshShell = Nothing
