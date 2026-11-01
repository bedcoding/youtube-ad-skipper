(function () {
  // 유튜브가 버튼 클래스명을 자주 바꿔서 여러 개를 같이 찾는다
  const SKIP_SELECTORS = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-container button',
  ];

  const BADGE_TEXT = '광고 스킵 중';

  let inAd = false;
  let prevMuted = false;
  let badge = null;
  let loggedMissing = false;
  let clickCount = 0;
  let clicking = false;

  // popup.js의 DEFAULTS와 같게 유지한다
  const DEFAULTS = { adSpeed: 16, muteAds: true, showDebug: false };
  let settings = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, (saved) => {
    settings = saved;
  });
  // 팝업에서 바꾸면 탭을 새로고침하지 않아도 바로 적용한다
  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
  });

  const VERSION = chrome.runtime.getManifest().version;

  console.log(`[광고 스킵] v${VERSION} 로드됨`);

  // offsetParent는 fixed 위치 요소에서 null이 나와서 실제 크기로 판단한다
  function isVisible(el) {
    return !!el && el.getClientRects().length > 0;
  }

  function findSkipButton(player) {
    for (const sel of SKIP_SELECTORS) {
      const btn = player.querySelector(sel);
      if (isVisible(btn)) return btn;
    }
    // 클래스명이 바뀌어도 잡히게 버튼 문구로 한 번 더 찾는다
    for (const btn of player.querySelectorAll('button')) {
      const label = `${btn.textContent} ${btn.getAttribute('aria-label') || ''}`;
      if (/건너뛰기|skip/i.test(label) && isVisible(btn)) return btn;
    }
    return null;
  }

  function getBadge(player) {
    if (!badge) {
      badge = document.createElement('div');
      badge.textContent = BADGE_TEXT;
      Object.assign(badge.style, {
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '9999',
        padding: '8px 16px',
        borderRadius: '999px',
        background: 'rgba(0, 0, 0, 0.75)',
        color: '#fff',
        fontSize: '16px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        pointerEvents: 'none', // 표시 때문에 플레이어 클릭이 막히지 않게
        display: 'none',
      });
    }
    // 유튜브가 플레이어를 다시 그리면 떨어져 나갈 수 있어서 매번 확인한다
    if (badge.parentElement !== player) player.appendChild(badge);
    return badge;
  }

  // 백그라운드가 디버거를 붙인 뒤 버튼 가운데 좌표를 물어본다
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type !== 'getSkipRect') return;
    const player = document.querySelector('#movie_player');
    const btn = player && findSkipButton(player);
    if (!btn) {
      sendResponse(null);
      return;
    }
    const r = btn.getBoundingClientRect();
    sendResponse({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  });

  setInterval(() => {
    const player = document.querySelector('#movie_player');
    const video = document.querySelector('#movie_player video');
    if (!player || !video) return;

    const adShowing = player.classList.contains('ad-showing');

    if (adShowing) {
      // 광고 시작 시 원래 음소거 상태를 기억해 둔다
      if (!inAd) {
        prevMuted = video.muted;
        inAd = true;
      }
      if (settings.muteAds) video.muted = true;
      if (settings.adSpeed !== 1) video.playbackRate = settings.adSpeed;
      const b = getBadge(player);
      b.style.display = 'block';

      const btn = findSkipButton(player);
      if (btn) {
        // 직접 click()하면 유튜브가 무시해서 백그라운드에 실제 클릭을 맡긴다
        if (!clicking) {
          clicking = true;
          clickCount++;
          console.log('[광고 스킵] 버튼 클릭 요청:', btn.className);
          chrome.runtime.sendMessage({ type: 'skip' }, (res) => {
            clicking = false;
            if (chrome.runtime.lastError || !res?.ok) {
              console.log('[광고 스킵] 클릭 실패:', chrome.runtime.lastError?.message || res?.error);
            }
          });
        }
        b.textContent = settings.showDebug ? `${BADGE_TEXT} v${VERSION} (클릭 ${clickCount}회)` : BADGE_TEXT;
      } else {
        if (!loggedMissing) {
          console.log('[광고 스킵] 스킵 버튼을 못 찾음');
          loggedMissing = true;
        }
        b.textContent = settings.showDebug ? `${BADGE_TEXT} v${VERSION} (버튼 못 찾음)` : BADGE_TEXT;
      }
    } else if (inAd) {
      // 광고가 끝나면 원래대로 돌려놓는다
      if (settings.muteAds) video.muted = prevMuted;
      if (settings.adSpeed !== 1) video.playbackRate = 1;
      getBadge(player).style.display = 'none';
      inAd = false;
      loggedMissing = false;
      clickCount = 0;
    }
  }, 1000);
})();
