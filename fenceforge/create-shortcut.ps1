$desktop = [System.Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($desktop + '\Fence Forge.lnk')
$sc.TargetPath = 'W:\Claude\Fence Forge\fenceforge\dist-electron\win-unpacked\Fence Forge.exe'
$sc.WorkingDirectory = 'W:\Claude\Fence Forge\fenceforge\dist-electron\win-unpacked'
$sc.Description = 'Fence Forge'
$sc.Save()
Write-Host "Shortcut created: $desktop\Fence Forge.lnk"
