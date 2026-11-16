param([string]$InstallDirectory = "$env:USERPROFILE\.research-compass\catalog-sync")
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\Modules'
$inputText=[Console]::In.ReadLine()
$config=$inputText|ConvertFrom-Json
$credentialFile=Join-Path (Split-Path $InstallDirectory) 'cloud-catalog-sync.xml'
New-Item -ItemType Directory -Path $InstallDirectory -Force|Out-Null
foreach($name in @('catalog-reader.mjs','sync-client.mjs','Sync-ResearchCompass.ps1','Launch-CatalogSync.vbs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $InstallDirectory $name) -Force}
@{Service=ConvertTo-SecureString $config.service -AsPlainText -Force;Secret=ConvertTo-SecureString $config.secret -AsPlainText -Force}|Export-Clixml -LiteralPath $credentialFile
$config=$null;$inputText=$null
$taskName='Research Compass - Codex catalog sync'
$wscript=Join-Path $env:WINDIR 'System32\wscript.exe'
$launcher=Join-Path $InstallDirectory 'Launch-CatalogSync.vbs'
$action=New-ScheduledTaskAction -Execute $wscript -Argument ('//B //NoLogo "'+$launcher+'"')
$triggers=@((New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)),(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1)))
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3)
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($existing -and -not ($existing.Actions.Arguments -match 'ResearchCompass')){throw 'A different scheduled task already uses this name.'}
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Description 'Refresh private Research Compass project/chat metadata hourly while signed in. No messages, transcripts, or project files are read.' -Force|Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output '{"installed":true,"intervalMinutes":60,"credentials":"Windows DPAPI protected","task":"Research Compass - Codex catalog sync"}'
