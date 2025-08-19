(function () {
  try {
    // Determine the user's preferred language; default to Korean
    const lang = (navigator.language || navigator.userLanguage || 'ko').toLowerCase();
    const dismissed = localStorage.getItem('tl_hint_dismissed') === '1';
    // Only show translation hint if the user language is not Korean and not dismissed
    if (lang.startsWith('ko') || dismissed) return;

    // Build the hint bar container
    const bar = document.createElement('div');
    bar.className = 'translate-hint';
    bar.innerHTML = `
      <div class="translate-hint__content">
        <span>이 페이지는 한국어입니다. 브라우저의 <strong>자동 번역</strong> 기능을 사용해 보세요.</span>
        <details class="translate-hint__help">
          <summary>도움말</summary>
          <ul>
            <li><strong>Chrome/Edge:</strong> 주소창 오른쪽 번역 아이콘 → Translate</li>
            <li><strong>Safari:</strong> 주소창의 aA 아이콘 → Translate</li>
            <li>항상 번역하려면 해당 옵션에서 Always translate 선택</li>
          </ul>
        </details>
        <button class="translate-hint__close" aria-label="close">×</button>
      </div>
    `;
    document.body.appendChild(bar);
    // Close button behaviour: remember dismissal
    bar.querySelector('.translate-hint__close').addEventListener('click', () => {
      localStorage.setItem('tl_hint_dismissed', '1');
      bar.remove();
    });
  } catch (e) {
    // Fail silently if any error occurs
  }
})();