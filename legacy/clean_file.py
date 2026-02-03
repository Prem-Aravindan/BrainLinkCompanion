#!/usr/bin/env python3

# Clean null bytes from BrainLinkAnalyzer_GUI.py
with open('BrainLinkAnalyzer_GUI.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Remove null bytes
content = content.replace('\x00', '')

# Write cleaned content back
with open('BrainLinkAnalyzer_GUI.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("File cleaned successfully!")
