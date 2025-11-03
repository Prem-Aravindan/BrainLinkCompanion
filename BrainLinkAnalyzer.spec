# -*- mode: python ; coding: utf-8 -*-


from PyInstaller.utils.hooks import collect_all


pyside_datas, pyside_binaries, pyside_hiddenimports = collect_all('PySide6')

datas = [
    ('assets', 'assets'),
    ('BrainLinkParser', 'BrainLinkParser'),
    ('TroubleshootingGuide.md', '.'),
]
datas += pyside_datas

binaries = []
binaries += pyside_binaries

hiddenimports = []
hiddenimports += pyside_hiddenimports

excludes = [
    'PyQt5', 'PyQt6',
    'PyQt5.QtCore', 'PyQt5.QtGui', 'PyQt5.QtWidgets',
    'PyQt6.QtCore', 'PyQt6.QtGui', 'PyQt6.QtWidgets',
]


a = Analysis(
    ['BrainLinkAnalyzer_GUI_Enhanced.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MindLinkAnalyzer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['assets\\favicon.ico'],
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='MindLinkAnalyzer'
)
