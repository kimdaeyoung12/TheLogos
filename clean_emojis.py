import re
import os

def remove_emojis(file_path):
    emoji_pattern = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)
    misc_pattern = re.compile(r'[\u2600-\u27BF]', flags=re.UNICODE)
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Remove emojis
        new_content = emoji_pattern.sub('', content)
        new_content = misc_pattern.sub('', new_content)
        
        # Clean up double spaces
        new_content = new_content.replace('  ', ' ')
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print(f"Successfully removed emojis from {file_path}")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

remove_emojis(r'c:\Users\wwht1\TheLogos\content\posts\5년 계획.html')
# Assuming about.md is in content root which is standard for Hugo
remove_emojis(r'c:\Users\wwht1\TheLogos\content\about.md')
