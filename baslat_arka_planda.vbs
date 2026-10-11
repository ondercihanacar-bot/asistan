Option Explicit
Dim WshShell, fso, strPath, i, cmd, chromePath

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

Function IsServerOnline()
    On Error Resume Next
    Dim http
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "GET", "http://127.0.0.1:8000/api/auth/status", False
    http.setTimeouts 800, 800, 800, 800
    http.Send
    If Err.Number = 0 And http.Status = 200 Then
        IsServerOnline = True
    Else
        IsServerOnline = False
    End If
    Set http = Nothing
    On Error GoTo 0
End Function

' 1. Sunucu calismiyorsa arka planda baslat
If Not IsServerOnline() Then
    cmd = Chr(34) & strPath & "\.venv\Scripts\pythonw.exe" & Chr(34) & " " & Chr(34) & strPath & "\run_silent.py" & Chr(34)
    WshShell.Run cmd, 0, False
    
    ' Sunucunun hazir olmasini bekle (en fazla 10 saniye)
    For i = 1 To 20
        WScript.Sleep 500
        If IsServerOnline() Then Exit For
    Next
End If

' 2. Chrome Uygulama Modunda veya varsayilan tarayicida ac
chromePath = ""
If fso.FileExists("C:\Program Files\Google\Chrome\Application\chrome.exe") Then
    chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
ElseIf fso.FileExists("C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") Then
    chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
ElseIf fso.FileExists(WshShell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")) Then
    chromePath = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")
End If

If chromePath <> "" Then
    WshShell.Run Chr(34) & chromePath & Chr(34) & " --app=http://localhost:8000"
Else
    WshShell.Run "http://localhost:8000"
End If

Set WshShell = Nothing
Set fso = Nothing
