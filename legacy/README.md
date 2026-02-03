# Legacy Files

Backup files, old versions, and deprecated code kept for reference.

## Contents

This folder contains:
- Backup versions of GUI files (`*_backup.py`)
- Old/deprecated implementations (`*_old.py`)
- Temporary fix scripts (`clean_file.py`, `fix_file.py`)

## Purpose

Files here are kept for:
- Reference during troubleshooting
- Rollback if needed
- Understanding evolution of codebase

## ⚠️ Warning

Files in this folder are **NOT actively maintained** and may not work with current codebase.

Use for reference only. Do not use in production.

## Cleanup

Periodically review and remove files that are no longer needed:
```powershell
# Review files older than 6 months
Get-ChildItem legacy/ | Where-Object {$_.LastWriteTime -lt (Get-Date).AddMonths(-6)}
```
