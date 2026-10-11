Option Explicit
Dim WshShell, fso, strPath, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

' Sunucuyu arka planda sessizce baslat
cmd = Chr(34) & strPath & "\.venv\Scripts\pythonw.exe" & Chr(34) & " " & Chr(34) & strPath & "\run_silent.py" & Chr(34)
WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
