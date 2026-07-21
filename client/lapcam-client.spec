# PyInstaller spec for LapCam Client (Windows)
# Build: pyinstaller lapcam-client.spec

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect OpenCV data files (needed for video capture)
opencv_datas = collect_data_files('cv2')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=opencv_datas,
    hiddenimports=[
        'numpy',
        'cv2',
        'aiohttp',
        'yaml',
        'PIL',
    ] + collect_submodules('cv2'),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='LapCamClient',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Set to False for GUI app (no console window)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='lapcam.ico' if os.path.exists('lapcam.ico') else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='LapCamClient',
)
