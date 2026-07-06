param([string]$InstallDir)

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    exit 0
}

$target = [EnvironmentVariableTarget]::User
$current = [Environment]::GetEnvironmentVariable('Path', $target)
$entries = $current -split ';' | Where-Object { $_ -ne '' -and $_ -ne $InstallDir }
$newPath = $entries -join ';'

[Environment]::SetEnvironmentVariable('Path', $newPath, $target)
