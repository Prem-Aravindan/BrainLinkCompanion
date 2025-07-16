# PowerShell Script to Fix Kotlin Compilation Issues
# This script fixes the two Kotlin compilation errors in the React Native and Expo gradle plugins

Write-Host "🔧 Fixing Kotlin compilation issues..." -ForegroundColor Yellow

# Fix 1: ReactSettingsExtension.kt - Replace objects reference with proper file collection
$reactSettingsFile = ".\node_modules\@react-native\gradle-plugin\settings-plugin\src\main\kotlin\com\facebook\react\ReactSettingsExtension.kt"
if (Test-Path $reactSettingsFile) {
    Write-Host "✅ Fixing ReactSettingsExtension.kt objects reference..." -ForegroundColor Green
    $content = Get-Content $reactSettingsFile -Raw
    $content = $content -replace 'lockFiles: FileCollection = settings\.objects\.fileCollection\(\)', 'lockFiles: FileCollection = settings.gradle.rootProject.files()'
    Set-Content $reactSettingsFile $content
    Write-Host "   ✓ ReactSettingsExtension.kt fixed" -ForegroundColor Green
} else {
    Write-Host "❌ ReactSettingsExtension.kt not found" -ForegroundColor Red
}

# Fix 2: SettingsManager.kt - Remove invalid import
$settingsManagerFile = ".\node_modules\expo\node_modules\expo-modules-autolinking\android\expo-gradle-plugin\expo-autolinking-settings-plugin\src\main\kotlin\expo\modules\plugin\SettingsManager.kt"
if (Test-Path $settingsManagerFile) {
    Write-Host "✅ Fixing SettingsManager.kt import..." -ForegroundColor Green
    $content = Get-Content $settingsManagerFile -Raw
    $content = $content -replace 'import org\.gradle\.internal\.extensions\.core\.extra', ''
    Set-Content $settingsManagerFile $content
    Write-Host "   ✓ SettingsManager.kt fixed" -ForegroundColor Green
} else {
    Write-Host "❌ SettingsManager.kt not found" -ForegroundColor Red
}

Write-Host "🎉 Kotlin compilation fixes applied!" -ForegroundColor Green
Write-Host "💡 Run 'npm run android' to test the build" -ForegroundColor Cyan
