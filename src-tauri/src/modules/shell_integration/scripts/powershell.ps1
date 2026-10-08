# Pragma shell integration: marks prompts and commands with OSC 133.
if (-not $Global:__PragmaShellIntegration) {
    $Global:__PragmaShellIntegration = $true
    $Global:__PragmaCommandRunning = $false
    $Global:__PragmaOriginalPrompt = $function:prompt

    function Global:prompt {
        $succeeded = $?
        $exitCode = $Global:LASTEXITCODE
        $esc = [char]0x1b
        $bel = [char]0x07
        $marks = ""
        if ($Global:__PragmaCommandRunning) {
            $Global:__PragmaCommandRunning = $false
            $code = if ($succeeded) { 0 } elseif ($exitCode -is [int] -and $exitCode -ne 0) { $exitCode } else { 1 }
            $marks += "$esc]133;D;$code$bel"
        }
        $marks += "$esc]133;A$bel"
        $text = & $Global:__PragmaOriginalPrompt
        $Global:LASTEXITCODE = $exitCode
        "$marks$text$esc]133;B$bel"
    }

    if (Test-Path Function:\PSConsoleHostReadLine) {
        $Global:__PragmaOriginalReadLine = $function:PSConsoleHostReadLine
        function Global:PSConsoleHostReadLine {
            $line = & $Global:__PragmaOriginalReadLine
            if (-not [string]::IsNullOrWhiteSpace($line)) {
                $Global:__PragmaCommandRunning = $true
                [Console]::Write("$([char]0x1b)]133;C$([char]0x07)")
            }
            $line
        }
    }
}
