import re
import os

def remove_emojis(file_path):
    emoji_pattern = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)
    misc_pattern = re.compile(r'[\u2600-\u27BF]', flags=re.UNICODE)
    
    # Resolve path relative to the project root (CWD)
    full_path = os.path.abspath(file_path)
    
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        return

    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Remove emojis
        new_content = emoji_pattern.sub('', content)
        new_content = misc_pattern.sub('', new_content)
        
        # Clean up double spaces
        new_content = new_content.replace('  ', ' ')
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        print(f"Successfully removed emojis from {file_path}")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    # Define files to process relative to project root
    files_to_clean = [
        'content/posts/5년 계획.html',
        'content/about.md'
    ]
    
    for file_path in files_to_clean:
        remove_emojis(file_path)
