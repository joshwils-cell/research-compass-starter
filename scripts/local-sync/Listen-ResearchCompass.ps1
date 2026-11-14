param([string]$CredentialPath = "$env:USERPROFILE\.research-compass\cloud-catalog-sync.xml",[string]$StateDirectory = "$env:USERPROFILE\.research-compass\catalog-sync")
$ErrorActionPreference='Stop'
$mutex=New-Object Threading.Mutex($false,'Local\ResearchCompassRefreshListener')
if(-not $mutex.WaitOne(0)){exit 0}
try {
 $credential=Import-Clixml -LiteralPath $CredentialPath
 $payload=@{service=[Net.NetworkCredential]::new('', $credential.Service).Password;secret=[Net.NetworkCredential]::new('', $credential.Secret).Password;stateDirectory=$StateDirectory}|ConvertTo-Json -Compress
 $node=Join-Path $PSScriptRoot 'refresh-listener.mjs'
 $payload | & 'C:\Program Files\nodejs\node.exe' $node
 if($LASTEXITCODE -ne 0){throw 'Research Compass refresh listener stopped.'}
} finally {$payload=$null;$credential=$null;$mutex.ReleaseMutex();$mutex.Dispose()}
