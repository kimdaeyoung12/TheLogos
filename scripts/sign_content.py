
import os
import sys
import re
import hashlib
import json
import secrets
from pathlib import Path

try:
    from eth_account import Account
    from eth_account.messages import encode_defunct
except ImportError:
    print("Error: 'eth_account' is required. Please run: pip install eth-account")
    sys.exit(1)

KEY_FILE = "signer_key.private"

def load_or_create_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "r") as f:
            private_key = f.read().strip()
            print(f"Loaded existing private key.")
            return private_key
    else:
        print("No private key found.")
        create = input("Generate new Ethereum private key for signing? (y/n): ").lower()
        if create == 'y':
            acct = Account.create()
            with open(KEY_FILE, "w") as f:
                f.write(acct.key.hex())
            print(f"Created new key. Saved to {KEY_FILE} (KEEP THIS SAFE!)")
            print(f"Your Public Address: {acct.address}")
            return acct.key.hex()
        else:
            sys.exit("Cannot proceed without a key.")

def sign_post(file_path, private_key):
    path = Path(file_path)
    if not path.exists():
        print(f"File not found: {file_path}")
        return

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Split Front Matter
    # Robust regex for TOML/YAML front matter
    match = re.search(r'^\+\+\+\r?\n(.*?)\r?\n\+\+\+\r?\n(.*)$', content, re.DOTALL)
    fm_type = 'toml'
    if not match:
        match = re.search(r'^---\r?\n(.*?)\r?\n---\r?\n(.*)$', content, re.DOTALL)
        fm_type = 'yaml'
    
    if not match:
        print("Could not parse Front Matter (must use +++ or ---)")
        return

    front_matter_raw = match.group(1)
    body = match.group(2)
    
    # Normalize body for signing (trim whitespace to avoid git CRLF issues breaking hash)
    # We sign the *trimmed* body
    body_to_sign = body.strip()
    
    # Hash
    content_hash = hashlib.sha256(body_to_sign.encode('utf-8')).hexdigest()
    
    # Sign
    account = Account.from_key(private_key)
    message = encode_defunct(text=content_hash) # Sign the HASH, not the body (more efficient/standard)
    signed_message = account.sign_message(message)
    signature = signed_message.signature.hex()
    
    print(f"Content Hash: {content_hash}")
    print(f"Signer: {account.address}")
    print(f"Signature: {signature}")

    # Update Front Matter
    # We simply append/replace the [params.verification] block
    # This is a simple string manipulation to avoid dropping comments in TOML/YAML libs
    
    new_fm = front_matter_raw
    
    # Remove existing verification block if present
    new_fm = re.sub(r'\[params\.verification\].*?(\n\[|$)', r'\1', new_fm, flags=re.DOTALL)
    
    verification_block = f"""
[params.verification]
  signer_address = "{account.address}"
  signature = "{signature}"
  content_hash = "{content_hash}"
  timestamp = "{os.popen('date /t').read().strip() if os.name == 'nt' else ''}"
"""
    
    if fm_type == 'toml':
        if "[params.verification]" not in front_matter_raw:
             # Append to end of params or end of file
             new_fm += verification_block
    else:
        # YAML format
        yaml_block = f"""
params:
  verification:
    signer_address: "{account.address}"
    signature: "{signature}"
    content_hash: "{content_hash}"
"""
        new_fm += yaml_block

    new_content = f"+++\n{new_fm}\n+++\n{body}" if fm_type == 'toml' else f"---\n{new_fm}\n---\n{body}"
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    print(f"Successfully signed {file_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python sign_content.py <path_to_markdown_file>")
        sys.exit(1)
    
    pk = load_or_create_key()
    sign_post(sys.argv[1], pk)
