#!/usr/bin/env python3

# Clean up the BrainLinkAnalyzer_GUI.py file
with open('BrainLinkAnalyzer_GUI.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the first complete class and keep only that
lines = content.split('\n')
clean_lines = []
class_count = 0
in_main_class = False

for line in lines:
    if 'class BrainLinkAnalyzerWindow(QMainWindow):' in line:
        class_count += 1
        if class_count == 1:  # Keep only the first complete class
            in_main_class = True
            clean_lines.append(line)
        else:
            break  # Stop at second class definition
    elif in_main_class:
        clean_lines.append(line)
    elif not in_main_class:
        clean_lines.append(line)

# Add proper main execution
main_code = """

# --- Main execution ---
if __name__ == "__main__":
    import random
    
    # OS Selection
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    # Show OS selection dialog
    os_dialog = OSSelectionDialog()
    if os_dialog.exec() == QDialog.Accepted:
        selected_os = os_dialog.get_selected_os()
        
        # Create and show main window
        window = BrainLinkAnalyzerWindow(selected_os)
        window.show()
        
        sys.exit(app.exec())
    else:
        sys.exit(0)
"""

# Write clean content
with open('BrainLinkAnalyzer_GUI.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(clean_lines) + main_code)

print('File cleaned and fixed!')
