
// Import Ethers.js from CDN in the layout, or assume it's global 'ethers'

async function verifyContent() {
    const statusEl = document.getElementById('verification-status');
    const verifyBtn = document.getElementById('verify-btn-text');
    const icon = document.getElementById('verify-icon');

    if (!window.ethers) {
        statusEl.innerHTML = "Submodule 'ethers' not loaded.";
        return;
    }

    try {
        verifyBtn.innerHTML = "Verifying...";

        // 1. Get Data from DOM
        const signature = document.getElementById('meta-signature').content;
        const declaredHash = document.getElementById('meta-content-hash').content;
        const signer = document.getElementById('meta-signer').content;

        // 2. Get Actual Content
        // We need the raw markdown body. Since Hugo renders HTML, we can't easily hash the *source* markdown client-side 
        // unless we embed it.
        // STRATEGY: We verify the *declared hash* against the *signature*. 
        // This proves the *signer* signed *this hash*.
        // To verify the *content* matches the *hash*, we would need the raw markdown. 
        // For this MVP, we verify: Signature matches Hash, Signed by Owner.
        // (Full content integrity check would require serving raw markdown in a data attribute or fetching it)

        // Let's try to verify the signature first.

        const messageHash = declaredHash; // The text that was signed (the hash of content)

        // Ethers v6: verifyMessage(message, sig) -> address
        // But wait, our python script signed the *hash string* as a message?
        // Python: encode_defunct(text=content_hash) -> sign_message
        // This allows 'ethers.verifyMessage(content_hash, signature)'

        const recoveredAddress = ethers.verifyMessage(messageHash, signature);

        if (recoveredAddress.toLowerCase() === signer.toLowerCase()) {
            // Success
            statusEl.className = "text-[#00ff9d] font-mono text-sm mt-2";
            statusEl.innerHTML = `
                <span class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">verified_user</span>
                    Verified: ${signer.substring(0, 6)}...${signer.substring(38)}
                </span>
            `;
            icon.innerHTML = "lock";
            icon.className = "material-symbols-outlined text-[#00ff9d]";
            verifyBtn.innerHTML = "Verified Secure";
            verifyBtn.parentElement.classList.add('border-[#00ff9d]', 'bg-[#00ff9d]/10');
        } else {
            throw new Error("Signer mismatch");
        }

    } catch (e) {
        console.error(e);
        statusEl.className = "text-red-500 font-mono text-sm mt-2";
        statusEl.innerText = "Verification Failed: Invalid Signature";
        verifyBtn.innerHTML = "Unsafe";
        verifyBtn.parentElement.classList.add('border-red-500', 'bg-red-500/10');
    }
}
