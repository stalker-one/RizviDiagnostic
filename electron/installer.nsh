!macro customInstall
  ; Ensure Windows Programs and Features has an explicit publisher value.
  WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" "Publisher" "Mian Bilal"
!macroend

!macro customUnInstall
  ; electron-builder removes the uninstall registry entry.
!macroend
