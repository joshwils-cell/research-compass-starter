Option Explicit

' Start without allocating a visible console, including at sign-in.
' Wait so Task Scheduler tracks the listener and receives its exit code.
Dim shell, files, powershell, script, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
powershell = shell.ExpandEnvironmentStrings("%WINDIR%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
script = files.BuildPath(files.GetParentFolderName(WScript.ScriptFullName), "Listen-ResearchCompass.ps1")
command = Chr(34) & powershell & Chr(34) & " -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File " & Chr(34) & script & Chr(34)
WScript.Quit shell.Run(command, 0, True)
