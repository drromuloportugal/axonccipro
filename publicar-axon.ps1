param(
  [string]$Mensagem = "Atualiza Axon"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSCommandPath
$git = "C:\Program Files\Git\cmd\git.exe"

if (-not (Test-Path -LiteralPath $git)) {
  throw "Git não encontrado em: $git"
}

Write-Host "Preparando publicação do Axon..." -ForegroundColor Cyan

# Inclui mudanças do projeto, mas nunca envia o arquivo local de configuração.
& $git -C $repo add -A -- . ':(exclude).env'

& $git -C $repo diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  & $git -C $repo commit -m $Mensagem
} else {
  Write-Host "Nenhuma alteração nova para registrar; enviando commits pendentes." -ForegroundColor Yellow
}

& $git -C $repo push origin migration/no-lovable

Write-Host "Publicado. A Vercel iniciará o deploy automaticamente." -ForegroundColor Green
