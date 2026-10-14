$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$databaseId = Read-Host 'D1 database_id (UUID)'
$namespaceId = Read-Host 'KV id (32 hex characters)'
if ($databaseId -notmatch '^[0-9a-fA-F-]{36}$' -or $namespaceId -notmatch '^[0-9a-fA-F]{32}$') { throw 'Invalid D1 or KV ID. Nothing saved.' }
$config = @{
  name = 'id4-ha-cloud'; main = 'src/worker.js'; compatibility_date = '2026-05-14'; workers_dev = $true
  d1_databases = @(@{binding = 'DB'; database_name = 'id4-ha-db'; database_id = $databaseId})
  kv_namespaces = @(@{binding = 'SNAPSHOTS'; id = $namespaceId})
}
$json = $config | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'wrangler.json'), $json, [System.Text.UTF8Encoding]::new($false))
node (Join-Path $PSScriptRoot 'configure_storage.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Storage policy configuration failed.' }
Write-Host 'wrangler.json saved. No deployment performed.'
