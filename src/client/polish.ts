/** Semantic Commonspace design layer; host tokens remain the source of truth. */
export const commonspacePolish = String.raw`
.csp-browser,
.csp-conversation,
.csp-switch {
  --csp-fg: var(--dsw-alias-label-primary, #202124);
  --csp-muted: var(--dsw-alias-label-secondary, #666b74);
  --csp-subtle: var(--dsw-alias-label-tertiary, #8a8f98);
  --csp-canvas: var(--dsw-specific-sidebar-fill, #f7f7f5);
  --csp-surface: var(--dsw-alias-bg-base, #ffffff);
  --csp-raised: var(--dsw-alias-fill-l1, #ffffff);
  --csp-border: var(--dsw-alias-border-l2, rgba(32, 33, 36, 0.12));
  --csp-border-soft: color-mix(in srgb, var(--csp-border) 66%, transparent);
  --csp-hover: var(--dsw-alias-interactive-bg-hover, rgba(32, 33, 36, 0.055));
  --csp-accent: var(--dsw-alias-interactive-brand, #5961e8);
  --csp-accent-soft: color-mix(in srgb, var(--csp-accent) 11%, transparent);
  --csp-accent-line: color-mix(in srgb, var(--csp-accent) 34%, var(--csp-border));
  --csp-success: #16836f;
  --csp-warning: #b36a13;
  --csp-danger: #bd3a42;
  --csp-claude: #b96542;
  --csp-radius-sm: 7px;
  --csp-radius-md: 11px;
  --csp-radius-lg: 15px;
  --csp-shadow-raised: 0 10px 32px color-mix(in srgb, var(--csp-fg) 9%, transparent);
  color: var(--csp-fg);
}

.csp-mark {
  color: var(--csp-accent);
}

.csp-mark > span {
  border-radius: 50%;
}

.csp-mark > span:nth-child(2),
.csp-mark > span:nth-child(3) {
  opacity: 0.56;
}

.csp-switch {
  padding-top: 3px;
  border-top: 1px solid var(--csp-border-soft);
}

.csp-trigger {
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: var(--csp-radius-md);
  color: var(--csp-muted);
}

.csp-trigger:hover {
  border-color: var(--csp-border-soft);
  background: var(--csp-surface);
  color: var(--csp-fg);
}

.csp-trigger[aria-pressed='true'] {
  background: var(--csp-accent-soft);
  color: var(--csp-accent);
}

.csp-switch-arrow {
  font-size: 11px;
  opacity: 0.68;
}

.csp-browser {
  background: var(--csp-canvas);
  color: var(--csp-fg);
}

.csp-browser-header {
  min-height: 58px;
  box-sizing: border-box;
  gap: 6px;
  padding: 9px 8px 9px 10px;
  border-color: var(--csp-border-soft);
  background: color-mix(in srgb, var(--csp-surface) 56%, var(--csp-canvas));
}

.csp-browser .csp-browser-brand {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.csp-browser .csp-browser-brand > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.csp-browser-brand strong {
  overflow: hidden;
  color: var(--csp-fg);
  font-size: 13px;
  font-weight: 690;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-browser-brand span:not(.csp-mark) {
  color: var(--csp-subtle);
  font-size: 9.5px;
  line-height: 13px;
}

.csp-browser-brand em {
  padding: 2px 4px;
  border: 1px solid var(--csp-accent-line);
  border-radius: 4px;
  color: var(--csp-accent);
  font-size: 7px;
  font-style: normal;
  font-weight: 760;
  letter-spacing: 0.08em;
}

.csp-mark--brand {
  grid-template-columns: repeat(2, 5px);
  grid-template-rows: repeat(2, 5px);
  width: 12px;
  height: 12px;
  padding: 5px;
  border: 1px solid var(--csp-accent-line);
  border-radius: 7px;
  background: var(--csp-accent-soft);
}

.csp-browser .csp-browser-header-actions {
  display: flex;
  flex: none;
  flex-direction: row;
  gap: 1px;
}

.csp-browser-refresh,
.csp-browser-add,
.csp-project-add {
  color: var(--csp-subtle);
}

.csp-browser-refresh:hover,
.csp-browser-add:hover,
.csp-project-add:hover {
  background: var(--csp-hover);
  color: var(--csp-fg);
}

.csp-browser-refresh:focus-visible,
.csp-browser-add:focus-visible,
.csp-project-add:focus-visible,
.csp-browser-row:focus-visible,
.csp-browser-disclosure:focus-visible,
.csp-dm-picker-agent:focus-visible,
.csp-command-result button:focus-visible,
.csp-trigger:focus-visible,
.csp-message-composer button:focus-visible,
.csp-thread-composer button:focus-visible {
  outline: 2px solid var(--csp-accent);
  outline-offset: 1px;
}

.csp-browser-scroll {
  padding: 8px 5px 16px;
  scrollbar-color: var(--csp-border) transparent;
}

.csp-browser-section {
  margin: 0 0 7px;
}

.csp-browser-section-head {
  gap: 2px;
}

.csp-browser-disclosure {
  min-height: 29px;
  gap: 6px;
  padding: 4px 6px;
  color: var(--csp-subtle);
  font-size: 10px;
  font-weight: 720;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.csp-browser-disclosure:hover {
  background: transparent;
  color: var(--csp-fg);
}

.csp-section-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 11px;
  height: 11px;
  transform: rotate(0deg);
  font-size: 12px;
  transition: transform 140ms ease;
}

.csp-section-chevron.is-open {
  transform: rotate(90deg);
}

.csp-section-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-browser-count {
  min-width: 15px;
  box-sizing: border-box;
  margin-left: auto;
  padding: 1px 4px;
  border: 1px solid var(--csp-border-soft);
  border-radius: 999px;
  background: color-mix(in srgb, var(--csp-surface) 58%, transparent);
  color: var(--csp-subtle);
  font-size: 8px;
  font-weight: 650;
  line-height: 13px;
  text-align: center;
}

.csp-browser-section-body {
  gap: 2px;
  padding-left: 3px;
}

.csp-browser-row {
  position: relative;
  min-height: 38px;
  gap: 8px;
  padding: 5px 7px;
  border: 1px solid transparent;
  border-radius: var(--csp-radius-sm);
  color: var(--csp-muted);
}

.csp-browser-row:hover {
  border-color: var(--csp-border-soft);
  background: color-mix(in srgb, var(--csp-surface) 48%, transparent);
  color: var(--csp-fg);
}

.csp-browser-row[aria-pressed='true'] {
  border-color: var(--csp-accent-line);
  background: var(--csp-accent-soft);
  box-shadow: inset 2px 0 0 var(--csp-accent);
  color: var(--csp-fg);
}

.csp-browser-row-main {
  gap: 1px;
}

.csp-browser-row-main strong {
  color: inherit;
  font-size: 11.5px;
  font-weight: 610;
  letter-spacing: -0.006em;
}

.csp-browser-row-main small {
  color: var(--csp-subtle);
  font-size: 9.5px;
  line-height: 13px;
}

.csp-project-glyph {
  position: relative;
  display: inline-flex;
  width: 17px;
  height: 14px;
  flex: none;
  box-sizing: border-box;
  border: 1px solid var(--csp-accent-line);
  border-radius: 4px;
  background: var(--csp-accent-soft);
}

.csp-project-glyph::before {
  position: absolute;
  top: -3px;
  left: 2px;
  width: 7px;
  height: 4px;
  border: 1px solid var(--csp-accent-line);
  border-bottom: 0;
  border-radius: 3px 3px 0 0;
  background: var(--csp-canvas);
  content: '';
}

.csp-project-glyph > span {
  position: absolute;
  right: 3px;
  bottom: 3px;
  left: 3px;
  height: 1px;
  background: var(--csp-accent);
  opacity: 0.5;
}

.csp-workspace-glyph {
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  border: 1px solid var(--csp-border);
  border-radius: 3px;
  background: var(--csp-surface);
  box-shadow: inset 0 -2px 0 var(--csp-accent-soft);
}

.csp-project-workspaces {
  margin: 1px 4px 6px 15px;
  padding-left: 10px;
  border-color: var(--csp-accent-line);
}

.csp-workspace-row {
  min-height: 27px;
  color: var(--csp-muted);
}

.csp-browser-hash {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: none;
  border: 1px solid var(--csp-border-soft);
  border-radius: 6px;
  background: color-mix(in srgb, var(--csp-surface) 62%, transparent);
  color: var(--csp-accent);
  font-size: 12px;
}

.csp-agent-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: none;
  box-sizing: border-box;
  border: 1px solid var(--csp-accent-line);
  border-radius: 8px;
  background: var(--csp-accent-soft);
  color: var(--csp-accent);
  font-size: 10px;
  font-weight: 760;
}

.csp-agent-avatar[data-adapter='codex'] {
  border-color: color-mix(in srgb, var(--csp-fg) 24%, var(--csp-border));
  background: color-mix(in srgb, var(--csp-fg) 7%, transparent);
  color: var(--csp-fg);
}

.csp-agent-avatar[data-adapter='claude-code'] {
  border-color: color-mix(in srgb, var(--csp-claude) 34%, var(--csp-border));
  background: color-mix(in srgb, var(--csp-claude) 10%, transparent);
  color: var(--csp-claude);
}

.csp-agent-presence {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 6px;
  height: 6px;
  box-sizing: content-box;
  border: 2px solid var(--csp-canvas);
  border-radius: 50%;
  background: var(--csp-subtle);
}

.csp-agent-presence--running { background: var(--csp-success); }
.csp-agent-presence--stopped { background: var(--csp-warning); }

.csp-agent-meta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.csp-agent-meta > span:not(.csp-adapter-badge):not(.csp-agent-status) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.csp-adapter-badge,
.csp-agent-status {
  display: inline-flex;
  align-items: center;
  min-height: 13px;
  padding: 0 3px;
  border-radius: 3px;
  background: var(--csp-accent-soft);
  color: var(--csp-accent);
  font-size: 7.5px;
  font-weight: 730;
  letter-spacing: 0.025em;
  white-space: nowrap;
}

.csp-adapter-badge[data-adapter='codex'] {
  background: color-mix(in srgb, var(--csp-fg) 7%, transparent);
  color: var(--csp-fg);
}

.csp-adapter-badge[data-adapter='claude-code'] {
  background: color-mix(in srgb, var(--csp-claude) 10%, transparent);
  color: var(--csp-claude);
}

.csp-agent-status {
  background: transparent;
  color: var(--csp-subtle);
  font-weight: 560;
}

.csp-browser-empty,
.csp-browser-status {
  margin: 1px 5px 3px;
  padding: 7px 8px;
  border: 1px dashed var(--csp-border-soft);
  border-radius: var(--csp-radius-sm);
  color: var(--csp-subtle);
  font-size: 10px;
  line-height: 15px;
}

.csp-browser-form {
  margin: 3px 4px 8px;
  padding: 9px;
  border-color: var(--csp-border);
  border-radius: var(--csp-radius-md);
  background: var(--csp-raised);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--csp-fg) 5%, transparent);
}

.csp-browser-form input,
.csp-browser-form select,
.csp-browser-form textarea,
.csp-thread-composer textarea {
  border-color: var(--csp-border);
  background: var(--csp-surface);
  color: var(--csp-fg);
}

.csp-browser-form input:focus,
.csp-browser-form select:focus,
.csp-browser-form textarea:focus,
.csp-thread-composer textarea:focus {
  border-color: var(--csp-accent);
  outline: none;
  box-shadow: 0 0 0 2px var(--csp-accent-soft);
}

.csp-browser-form button,
.csp-message-composer button,
.csp-thread-composer button {
  border-radius: var(--csp-radius-sm);
  background: var(--csp-accent);
  font-weight: 650;
}

.csp-browser-form button[type='button'] {
  background: transparent;
  color: var(--csp-muted);
}

.csp-global-settings > label {
  display: grid !important;
  align-items: stretch !important;
  gap: 4px !important;
  color: var(--csp-muted);
  font-weight: 620;
}

.csp-global-settings > label input,
.csp-global-settings > label select {
  width: 100% !important;
  height: 30px !important;
}

.csp-dm-search {
  display: grid !important;
  align-items: stretch !important;
  gap: 5px !important;
  color: var(--csp-muted);
  font-weight: 620;
}

.csp-dm-search input {
  width: 100% !important;
  height: 31px !important;
}

.csp-dm-picker > .csp-dm-picker-results {
  display: flex;
  max-height: 230px;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 2px;
  overflow-y: auto;
}

.csp-dm-picker-agent {
  display: grid !important;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px !important;
  color: var(--csp-fg) !important;
  text-align: left;
}

.csp-dm-picker-agent:hover {
  background: var(--csp-accent-soft) !important;
}

.csp-dm-picker-agent > span:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.csp-dm-picker-agent strong,
.csp-dm-picker-agent small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-dm-picker-agent small,
.csp-dm-picker-empty {
  color: var(--csp-subtle);
  font-size: 9.5px;
}

.csp-dm-picker-empty {
  padding: 7px;
}

.csp-memory-preview {
  border-color: var(--csp-border-soft);
  background: color-mix(in srgb, var(--csp-canvas) 56%, transparent);
}

.csp-conversation {
  overflow: hidden;
  background: var(--csp-surface);
  color: var(--csp-fg);
}

.csp-conversation-header {
  min-height: 64px;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
  padding: 9px max(20px, calc((100% - 900px) / 2));
  border-color: var(--csp-border-soft);
  background: color-mix(in srgb, var(--csp-surface) 94%, var(--csp-canvas));
}

.csp-conversation-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}

.csp-conversation-heading > div {
  min-width: 0;
}

.csp-conversation-kicker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 47px;
  min-height: 21px;
  box-sizing: border-box;
  padding: 0 6px;
  border: 1px solid var(--csp-accent-line);
  border-radius: 5px;
  background: var(--csp-accent-soft);
  color: var(--csp-accent);
  font-size: 8px;
  font-weight: 770;
  letter-spacing: 0.075em;
}

.csp-conversation-header h1 {
  overflow: hidden;
  font-size: 15px;
  font-weight: 690;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-conversation-header p {
  overflow: hidden;
  color: var(--csp-subtle);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-header-mode {
  flex: none;
  padding: 3px 7px;
  border: 1px solid var(--csp-border-soft);
  border-radius: 999px;
  color: var(--csp-subtle);
  font-size: 9px;
  letter-spacing: 0.025em;
}

.csp-conversation-hero {
  position: relative;
  align-items: flex-start;
  max-width: 680px;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 64px 28px;
  text-align: left;
}

.csp-hero-constellation {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  margin-bottom: 28px;
  border: 1px solid var(--csp-accent-line);
  border-radius: 18px;
  background: var(--csp-accent-soft);
}

.csp-hero-constellation::before,
.csp-hero-constellation::after {
  position: absolute;
  border: 1px solid var(--csp-border-soft);
  border-radius: 50%;
  content: '';
}

.csp-hero-constellation::before { inset: 9px; }
.csp-hero-constellation::after { inset: -9px; opacity: 0.45; }

.csp-hero-constellation > i {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--csp-accent);
}

.csp-hero-constellation > i:nth-of-type(1) { top: 7px; right: 10px; opacity: 0.55; }
.csp-hero-constellation > i:nth-of-type(2) { bottom: 9px; left: 7px; opacity: 0.32; }

.csp-hero-eyebrow {
  margin-bottom: 8px;
  color: var(--csp-accent);
  font-size: 9px;
  font-weight: 760;
  letter-spacing: 0.095em;
}

.csp-conversation-hero h2 {
  max-width: 560px;
  margin-bottom: 10px;
  font-size: clamp(25px, 3.2vw, 38px);
  font-weight: 660;
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.csp-conversation-hero > p {
  max-width: 520px;
  color: var(--csp-muted);
  font-size: 13px;
  line-height: 1.6;
}

.csp-hero-flow {
  display: flex;
  align-items: center;
  width: 100%;
  margin-top: 34px;
  color: var(--csp-muted);
}

.csp-hero-flow > span {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 10px;
  font-weight: 620;
}

.csp-hero-flow b {
  color: var(--csp-accent);
  font-size: 8px;
  letter-spacing: 0.06em;
}

.csp-hero-flow > i {
  height: 1px;
  min-width: 24px;
  flex: 1;
  margin: 0 9px;
  background: var(--csp-border);
}

.csp-conversation-layout,
.csp-channel-feed {
  background: var(--csp-surface);
}

.csp-message-list {
  padding: 24px max(24px, calc((100% - 860px) / 2)) 16px;
  scrollbar-color: var(--csp-border) transparent;
}

.csp-message {
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  max-width: 860px;
  margin: 0 auto 20px;
}

.csp-message-avatar {
  width: 32px;
  height: 32px;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--csp-fg) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--csp-fg) 88%, var(--csp-surface));
  font-size: 11px;
}

.csp-message--agent .csp-message-avatar {
  border-color: var(--csp-accent-line);
  background: var(--csp-accent-soft);
  color: var(--csp-accent);
}

.csp-message--system .csp-message-avatar {
  border-color: color-mix(in srgb, var(--csp-warning) 32%, var(--csp-border));
  background: color-mix(in srgb, var(--csp-warning) 10%, transparent);
  color: var(--csp-warning);
}

.csp-message header strong {
  font-size: 12px;
  font-weight: 680;
}

.csp-message time {
  color: var(--csp-subtle);
  font-variant-numeric: tabular-nums;
}

.csp-message p {
  color: var(--csp-fg);
  font-size: 13px;
  line-height: 1.62;
}

.csp-thread-root {
  max-width: 900px;
  box-sizing: border-box;
  margin: 0 auto 10px;
  padding: 14px 14px 4px;
  border: 1px solid var(--csp-border-soft);
  border-radius: var(--csp-radius-md);
  background: color-mix(in srgb, var(--csp-raised) 92%, var(--csp-canvas));
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.csp-thread-root:hover {
  border-color: var(--csp-accent-line);
  box-shadow: 0 7px 24px color-mix(in srgb, var(--csp-fg) 5%, transparent);
}

.csp-thread-root .csp-message {
  margin-bottom: 10px;
}

.csp-thread-open {
  width: calc(100% - 44px);
  margin: -2px 0 6px 44px;
  padding: 6px 8px;
  color: var(--csp-accent);
}

.csp-thread-status {
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--csp-hover);
}

.csp-thread-status--running,
.csp-thread-status--queued {
  background: color-mix(in srgb, var(--csp-warning) 10%, transparent);
  color: var(--csp-warning);
}

.csp-thread-status--error {
  background: color-mix(in srgb, var(--csp-danger) 10%, transparent);
  color: var(--csp-danger);
}

.csp-message-composer {
  display: flex;
  width: min(calc(100% - 36px), 860px);
  box-sizing: border-box;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  margin: 0 auto 16px;
  padding: 10px 11px 8px;
  border-color: var(--csp-border);
  border-radius: var(--csp-radius-lg);
  background: var(--csp-raised);
  box-shadow: 0 8px 28px color-mix(in srgb, var(--csp-fg) 7%, transparent);
}

.csp-message-composer:focus-within {
  border-color: var(--csp-accent-line);
  box-shadow: 0 0 0 2px var(--csp-accent-soft), var(--csp-shadow-raised);
}

.csp-composer-input-wrap {
  width: 100%;
}

.csp-message-composer textarea {
  width: 100%;
  min-height: 48px;
  box-sizing: border-box;
  line-height: 1.5;
}

.csp-composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 27px;
  border-top: 1px solid var(--csp-border-soft);
  padding-top: 7px;
}

.csp-composer-footer > span {
  color: var(--csp-subtle);
  font-size: 9px;
  letter-spacing: 0.01em;
}

.csp-composer-footer button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 62px;
  justify-content: center;
  padding: 6px 10px;
}

.csp-composer-footer button > span {
  font-size: 13px;
  line-height: 1;
}

.csp-tag-suggestions {
  border-color: var(--csp-border);
  border-radius: var(--csp-radius-md);
  background: var(--csp-raised);
  box-shadow: var(--csp-shadow-raised);
}

.csp-tag-suggestions button.is-selected,
.csp-tag-suggestions button:hover {
  background: var(--csp-accent-soft);
}

.csp-command-result {
  width: min(calc(100% - 36px), 860px);
  box-sizing: border-box;
  margin: 0 auto 9px;
  padding: 9px 11px;
  border: 1px solid var(--csp-accent-line);
  border-radius: var(--csp-radius-md);
  background: var(--csp-accent-soft);
  color: var(--csp-fg);
}

.csp-command-result--success {
  border-color: color-mix(in srgb, var(--csp-success) 35%, var(--csp-border));
  background: color-mix(in srgb, var(--csp-success) 8%, transparent);
}

.csp-command-result--error {
  border-color: color-mix(in srgb, var(--csp-danger) 35%, var(--csp-border));
  background: color-mix(in srgb, var(--csp-danger) 8%, transparent);
}

.csp-command-result > header,
.csp-command-result > div {
  display: flex;
  align-items: center;
  gap: 6px;
}

.csp-command-result > header {
  justify-content: space-between;
}

.csp-command-result > header strong {
  font-size: 11px;
  font-weight: 700;
}

.csp-command-result p {
  margin: 4px 0 0;
  color: var(--csp-muted);
  font-size: 10.5px;
  line-height: 1.5;
  white-space: pre-line;
}

.csp-command-result button {
  padding: 4px 7px;
  border: 0;
  border-radius: var(--csp-radius-sm);
  background: transparent;
  color: var(--csp-muted);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.csp-command-result > div {
  margin-top: 8px;
}

.csp-command-result > div button:first-child {
  background: var(--csp-accent);
  color: white;
  font-weight: 650;
}

.csp-thread-panel {
  border-color: var(--csp-border);
  background: color-mix(in srgb, var(--csp-canvas) 42%, var(--csp-surface));
  box-shadow: -12px 0 32px color-mix(in srgb, var(--csp-fg) 4%, transparent);
}

.csp-thread-header {
  min-height: 58px;
  border-color: var(--csp-border-soft);
  background: var(--csp-raised);
}

.csp-thread-header strong {
  font-size: 12px;
  font-weight: 690;
}

.csp-thread-messages {
  padding: 14px;
  scrollbar-color: var(--csp-border) transparent;
}

.csp-thread-messages .csp-message {
  margin-bottom: 12px;
}

.csp-thread-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 12px;
}

.csp-thread-divider::after {
  height: 1px;
  flex: 1;
  background: var(--csp-border-soft);
  content: '';
}

.csp-thread-composer {
  border-color: var(--csp-border-soft);
  background: var(--csp-raised);
}

.csp-conversation-empty,
.csp-agent-working {
  color: var(--csp-subtle);
}

.csp-conversation-error,
.csp-runtime-error {
  border: 1px solid color-mix(in srgb, var(--csp-danger) 24%, transparent);
  background: color-mix(in srgb, var(--csp-danger) 9%, transparent);
  color: var(--csp-danger);
}

@media (max-width: 720px) {
  .csp-conversation-header {
    padding-inline: 12px;
  }

  .csp-header-mode,
  .csp-composer-footer > span {
    display: none;
  }

  .csp-conversation-hero {
    padding: 44px 20px;
  }

  .csp-hero-flow {
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
  }

  .csp-hero-flow > i {
    width: 1px;
    min-width: 0;
    height: 10px;
    flex: none;
    margin: 0 0 0 8px;
  }

  .csp-message-list {
    padding: 16px 12px 12px;
  }

  .csp-thread-root {
    padding-inline: 10px;
  }

  .csp-message-composer {
    width: calc(100% - 20px);
    margin-bottom: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .csp-section-chevron,
  .csp-thread-root {
    transition: none;
  }
}
`
