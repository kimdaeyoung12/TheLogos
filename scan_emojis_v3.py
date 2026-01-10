import os
import re
import sys

# Force UTF-8 for stdout
sys.stdout.reconfigure(encoding='utf-8')

def find_emojis(directory):
    emoji_pattern = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)
    misc_pattern = re.compile(r'[\u2600-\u27BF]', flags=re.UNICODE)
    
    found_any = False
    for root, dirs, files in os.walk(directory):
        for file in files:
            if not file.endswith(('.md', '.html')):
                continue
            
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                emojis = set(emoji_pattern.findall(content))
                symbols = set(misc_pattern.findall(content))
                
                # Exclude specific allowed symbols if necessary (e.g. ✦ linked to design)
                # But user said "remove all emojis".
                
                all_found = emojis.union(symbols)
                
                if all_found:
                    print(f"File: {file}")
                    # Print codepoints to avoid console issues if reconfigure fails
                    print(f"Emojis: {[f'U+{ord(c):X}' for c in all_found]}") 
                    found_any = True
            except Exception as e:
                print(f"Error reading {file}: {e}")

    if not found_any:
        print("No emojis found.")

find_emojis(r'c:\Users\wwht1\TheLogos\content')
