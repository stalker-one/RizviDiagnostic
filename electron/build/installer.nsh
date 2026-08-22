!macro customInstall
  ; Ensure Programs and Features shows the intended publisher.
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher" "Mian Bilal"
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "Rizvi Diagnostic Center"
!macroend
