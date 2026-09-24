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
if ($LASTEXITCODE -eq 0) {
  Write-Host "Não há alterações de código para publicar." -ForegroundColor Yellow
  exit 0
}

& $git -C $repo commit -m $Mensagem
& $git -C $repo push origin migration/no-lovable

Write-Host "Publicado. A Vercel iniciará o deploy automaticamente." -ForegroundColor Green
