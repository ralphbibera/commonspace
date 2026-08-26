export const standaloneStyles = String.raw`
:root {
  color-scheme: light;
  --dsw-alias-label-primary: #202124;
  --dsw-alias-label-secondary: #646972;
  --dsw-alias-label-tertiary: #8b9099;
  --dsw-alias-bg-base: #ffffff;
  --dsw-alias-fill-l1: #ffffff;
  --dsw-specific-sidebar-fill: #f7f7f5;
  --dsw-alias-border-l2: rgba(32, 33, 36, 0.12);
  --dsw-alias-interactive-bg-hover: rgba(32, 33, 36, 0.055);
  --dsw-alias-interactive-brand: #5961e8;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --dsw-alias-label-primary: #ececef;
    --dsw-alias-label-secondary: #b2b3bb;
    --dsw-alias-label-tertiary: #858791;
    --dsw-alias-bg-base: #171719;
    --dsw-alias-fill-l1: #202024;
    --dsw-specific-sidebar-fill: #121214;
    --dsw-alias-border-l2: rgba(255, 255, 255, 0.11);
    --dsw-alias-interactive-bg-hover: rgba(255, 255, 255, 0.07);
    --dsw-alias-interactive-brand: #8f95ff;
  }
}

html,
body,
#root {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
}

body {
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}

button,
input,
select,
textarea {
  font: inherit;
}

.csp-app {
  position: relative;
  display: grid;
  grid-template-columns: 304px minmax(0, 1fr);
  width: 100%;
  height: 100dvh;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
}

.csp-app-sidebar,
.csp-app-conversation {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.csp-app-sidebar {
  z-index: 2;
  border-right: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-specific-sidebar-fill);
}

.csp-app-conversation {
  background: var(--dsw-alias-bg-base);
}

.csp-app-nav-toggle,
.csp-app-backdrop {
  display: none;
}

@media (max-width: 760px) {
  .csp-app {
    display: block;
  }

  .csp-app-sidebar {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(88vw, 320px);
    border-right: 1px solid var(--dsw-alias-border-l2);
    box-shadow: 18px 0 48px rgba(0, 0, 0, 0.16);
    transform: translateX(-102%);
    transition: transform 180ms ease;
  }

  .csp-app--nav-open .csp-app-sidebar {
    transform: translateX(0);
  }

  .csp-app-nav-toggle {
    position: absolute;
    z-index: 4;
    top: 15px;
    left: 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 10px;
    background: var(--dsw-alias-fill-l1);
    color: var(--dsw-alias-label-primary);
    cursor: pointer;
  }

  .csp-app-nav-toggle > span,
  .csp-app-nav-toggle::before,
  .csp-app-nav-toggle::after {
    position: absolute;
    width: 14px;
    height: 1.5px;
    border-radius: 999px;
    background: currentColor;
    content: '';
  }

  .csp-app-nav-toggle::before { transform: translateY(-4px); }
  .csp-app-nav-toggle::after { transform: translateY(4px); }

  .csp-app-backdrop {
    position: absolute;
    z-index: 1;
    inset: 0;
    display: block;
    border: 0;
    background: rgba(0, 0, 0, 0.28);
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease;
  }

  .csp-app--nav-open .csp-app-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .csp-conversation-header {
    padding-left: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .csp-app-sidebar,
  .csp-app-backdrop {
    transition: none;
  }
}
`
