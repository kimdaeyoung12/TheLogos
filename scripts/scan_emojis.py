import os
import re

def find_emojis(directory):
    emoji_pattern = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)
    # Also check for lower ranges often used for symbols
    misc_pattern = re.compile(r'[\u2600-\u27BF]', flags=re.UNICODE)
    
    found = False
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
                
                all_found = emojis.union(symbols)
                
                if all_found:
                    print(f"File: {file}")
                    print(f"Emojis/Symbols: {all_found}")
                    found = True
            except Exception as e:
                print(f"Error reading {file}: {e}")

    if not found:
        print("No emojis found.")

find_emojis(r'c:\Users\wwht1\TheLogos\content\posts')
