param(
    [switch]$Json,
    [string]$Root = "."
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scanScript = Join-Path $scriptDir "..\\scan_repo.py"
$resolvedRoot = (Resolve-Path $Root).Path

python $scanScript $resolvedRoot
