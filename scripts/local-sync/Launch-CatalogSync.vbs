Option Explicit

' Launch without allocating a visible console, including at process startup.
' Wait and preserve the sync exit code for Windows Task Scheduler.
Dim shell, files, powershell, script, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
powershell = shell.ExpandEnvironmentStrings("%WINDIR%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
script = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "Sync-ResearchCompass.ps1")
command = Chr(34) & powershell & Chr(34) & " -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File " & Chr(34) & script & Chr(34)
WScript.Quit shell.Run(command, 0, True)
