// content.js의 DEFAULTS와 같게 유지한다
const DEFAULTS = { adSpeed: 16, muteAds: true, showDebug: false };

const savedEl = document.getElementById('saved');
let savedTimer = null;

function save(patch) {
  chrome.storage.sync.set(patch, () => {
    savedEl.textContent = '저장됨. 바로 적용돼요.';
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (savedEl.textContent = ''), 1500);
  });
}

document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;

chrome.storage.sync.get(DEFAULTS, (settings) => {
  for (const radio of document.querySelectorAll('input[name="adSpeed"]')) {
    radio.checked = Number(radio.value) === settings.adSpeed;
    radio.addEventListener('change', () => save({ adSpeed: Number(radio.value) }));
  }

  for (const id of ['muteAds', 'showDebug']) {
    const box = document.getElementById(id);
    box.checked = settings[id];
    box.addEventListener('change', () => save({ [id]: box.checked }));
  }
});
