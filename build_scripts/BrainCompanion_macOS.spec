# -*- mode: python ; coding: utf-8 -*-

import PySide6
import os
plugins_path = os.path.join(os.path.dirname(PySide6.__file__), 'plugins')

a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('assets', 'assets'),
        ('BrainLinkParser', 'BrainLinkParser'),
        ('TroubleshootingGuide.md', '.'),
        (plugins_path, 'PySide6/plugins'),  # Add PySide6 plugins
    ],
    hiddenimports=[
        'PySide6.QtCore',
        'PySide6.QtGui',
        'PySide6.QtWidgets',
        'PySide6.QtNetwork',
        'PySide6.QtSerialPort',
        'PySide6.QtPrintSupport',
        'PySide6.QtSvg',
        'PySide6.QtOpenGL',
        'PySide6.QtQml',
        'PySide6.QtQuick',
        'PySide6.QtQuickControls2',
        'PySide6.QtWebEngineWidgets',
        'PySide6.QtWebEngineCore',
        'PySide6.QtWebEngine',
        'PySide6.QtWebSockets',
        'PySide6.QtPositioning',
        'PySide6.QtMultimedia',
        'PySide6.QtMultimediaWidgets',
        'PySide6.QtBluetooth',
        'PySide6.QtSensors',
        'PySide6.QtTextToSpeech',
        'PySide6.QtCharts',
        'PySide6.QtDataVisualization',
        'PySide6.Qt3DCore',
        'PySide6.Qt3DRender',
        'PySide6.Qt3DInput',
        'PySide6.Qt3DLogic',
        'PySide6.Qt3DAnimation',
        'PySide6.Qt3DExtras',
        'PySide6.QtTest',
    ],
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
        'CFBundleName': 'BrainLinkCompanion',
        'CFBundleDisplayName': 'BrainLinkCompanion',
        'CFBundleIdentifier': 'com.brainlink.companion',
        'CFBundleExecutable': 'BrainLinkCompanion',
        'CFBundlePackageType': 'APPL',
        'CFBundleIconFile': 'favicon.icns',
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleVersion': '1.0.0',
        'NSPrincipalClass': 'NSApplication',
        'NSHighResolutionCapable': 'True',
        'NSRequiresAquaSystemAppearance': 'False',  # Allow dark mode support
        'NSUSBUsageDescription': 'This app needs access to USB devices for BrainLink hardware.',
        'NSBluetoothAlwaysUsageDescription': 'This app needs Bluetooth access for BrainLink hardware.',
        'NSAppTransportSecurity': {'NSAllowsArbitraryLoads': True},
    },
)
