param([switch]$Simulado, [switch]$Desktop)
$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$oldBridgeKey = $env:SIX_TEST_BRIDGE_KEY
$secureBridgeKey = $null
try {
  if (-not $Simulado) {
    Write-Host 'Teste local da Six. A ponte Lovable precisa estar com validade ativa.'
    $secureBridgeKey = Read-Host 'Cole SIX_TEST_BRIDGE_KEY (entrada oculta)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureBridgeKey)
    try { $env:SIX_TEST_BRIDGE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($env:SIX_TEST_BRIDGE_KEY.Length -lt 32) { throw 'Chave de teste precisa ter pelo menos 32 caracteres.' }
  }
  Push-Location -LiteralPath $projectDirectory
  try {
    $entrypoint = if ($Desktop) { 'integrations/lovable-test/desktop-local-server.ts' } else { 'integrations/lovable-test/claude-local-interactive.ts' }
    $nodeArguments = @('--experimental-strip-types', '--import', './scripts/test-register.mjs', $entrypoint)
    if ($Desktop) { $env:SIX_LOCAL_CLIENT_KEY = 'sk-rt-1dcb0b56132bd75f90d6f23ab8d50eae0517d297f1a3804f'; Write-Host 'Mantenha esta janela aberta. Desktop: http://127.0.0.1:17866. Prazo: 30 minutos.' }
    if ($Simulado) { $nodeArguments += '--mock' }
    & 'C:/Program Files/nodejs/node.exe' @nodeArguments
  } finally { Pop-Location }
} finally {
  if ($null -eq $oldBridgeKey) { Remove-Item Env:SIX_TEST_BRIDGE_KEY -ErrorAction SilentlyContinue }
  else { $env:SIX_TEST_BRIDGE_KEY = $oldBridgeKey }
  if ($Desktop) { Remove-Item Env:SIX_LOCAL_CLIENT_KEY -ErrorAction SilentlyContinue }
  if ($secureBridgeKey) { $secureBridgeKey.Dispose() }
}
