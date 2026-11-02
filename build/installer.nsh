!macro customInstall
  WriteRegStr HKCU "Software\Classes\DriftURL" "" "Drift web link"
  WriteRegStr HKCU "Software\Classes\DriftURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\DriftURL\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\DriftURL\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" -- "%1"'
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift" "" "Drift"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift\Capabilities" "ApplicationName" "Drift"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift\Capabilities" "ApplicationDescription" "Browse web links with Drift."
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift\Capabilities" "ApplicationIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift\Capabilities\Startmenu" "StartMenuInternet" "Drift"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift\Capabilities\URLAssociations" "http" "DriftURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Drift\Capabilities\URLAssociations" "https" "DriftURL"
  WriteRegStr HKCU "Software\RegisteredApplications" "Drift" "Software\Clients\StartMenuInternet\Drift\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\RegisteredApplications" "Drift"
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Drift"
  DeleteRegKey HKCU "Software\Classes\DriftURL"
!macroend
