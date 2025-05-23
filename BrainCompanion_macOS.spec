# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[('assets', 'assets'), ('BrainLinkParser', 'BrainLinkParser'), ('TroubleshootingGuide.md', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='BrainLinkCompanion',  # <--- Consistent name
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=True,  # Enable argv emulation for macOS
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/favicon.icns',
)

app = BUNDLE(
    exe,
    a.binaries,
    a.datas,
    name='BrainLinkCompanion.app',  # <--- Consistent name
    icon='assets/favicon.icns',
    bundle_identifier='com.brainlink.companion',
    info_plist={
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleVersion': '1.0.0',
        'NSHighResolutionCapable': 'True',
        'NSRequiresAquaSystemAppearance': 'False',  # Allow dark mode support
    },
)
