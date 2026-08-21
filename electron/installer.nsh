!macro customInstall
  ; Match electron-builder's uninstall hive for both per-user and per-machine installs.
  WriteRegStr SHCTX "${UNINSTALL_REGISTRY_KEY}" "Publisher" "Mian Bilal"
  WriteRegStr SHCTX "${UNINSTALL_REGISTRY_KEY}" "DisplayName" "Rizvi Diagnostic Center"
!macroend

!macro customUnInstall
  ; electron-builder removes the uninstall registry entry.
!macroend
