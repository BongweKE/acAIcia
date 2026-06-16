/**
 * acAIcia Loading & Thinking UX Enhancement
 * 
 * 1. Shows a branded loading overlay while the chat session initializes
 *    (hides the empty chatbox + composer until on_chat_start messages arrive).
 * 2. Enhances the "thinking" indicator with rotating contextual phrases
 *    instead of a bare dot/spinner.
 */

(function () {
  'use strict';

  // ── 1. LOADING OVERLAY ──────────────────────────────────────────────────────
  // Injected immediately so the user never sees the empty chat area.

  const OVERLAY_ID = 'acaicia-loading-overlay';

  function createLoadingOverlay() {
    // Avoid duplicates on hot reload
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="acaicia-loader-content">
        <svg class="acaicia-loader-logo" viewBox="0 0 100 100" width="80" height="80">
          <g class="acacia-fill">
            <path d="M 47 80 C 47 70, 48 62, 46 56 C 44 50, 36 46, 28 43 L 30 40 C 38 43, 45 47, 48 52 C 49 48, 51 45, 54 42 C 60 38, 68 37, 76 36 L 77 39 C 70 40, 62 41, 57 45 C 54 49, 52 56, 52 80 Z" />
            <path d="M 48 54 C 45 50, 41 47, 36 45 L 37 42 C 43 44, 47 48, 49 51 Z" />
            <path d="M 54 48 C 57 44, 63 41, 69 40 L 70 43 C 65 44, 59 47, 56 51 Z" />
            <ellipse cx="50" cy="30" rx="36" ry="7" />
            <ellipse cx="32" cy="38" rx="22" ry="6" />
            <ellipse cx="68" cy="38" rx="22" ry="6" />
            <ellipse cx="50" cy="24" rx="24" ry="5" />
            <ellipse cx="18" cy="41" rx="10" ry="4" />
            <ellipse cx="82" cy="41" rx="10" ry="4" />
          </g>
        </svg>
        <div class="acaicia-loader-bar-container">
          <div class="acaicia-loader-bar"></div>
        </div>
        <p class="acaicia-loader-text">Preparing your research assistant…</p>
        <p class="acaicia-loader-subtext">Connecting to backend services</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function dismissOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.add('acaicia-overlay-fade-out');
    overlay.addEventListener('animationend', () => {
      overlay.remove();
    }, { once: true });
    // Fallback removal in case animationend doesn't fire
    setTimeout(() => {
      if (document.getElementById(OVERLAY_ID)) {
        overlay.remove();
      }
    }, 1200);
  }

  // Inject the overlay immediately
  createLoadingOverlay();

  // Watch for the welcome card to appear — that means on_chat_start is done.
  // Chainlit renders messages into a container; we observe the DOM for
  // our custom .acaicia-welcome-card class.
  const observer = new MutationObserver(function (mutations) {
    // Check if the welcome card or any assistant message has appeared
    const welcomeCard = document.querySelector('.acaicia-welcome-card');
    if (welcomeCard) {
      // Small extra delay to let the full welcome card + info card render
      setTimeout(dismissOverlay, 400);
      observer.disconnect();
    }
  });

  // Start observing once the body is available
  function startObserving() {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.body) {
    startObserving();
    startScrollObserver();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      startObserving();
      startScrollObserver();
    });
  }

  // Safety fallback: if somehow the welcome card never appears (e.g. error),
  // remove the overlay after 30 seconds max so the user isn't stuck.
  setTimeout(() => {
    if (document.getElementById(OVERLAY_ID)) {
      dismissOverlay();
    }
  }, 30000);


  // ── 2. ENHANCED THINKING INDICATOR ──────────────────────────────────────────
  // The Chainlit Step component renders a collapsible section with the step
  // output text. We watch for step output elements that contain our "🌿"
  // prefix and enhance them with a subtle CSS animation class.

  // (The actual rotating text is handled server-side in app.py via
  //  THINKING_PHRASES + step.update(). This JS adds visual polish.)


  // ── 3. AUTO-SCROLL TO TOP OF ANSWERS ────────────────────────────────────────
  // When a new assistant response arrives, we scroll it so that the start of
  // the answer is aligned with the top of the chat area, rather than the bottom.
  function startScrollObserver() {
    console.log("🌿 acAIcia: startScrollObserver active");
    const scrollObserver = new MutationObserver(function (mutations) {
      const aiMessages = document.querySelectorAll('.ai-message');
      if (aiMessages.length === 0) return;

      // Filter out welcome card, info card, and the inline thinking component
      // Also ensure it contains .message-content (only real messages, not step runs)
      const validAiMessages = Array.from(aiMessages).filter(el => {
        const hasContent = !!el.querySelector('.message-content');
        const isWelcome = !!el.querySelector('.acaicia-welcome-card');
        const isInfo = !!el.querySelector('.acaicia-info-card');
        const isThinking = !!el.querySelector('.acaicia-thinking-inline');
        return hasContent && !isWelcome && !isInfo && !isThinking;
      });

      if (validAiMessages.length === 0) return;

      const latestResponse = validAiMessages[validAiMessages.length - 1];
      if (latestResponse.dataset.scrolled === 'true') return;

      latestResponse.dataset.scrolled = 'true';
      console.log("🌿 acAIcia: Scrolling to new message:", latestResponse.innerText.substring(0, 50));

      const stepWrapper = latestResponse.closest('.step') || latestResponse;
      setTimeout(() => {
        stepWrapper.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        console.log("🌿 acAIcia: scrollIntoView executed");
      }, 150);
    });

    scrollObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

})();
