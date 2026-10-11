# Publica una versión nueva de Trazo en GitHub.
#   1. Sube el número de "version" en package.json (por ejemplo 0.6.0 -> 0.7.0).
#   2. Ejecuta:  npm run release
# Las copias instaladas de Trazo verán la actualización y se actualizarán solas.

# Cada paso se revisa con $LASTEXITCODE. En Windows PowerShell, 'Stop' trataría
# cualquier aviso de gh o npm (como "release not found") como un error fatal.
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot '..')

$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$version = $pkg.version
$publish = $pkg.build.publish[0]
$repo = "$($publish.owner)/$($publish.repo)"
$out = "release/v$version"

Write-Host "Publicando Trazo $version en $repo" -ForegroundColor Cyan

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Primero inicia sesión en GitHub con: gh auth login' }

gh release view "v$version" --repo $repo 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw "La versión v$version ya está publicada. Sube el número en package.json." }

npm run build
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación' }

npx electron-builder --win --publish never "--config.directories.output=$out"
if ($LASTEXITCODE -ne 0) { throw 'Falló el instalador' }

$setup = "$out/Trazo-Setup-$version.exe"
# Copia con nombre fijo, para que el enlace de descarga nunca cambie.
Copy-Item $setup "$out/Trazo-Setup.exe" -Force

gh release create "v$version" --repo $repo --title "Trazo $version" --notes "Versión $version de Trazo." `
  $setup "$setup.blockmap" "$out/latest.yml" "$out/Trazo-Setup.exe"
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la versión en GitHub' }

Write-Host ''
Write-Host "Listo. Enlace de descarga (siempre la última versión):" -ForegroundColor Green
Write-Host "https://github.com/$repo/releases/latest/download/Trazo-Setup.exe"
