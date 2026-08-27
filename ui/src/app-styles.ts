export const standaloneStyles = String.raw`
:root {
  color-scheme: light;
  --csp-shell-bg: #fafafa;
  --dsw-alias-label-primary: #111111;
  --dsw-alias-label-secondary: #6b6b6b;
  --dsw-alias-label-tertiary: #7a7a7a;
  --dsw-alias-bg-base: #ffffff;
  --dsw-alias-fill-l1: #ffffff;
  --dsw-specific-sidebar-fill: #fafafa;
  --dsw-alias-border-l2: #e5e5e5;
  --dsw-alias-interactive-bg-hover: rgba(17, 17, 17, 0.05);
  --dsw-alias-interactive-brand: #2f6feb;
  --csp-shell-ink: #111111;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-synthesis: none;
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
  background: var(--csp-shell-bg);
  color: var(--dsw-alias-label-primary);
}

button,
input,
select,
textarea {
  font: inherit;
}

button:not(:disabled) {
  cursor: pointer;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
a:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-interactive-brand) 30%, transparent);
}

.csp-app {
  position: relative;
  display: flex;
  width: 100%;
  height: 100dvh;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--csp-shell-bg);
}

.csp-app-frame {
  position: relative;
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  flex: 1;
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
  background: var(--csp-shell-bg);
}

.csp-app-conversation {
  background: var(--dsw-alias-bg-base);
}

.csp-app-nav-toggle,
.csp-app-backdrop,
.csp-app-chrome {
  display: none;
}

@media (max-width: 760px) {
  .csp-app-frame {
    display: block;
  }

  .csp-app-conversation {
    width: 100%;
    height: 100%;
  }

  .csp-app-sidebar {
    position: absolute;
    z-index: 12;
    inset: 0 auto 0 0;
    width: min(88vw, 320px);
    border-right: 1px solid var(--dsw-alias-border-l2);
    background: var(--csp-shell-bg);
    box-shadow: 18px 0 48px rgba(17, 17, 17, 0.16);
    transform: translateX(-102%);
    transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);
  }

  .csp-app--nav-open .csp-app-sidebar {
    transform: translateX(0);
  }

  .csp-app-nav-toggle {
    position: absolute;
    z-index: 14;
    top: 16px;
    left: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 8px;
    background: var(--dsw-alias-bg-base);
    color: var(--dsw-alias-label-primary);
  }

  .csp-app-nav-toggle > span,
  .csp-app-nav-toggle::before,
  .csp-app-nav-toggle::after {
    position: absolute;
    width: 16px;
    height: 1.5px;
    border-radius: 999px;
    background: currentColor;
    content: '';
  }

  .csp-app-nav-toggle::before { transform: translateY(-5px); }
  .csp-app-nav-toggle::after { transform: translateY(5px); }

  .csp-app-backdrop {
    position: absolute;
    z-index: 11;
    inset: 0;
    display: block;
    border: 0;
    background: rgba(17, 17, 17, 0.28);
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1);
  }

  .csp-app--nav-open .csp-app-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .csp-conversation-header,
  .csp-inbox-header {
    padding-left: 64px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .csp-app-sidebar,
  .csp-app-backdrop {
    transition: none;
  }
}
`
