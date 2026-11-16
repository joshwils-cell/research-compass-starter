param([string]$InstallDirectory = "$env:USERPROFILE\.research-compass\catalog-sync")
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\Modules'
$credentialFile=Join-Path (Split-Path $InstallDirectory) 'cloud-catalog-sync.xml'
if(-not (Test-Path -LiteralPath $credentialFile)){throw 'Set up the existing catalog sync connection first.'}
foreach($name in @('refresh-listener.mjs','Listen-ResearchCompass.ps1','Launch-RefreshListener.vbs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $InstallDirectory $name) -Force}
$taskName='Research Compass - Manual refresh listener'
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($existing -and -not ($existing.Actions.Arguments -match '(Listen-ResearchCompass\.ps1|Launch-RefreshListener\.vbs)')){throw 'A different scheduled task already uses this name.'}
if($existing){Stop-ScheduledTask -TaskName $taskName}
$wscript=Join-Path $env:WINDIR 'System32\wscript.exe'
$launcher=Join-Path $InstallDirectory 'Launch-RefreshListener.vbs'
$action=New-ScheduledTaskAction -Execute $wscript -Argument ('//B //NoLogo "'+$launcher+'"')
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$trigger=New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Respond to user-requested Research Compass metadata refreshes while signed in. Uses the existing protected sync connection.' -Force|Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output '{"installed":true,"task":"Research Compass - Manual refresh listener","credentials":"existing DPAPI-protected connection reused","pollSeconds":5}'
