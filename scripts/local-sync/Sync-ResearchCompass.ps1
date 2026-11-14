param([string]$CredentialPath = "$env:USERPROFILE\.research-compass\cloud-catalog-sync.xml",[string]$StateDirectory = "$env:USERPROFILE\.research-compass\catalog-sync",[switch]$Once)
$ErrorActionPreference='Stop'
$env:PSModulePath=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\Modules'
$mutex=New-Object Threading.Mutex($false,'Local\ResearchCompassCatalogSync')
if(-not $mutex.WaitOne(0)){exit 0}
try {
 New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
 $credential=Import-Clixml -LiteralPath $CredentialPath
 $payload=@{service=[Net.NetworkCredential]::new('', $credential.Service).Password;secret=[Net.NetworkCredential]::new('', $credential.Secret).Password;stateDirectory=$StateDirectory}|ConvertTo-Json -Compress
 $node=Join-Path $PSScriptRoot 'sync-client.mjs'
 $payload | & 'C:\Program Files\nodejs\node.exe' $node
 if($LASTEXITCODE -ne 0){throw 'Research Compass metadata sync failed. See sync-status.json.'}
} finally {$payload=$null;$credential=$null;$mutex.ReleaseMutex();$mutex.Dispose()}
