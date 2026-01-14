import os
import re
from pathlib import Path

CONTENT_DIR = Path(r"c:\Users\wwht1\TheLogos\content\posts")

def migrate_file(filepath):
    text = filepath.read_text(encoding='utf-8')
    
    # Regex to find the div block
    # Pattern looks for <div class="ai-summary-box"> ... </div>
    # handling multiline content.
    pattern = r'<div class="ai-summary-box">\s*(.*?)\s*</div>'
    
    match = re.search(pattern, text, re.DOTALL)
    if match:
        inner_content = match.group(1).strip()
        # Create new shortcode replacement
        replacement = f'{{{{< ai_summary >}}}}\n{inner_content}\n{{{{< /ai_summary >}}}}'
        
        new_text = re.sub(pattern, replacement, text, flags=re.DOTALL)
        
        if new_text != text:
            filepath.write_text(new_text, encoding='utf-8')
            try:
                print(f"Migrated: {filepath.name}")
            except UnicodeEncodeError:
                print(f"Migrated: {filepath.name.encode('utf-8', errors='replace')}")
            return True
    return False

def main():
    count = 0
    for file in CONTENT_DIR.glob("*.md"):
        if migrate_file(file):
            count += 1
    print(f"Total migrated: {count}")

if __name__ == "__main__":
    main()
