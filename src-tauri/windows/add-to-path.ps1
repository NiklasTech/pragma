param([string]$InstallDir)

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    exit 0
}

$target = [EnvironmentVariableTarget]::User
$current = [Environment]::GetEnvironmentVariable('Path', $target)
$entries = $current -split ';' | Where-Object { $_ -ne '' }

if ($entries -notcontains $InstallDir) {
    [Environment]::SetEnvironmentVariable('Path', "$current;$InstallDir", $target)
}
