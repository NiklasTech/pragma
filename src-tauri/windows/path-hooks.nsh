!macro NSIS_HOOK_POSTINSTALL
  ExecWait 'powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\resources\add-to-path.ps1" -InstallDir "$INSTDIR"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait 'powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\resources\remove-from-path.ps1" -InstallDir "$INSTDIR"'
!macroend
