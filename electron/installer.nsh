!macro customInstall
  ; electron-builder writes the app's uninstall entry under SHCTX, which
  ; resolves to HKLM for a per-machine install and HKCU for a per-user
  ; install. This app is per-user by default (perMachine is not set), so a
  ; hardcoded HKLM write here landed in a registry location Windows never
  ; reads for "Programs and Features" — the Publisher field stayed blank.
  ; Writing to SHCTX matches wherever electron-builder actually put the
  ; entry, for both install modes.
  WriteRegStr SHCTX "${UNINSTALL_REGISTRY_KEY}" "Publisher" "Mian Bilal"
!macroend

!macro customUnInstall
  ; electron-builder removes the uninstall registry entry.
!macroend
