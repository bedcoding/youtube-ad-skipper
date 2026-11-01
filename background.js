// 유튜브는 스크립트로 만든 클릭(isTrusted=false)을 무시해서,
// 디버거로 실제 마우스 입력을 보내 스킵 버튼을 누른다

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickSkipButton(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    // 붙는 순간 위쪽에 디버깅 안내 띠가 생겨 화면이 밀릴 수 있어서,
    // 잠깐 기다렸다가 버튼 위치를 다시 받아 온다
    await sleep(150);
    const rect = await chrome.tabs.sendMessage(tabId, { type: 'getSkipRect' });
    if (!rect) return false;

    const base = { x: rect.x, y: rect.y, button: 'left', clickCount: 1 };
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...base, type: 'mouseMoved', button: 'none' });
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...base, type: 'mousePressed' });
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' });
    return true;
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'skip' || !sender.tab) return;

  clickSkipButton(sender.tab.id)
    .then((ok) => sendResponse({ ok }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // 응답을 비동기로 보낸다
});
