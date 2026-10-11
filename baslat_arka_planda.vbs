Option Explicit
Dim WshShell, fso, strPath, i, cmd, chromeProxy, chromeExe, pwaAppId

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

Function IsServerOnline()
    IsServerOnline = False
    On Error Resume Next
    Dim http
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "GET", "http://127.0.0.1:8000/api/auth/status", False
    http.setTimeouts 600, 600, 600, 600
    http.Send
    If Err.Number = 0 Then
        If http.Status = 200 Then
            IsServerOnline = True
        End If
    End If
    Set http = Nothing
    Err.Clear
    On Error GoTo 0
End Function

' 1. Sunucu calismiyorsa arka planda baslat
If Not IsServerOnline() Then
    cmd = Chr(34) & strPath & "\.venv\Scripts\pythonw.exe" & Chr(34) & " " & Chr(34) & strPath & "\run_silent.py" & Chr(34)
    WshShell.Run cmd, 0, False
    
    ' Sunucunun hazir olmasini bekle (en fazla 15 saniye)
    For i = 1 To 30
        WScript.Sleep 500
        If IsServerOnline() Then Exit For
    Next
End If

' 2. Uygulama arayuzunu ac (PWA veya Chrome App modu)
chromeProxy = "C:\Program Files\Google\Chrome\Application\chrome_proxy.exe"
chromeExe = "C:\Program Files\Google\Chrome\Application\chrome.exe"
pwaAppId = "fkjkjjjmlkjnchecijnlhmphnfkpohfc"

If fso.FileExists(chromeProxy) Then
    WshShell.Run Chr(34) & chromeProxy & Chr(34) & " --profile-directory=Default --app-id=" & pwaAppId, 1, False
ElseIf fso.FileExists(chromeExe) Then
    WshShell.Run Chr(34) & chromeExe & Chr(34) & " --app=http://localhost:8000", 1, False
Else
    WshShell.Run "http://localhost:8000", 1, False
End If

Set WshShell = Nothing
Set fso = Nothing
