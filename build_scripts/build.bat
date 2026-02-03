@echo off
echo Building BrainCompanion App with PyInstaller...

REM Clean up previous builds
if exist ".\dist" rmdir /s /q ".\dist"
if exist ".\build" rmdir /s /q ".\build"

REM Run PyInstaller with all required options
pyinstaller --noconfirm --onefile --windowed ^
    --add-data "assets;assets" ^
    --add-data "BrainLinkParser;BrainLinkParser" ^
    --add-data "TroubleshootingGuide.md;." ^
    --icon="assets\favicon.ico" ^
    --name="BrainCompanion" ^
    BrainCompanion.py

REM Check if build was successful
if exist ".\dist\BrainCompanion.exe" (
    echo Build successful! Executable created at: .\dist\BrainCompanion.exe
    
    REM Create a simple batch file to run as admin
    echo @echo off > ".\dist\RunAsAdmin.bat"
    echo echo Starting BrainLink Companion with administrative privileges... >> ".\dist\RunAsAdmin.bat"
    echo powershell -Command "Start-Process '.\BrainCompanion.exe' -Verb RunAs" >> ".\dist\RunAsAdmin.bat"
    
    REM Copy the troubleshooting guide
    copy ".\TroubleshootingGuide.md" ".\dist\" /Y
    
    echo Added RunAsAdmin.bat to help run with administrator privileges
    echo Added TroubleshootingGuide.md to help users resolve security issues
) else (
    echo Build failed! Executable not found.
)

echo Done. Press any key to exit...
pause
