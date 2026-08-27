/** OpenDesign Neutral Modern production layer. Product behavior remains unchanged. */
export const commonspacePolish = String.raw`
.csp-browser,
.csp-conversation,
.csp-switch,
.csp-dialog {
  --csp-fg: var(--dsw-alias-label-primary, #111111);
  --csp-muted: var(--dsw-alias-label-secondary, #6b6b6b);
  --csp-subtle: var(--dsw-alias-label-tertiary, #7a7a7a);
  --csp-surface: var(--dsw-alias-bg-base, #ffffff);
  --csp-raised: var(--dsw-alias-fill-l1, #ffffff);
  --csp-border: var(--dsw-alias-border-l2, #e5e5e5);
  --csp-border-soft: var(--csp-border);
  --csp-hover: rgba(17, 17, 17, 0.05);
  --csp-active: rgba(17, 17, 17, 0.08);
  --csp-sidebar-fg: var(--csp-fg);
  --csp-sidebar-muted: var(--csp-muted);
  --csp-sidebar-hover: rgba(17, 17, 17, 0.05);
  --csp-sidebar-active: rgba(17, 17, 17, 0.08);
  --csp-accent: #2f6feb;
  --csp-accent-soft: color-mix(in srgb, var(--csp-accent) 11%, transparent);
  --csp-success: #17a34a;
  --csp-warning: #b7791f;
  --csp-danger: #dc2626;
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
  opacity: 0.5;
}

.csp-browser {
  position: relative;
  overflow: hidden;
  background: var(--csp-shell-bg, #fafafa);
  color: var(--csp-sidebar-fg);
}

.csp-browser-header {
  display: flex;
  min-height: 144px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  padding: 16px 16px 12px;
  border: 0;
  background: transparent;
}

.csp-browser-header > .csp-workspace-identity {
  display: flex;
  min-width: 0;
  min-height: 44px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.csp-workspace-mark {
  display: inline-grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border: 1px solid var(--csp-border);
  border-radius: 8px;
  background: var(--csp-surface);
  color: var(--csp-fg);
}

.csp-workspace-mark .csp-mark {
  grid-template-columns: repeat(2, 5px);
  grid-template-rows: repeat(2, 5px);
  width: 13px;
  height: 13px;
  color: var(--csp-fg);
  transform: none;
}

.csp-workspace-name {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.csp-workspace-name strong,
.csp-workspace-name small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-workspace-name strong {
  font-size: 16px;
  font-weight: 650;
  line-height: 1.2;
}

.csp-workspace-name small {
  margin-top: 2px;
  color: var(--csp-muted);
  font-size: 12px;
}

.csp-workspace-options {
  display: inline-grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--csp-muted);
  font-size: 14px;
  letter-spacing: 2px;
}

.csp-browser-search {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 44px;
  box-sizing: border-box;
  gap: 9px;
  margin-top: 16px;
  padding: 0 12px;
  border: 1px solid var(--csp-border);
  border-radius: 8px;
  background: var(--csp-surface);
  color: var(--csp-sidebar-muted);
  font: inherit;
  text-align: left;
  transition: background-color 150ms cubic-bezier(0.2, 0, 0, 1), border-color 150ms cubic-bezier(0.2, 0, 0, 1);
}

.csp-browser-search:hover,
.csp-browser-search:focus-visible {
  border-color: var(--csp-fg);
  background: var(--csp-surface);
}

.csp-browser-search-icon {
  position: relative;
  flex: none;
  width: 11px;
  height: 11px;
  overflow: hidden;
  color: transparent;
  font-size: 0;
}

.csp-browser-search-icon::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 6px;
  border: 1.4px solid var(--csp-sidebar-muted);
  border-radius: 50%;
  content: '';
}

.csp-browser-search-icon::after {
  position: absolute;
  right: 0;
  bottom: 1px;
  width: 5px;
  height: 1.4px;
  border-radius: 99px;
  background: var(--csp-sidebar-muted);
  content: '';
  transform: rotate(45deg);
  transform-origin: right center;
}

.csp-browser-search-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--csp-sidebar-muted);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-browser-search kbd {
  flex: none;
  color: var(--csp-sidebar-muted);
  font-family: inherit;
  font-size: 10px;
}

.csp-browser-scroll {
  min-height: 0;
  flex: 1;
  padding: 4px 12px 16px;
  scrollbar-color: color-mix(in srgb, var(--csp-sidebar-fg) 14%, transparent) transparent;
}

.csp-browser-section {
  margin: 0 0 8px;
}

.csp-browser-section-head {
  min-height: 44px;
  gap: 1px;
}

.csp-browser-disclosure {
  min-height: 44px;
  gap: 6px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--csp-sidebar-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.csp-browser-disclosure:hover {
  background: transparent;
  color: var(--csp-sidebar-fg);
}

.csp-section-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: 10px;
  flex: none;
  transform: rotate(0deg);
  font-size: 12px;
  opacity: 0.58;
  transition: transform 120ms ease;
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
  display: none;
}

.csp-browser-add,
.csp-project-add,
.csp-browser-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--csp-sidebar-muted);
}

.csp-browser-add {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  font-size: 16px;
}

.csp-project-add {
  position: absolute;
  z-index: 1;
  top: 50%;
  right: 4px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 15px;
  opacity: 0;
  transform: translateY(-50%);
}

.csp-browser-refresh {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  font-size: 14px;
}

.csp-browser-add:hover,
.csp-project-add:hover,
.csp-browser-refresh:hover {
  background: var(--csp-sidebar-hover);
  color: var(--csp-sidebar-fg);
}

.csp-channel-head:hover .csp-project-add,
.csp-agent-head:hover .csp-project-add,
.csp-channel-head:focus-within .csp-project-add,
.csp-agent-head:focus-within .csp-project-add,
.csp-project-add:focus-visible {
  opacity: 1;
}

.csp-browser-section-body {
  gap: 2px;
  padding-left: 0;
}

.csp-browser-row {
  position: relative;
  min-height: 44px;
  gap: 9px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: color-mix(in srgb, var(--csp-sidebar-fg) 88%, transparent);
}

.csp-browser-row:hover {
  background: var(--csp-sidebar-hover);
  color: var(--csp-sidebar-fg);
}

.csp-browser-row[aria-pressed='true'] {
  background: var(--csp-sidebar-active);
  box-shadow: none;
  color: var(--csp-sidebar-fg);
}

.csp-browser-row-main {
  gap: 0;
}

.csp-browser-row-main strong {
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.006em;
}

.csp-browser-row-main small {
  margin-top: 1px;
  color: var(--csp-sidebar-muted);
  font-size: 11px;
  line-height: 14px;
}

.csp-project-head,
.csp-channel-head,
.csp-agent-head {
  position: relative;
  gap: 1px;
}

.csp-project-group {
  position: relative;
  min-width: 0;
}

.csp-project-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  width: 267px;
  max-height: min(520px, calc(100dvh - 210px));
  box-sizing: border-box;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--csp-border);
  border-radius: 12px;
  background: var(--csp-raised);
  box-shadow: 0 10px 28px rgba(17, 17, 17, 0.12);
  color: var(--csp-fg);
}

.csp-project-menu-kicker {
  padding: 6px 12px 2px;
  color: var(--csp-muted);
  font-size: 11px;
  font-weight: 650;
}

.csp-project-menu-identity {
  padding: 6px 12px 12px;
  border-bottom: 1px solid var(--csp-border);
  margin-bottom: 8px;
}

.csp-project-menu-identity strong,
.csp-project-menu-identity small,
.csp-project-menu-item > span:last-child strong,
.csp-project-menu-item > span:last-child small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.csp-project-menu-identity strong {
  font-size: 14px;
  font-weight: 650;
}

.csp-project-menu-identity small {
  margin-top: 3px;
  color: var(--csp-muted);
  font-size: 11px;
  line-height: 1.4;
}

.csp-project-menu-label {
  padding: 8px 12px 5px;
  color: var(--csp-muted);
  font-size: 11px;
  font-weight: 650;
}

.csp-project-menu-item {
  display: grid;
  width: 100%;
  min-height: 54px;
  box-sizing: border-box;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--csp-fg);
  font: inherit;
  text-align: left;
}

.csp-project-menu-item:hover:not(:disabled) {
  background: var(--csp-hover);
}

.csp-project-menu-item:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.csp-project-menu-item > span:last-child {
  min-width: 0;
}

.csp-project-menu-item > span:last-child strong {
  font-size: 13px;
  font-weight: 620;
  white-space: nowrap;
}

.csp-project-menu-item > span:last-child small {
  margin-top: 2px;
  color: var(--csp-muted);
  font-size: 10px;
  line-height: 1.35;
  white-space: normal;
}

.csp-project-menu-icon,
.csp-project-menu-folder {
  position: relative;
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  color: var(--csp-muted);
  font-size: 14px;
}

.csp-project-menu-folder::before {
  width: 15px;
  height: 11px;
  box-sizing: border-box;
  border: 1.4px solid currentColor;
  border-radius: 2px;
  content: '';
}

.csp-project-menu-divider {
  height: 1px;
  margin: 8px 0;
  background: var(--csp-border);
}

.csp-project-glyph {
  position: relative;
  display: inline-flex;
  width: 15px;
  height: 12px;
  flex: none;
  box-sizing: border-box;
  border: 1.4px solid currentColor;
  border-radius: 3px;
  background: transparent;
  color: var(--csp-sidebar-muted);
}

.csp-project-glyph::before {
  position: absolute;
  top: -3px;
  left: 1px;
  width: 6px;
  height: 3px;
  border: 1.4px solid currentColor;
  border-bottom: 0;
  border-radius: 2px 2px 0 0;
  background: transparent;
  content: '';
}

.csp-project-glyph > span {
  display: none;
}

.csp-browser-hash {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 18px;
  flex: none;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--csp-sidebar-muted);
  font-size: 15px;
  font-weight: 520;
}

.csp-project-workspaces {
  margin: 1px 4px 4px 11px;
  padding-left: 10px;
  border-color: color-mix(in srgb, var(--csp-sidebar-fg) 16%, transparent);
}

.csp-workspace-row {
  min-height: 25px;
  color: color-mix(in srgb, var(--csp-sidebar-fg) 82%, transparent);
  font-size: 10px;
}

.csp-workspace-glyph {
  width: 8px;
  height: 8px;
  border-color: color-mix(in srgb, var(--csp-sidebar-fg) 28%, transparent);
  border-radius: 2px;
  background: transparent;
  box-shadow: none;
}

.csp-agent-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  box-sizing: border-box;
  border: 1px solid var(--csp-border);
  border-radius: 8px;
  background: var(--csp-surface);
  color: var(--csp-sidebar-fg);
  font-size: 11px;
  font-weight: 650;
}

.csp-agent-presence {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 7px;
  height: 7px;
  box-sizing: content-box;
  border: 2px solid var(--csp-shell-bg, #fafafa);
  border-radius: 50%;
  background: var(--csp-sidebar-muted);
}

.csp-agent-presence--running { background: var(--csp-success); }
.csp-agent-presence--stopped { background: var(--csp-warning); }

.csp-agent-meta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.csp-agent-meta > span:not(.csp-runtime-badge):not(.csp-agent-status) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.csp-runtime-badge,
.csp-agent-status {
  display: inline;
  min-height: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--csp-sidebar-muted);
  font-size: 10px;
  font-weight: 560;
  letter-spacing: 0;
}

.csp-runtime-badge::after {
  content: ' ·';
}

.csp-agent-status {
  display: none;
}

.csp-browser-empty,
.csp-browser-status {
  margin: 0 7px 2px;
  padding: 4px 6px;
  border: 0;
  border-radius: 5px;
  color: var(--csp-sidebar-muted);
  font-size: 9.5px;
  line-height: 14px;
}

.csp-browser-footer {
  display: flex;
  align-items: center;
  min-height: 64px;
  box-sizing: border-box;
  gap: 5px;
  padding: 10px 12px 10px 16px;
  border-top: 1px solid var(--csp-border);
  background: transparent;
}

.csp-browser-brand {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
  padding: 0;
}

.csp-browser-brand > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.csp-browser-brand strong {
  overflow: hidden;
  color: var(--csp-sidebar-fg);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-browser-brand span:not(.csp-mark) {
  margin-top: 2px;
  color: var(--csp-sidebar-muted);
  font-size: 11px;
  line-height: 13px;
}

.csp-browser-brand em {
  display: none;
}

.csp-mark--brand {
  grid-template-columns: repeat(2, 5px);
  grid-template-rows: repeat(2, 5px);
  width: 13px;
  height: 13px;
  padding: 9px;
  border: 1px solid var(--csp-border);
  border-radius: 8px;
  background: var(--csp-surface);
  color: var(--csp-sidebar-fg);
  transform: none;
}

.csp-browser-header-actions {
  display: flex;
  flex: none;
  gap: 1px;
}

.csp-browser-form {
  gap: 6px;
  margin: 3px 3px 8px;
  padding: 9px;
  border: 1px solid var(--csp-border);
  border-radius: 10px;
  background: var(--csp-raised);
  color: var(--csp-fg);
  box-shadow: 0 8px 24px rgba(22, 25, 28, 0.1);
}

.csp-global-settings {
  position: absolute;
  z-index: 6;
  top: 136px;
  right: 12px;
  left: 12px;
  max-height: calc(100% - 212px);
  overflow-y: auto;
  margin: 0;
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
  border-color: color-mix(in srgb, var(--csp-fg) 48%, var(--csp-border));
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--csp-fg) 8%, transparent);
}

.csp-browser-form button,
.csp-message-composer button,
.csp-thread-composer button {
  border-radius: 8px;
  background: var(--csp-accent);
  color: #ffffff;
  font-weight: 650;
}

.csp-browser-form button[type='button'] {
  background: transparent;
  color: var(--csp-muted);
}

.csp-browser-form button[type='button']:hover {
  background: var(--csp-hover);
}

.csp-directory-picker {
  min-width: 0;
}

.csp-dialog-backdrop {
  position: fixed;
  z-index: 40;
  inset: 0;
  background: rgba(20, 22, 25, 0.24);
  backdrop-filter: blur(3px);
}

.csp-dialog {
  position: fixed;
  z-index: 41;
  top: 50%;
  left: 50%;
  display: flex;
  width: min(620px, calc(100vw - 32px));
  max-height: min(720px, calc(100dvh - 40px));
  box-sizing: border-box;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--csp-border);
  border-radius: 18px;
  background: var(--csp-raised);
  box-shadow: 0 24px 80px rgba(20, 22, 26, 0.24);
  color: var(--csp-fg);
  transform: translate(-50%, -50%);
}

.csp-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  border: 0;
  margin: -1px;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.csp-search-backdrop {
  background: rgba(20, 22, 25, 0.32);
}

.csp-search-dialog {
  width: min(680px, calc(100vw - 32px));
  max-height: min(620px, calc(100dvh - 40px));
  border-radius: 16px;
  box-shadow: 0 28px 90px rgba(17, 19, 23, 0.3);
}

.csp-search-header {
  display: grid;
  min-height: 62px;
  box-sizing: border-box;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--csp-border-soft);
}

.csp-search-icon {
  position: relative;
  width: 15px;
  height: 15px;
  color: var(--csp-subtle);
}

.csp-search-icon::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 9px;
  height: 9px;
  border: 1.7px solid currentColor;
  border-radius: 50%;
  content: '';
}

.csp-search-icon::after {
  position: absolute;
  right: 0;
  bottom: 1px;
  width: 7px;
  height: 1.7px;
  border-radius: 99px;
  background: currentColor;
  content: '';
  transform: rotate(45deg);
  transform-origin: right center;
}

.csp-search-header input {
  width: 100%;
  height: 42px;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--csp-fg);
  font: inherit;
  font-size: 17px;
  letter-spacing: -0.01em;
}

.csp-search-header input::placeholder {
  color: var(--csp-subtle);
}

.csp-search-header input::-webkit-search-cancel-button {
  opacity: 0.5;
}

.csp-search-header > kbd,
.csp-search-footer kbd {
  border: 1px solid var(--csp-border);
  border-radius: 5px;
  background: var(--csp-hover);
  color: var(--csp-subtle);
  font-family: inherit;
  font-size: 9px;
  font-weight: 650;
  line-height: 1;
}

.csp-search-header > kbd {
  padding: 4px 5px;
}

.csp-search-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px 5px;
  color: var(--csp-subtle);
  font-size: 10px;
  font-weight: 680;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.csp-search-results {
  min-height: 90px;
  overflow-y: auto;
  padding: 4px 7px 8px;
  scrollbar-color: color-mix(in srgb, var(--csp-fg) 16%, transparent) transparent;
}

.csp-search-result {
  display: grid;
  width: 100%;
  min-height: 54px;
  box-sizing: border-box;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 7px 9px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--csp-fg);
  font: inherit;
  text-align: left;
}

.csp-search-result:hover,
.csp-search-result[aria-selected='true'] {
  background: var(--csp-hover);
}

.csp-search-result-glyph {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--csp-border-soft);
  border-radius: 8px;
  background: var(--csp-surface);
  color: var(--csp-muted);
  font-size: 14px;
  font-weight: 700;
}

.csp-search-result-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.csp-search-result-main strong,
.csp-search-result-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-search-result-main strong {
  font-size: 13px;
  font-weight: 650;
}

.csp-search-result-main small,
.csp-search-result-meta {
  color: var(--csp-subtle);
  font-size: 11px;
}

.csp-search-result-meta {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-search-empty {
  display: flex;
  min-height: 90px;
  align-items: center;
  justify-content: center;
  padding: 16px;
  color: var(--csp-subtle);
  font-size: 12px;
  text-align: center;
}

.csp-search-footer {
  display: flex;
  min-height: 38px;
  box-sizing: border-box;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 7px 13px;
  border-top: 1px solid var(--csp-border-soft);
  color: var(--csp-subtle);
  font-size: 10px;
}

.csp-search-footer span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.csp-search-footer kbd {
  min-width: 17px;
  box-sizing: border-box;
  padding: 3px 4px;
  text-align: center;
}

.csp-dialog-header {
  display: flex;
  min-height: 58px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 18px;
  border-bottom: 1px solid var(--csp-border-soft);
}

.csp-dialog-header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 680;
  letter-spacing: -0.02em;
}

.csp-dialog-header button {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--csp-muted);
  font: inherit;
  font-size: 21px;
  line-height: 1;
}

.csp-dialog-header button:hover {
  background: var(--csp-hover);
  color: var(--csp-fg);
}

.csp-dialog-body {
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
}

.csp-dialog .csp-browser-form {
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.csp-dialog .csp-browser-form input,
.csp-dialog .csp-browser-form select,
.csp-dialog .csp-browser-form textarea {
  min-height: 40px;
  box-sizing: border-box;
  font-size: 13px;
}

.csp-dialog .csp-browser-form fieldset {
  margin: 6px 0;
  padding: 12px;
  border-color: var(--csp-border-soft);
  border-radius: 10px;
}

.csp-dialog .csp-browser-form > div:last-child {
  margin-top: 8px;
}

.csp-dialog .csp-directory-picker {
  display: flex;
  align-items: center;
  gap: 7px;
}

.csp-dialog .csp-directory-picker input {
  min-width: 0;
  flex: 1;
}

.csp-dialog .csp-discovered-agents {
  margin-bottom: 16px;
  padding: 10px;
  border: 1px solid var(--csp-border-soft);
  border-radius: 11px;
  background: var(--csp-hover);
}

.csp-global-settings > label,
.csp-dm-search {
  display: grid !important;
  align-items: stretch !important;
  gap: 4px !important;
  color: var(--csp-muted);
  font-weight: 620;
}

.csp-global-settings > label input,
.csp-global-settings > label select,
.csp-dm-search input {
  width: 100% !important;
  height: 30px !important;
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
  grid-template-columns: 23px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px !important;
  color: var(--csp-fg) !important;
  text-align: left;
}

.csp-dm-picker-agent:hover {
  background: var(--csp-hover) !important;
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
  font-size: 9px;
}

.csp-memory-preview {
  border-color: var(--csp-border-soft);
  background: var(--csp-hover);
}

.csp-project-view {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--csp-surface);
  color: var(--csp-fg);
}

.csp-project-view-header {
  display: flex;
  min-height: 68px;
  box-sizing: border-box;
  align-items: center;
  padding: 10px 24px;
  border-bottom: 1px solid var(--csp-border);
  background: var(--csp-surface);
}

.csp-project-view-header > div {
  min-width: 0;
}

.csp-project-view-header h1,
.csp-project-view-header p {
  margin: 0;
}

.csp-project-view-header h1 {
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -0.016em;
}

.csp-project-view-header p {
  margin-top: 3px;
  color: var(--csp-muted);
  font-size: 12px;
}

.csp-project-toolbar {
  display: flex;
  min-height: 57px;
  box-sizing: border-box;
  align-items: center;
  gap: 12px;
  padding: 6px 20px;
  border-bottom: 1px solid var(--csp-border);
  background: var(--csp-surface);
}

.csp-project-back,
.csp-project-tabs button {
  min-height: 44px;
  box-sizing: border-box;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--csp-muted);
  font: inherit;
  font-size: 14px;
  font-weight: 560;
}

.csp-project-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.csp-project-back > span {
  font-size: 20px;
  font-weight: 400;
}

.csp-project-back:hover,
.csp-project-tabs button:hover:not(:disabled) {
  background: var(--csp-hover);
  color: var(--csp-fg);
}

.csp-project-tabs {
  display: flex;
  min-width: 0;
  align-self: stretch;
  align-items: center;
  gap: 4px;
}

.csp-project-tabs button {
  position: relative;
  align-self: stretch;
  border-radius: 0;
}

.csp-project-tabs button[aria-selected='true'] {
  color: var(--csp-fg);
}

.csp-project-tabs button[aria-selected='true']::after {
  position: absolute;
  right: 10px;
  bottom: 0;
  left: 10px;
  height: 2px;
  background: var(--csp-accent);
  content: '';
}

.csp-project-tabs button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.csp-project-local-pill {
  display: inline-flex;
  min-height: 32px;
  box-sizing: border-box;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 0 12px;
  border: 1px solid var(--csp-border);
  border-radius: 999px;
  color: var(--csp-muted);
  font-size: 11px;
}

.csp-project-content {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 24px;
  background: var(--csp-shell-bg, #fafafa);
}

.csp-project-card {
  display: flex;
  width: min(760px, 100%);
  min-height: calc(100dvh - 173px);
  box-sizing: border-box;
  flex-direction: column;
  overflow: hidden;
  margin: 0 auto;
  border: 1px solid var(--csp-border);
  border-radius: 12px;
  background: var(--csp-surface);
}

.csp-project-card-head {
  padding: 16px;
  border-bottom: 1px solid var(--csp-border);
}

.csp-project-card-head strong,
.csp-project-card-head small {
  display: block;
}

.csp-project-card-head strong {
  font-size: 14px;
  font-weight: 650;
}

.csp-project-card-head small {
  margin-top: 3px;
  color: var(--csp-muted);
  font-size: 11px;
}

.csp-project-conversation-list {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.csp-project-conversation-row {
  display: grid;
  width: 100%;
  min-height: 72px;
  box-sizing: border-box;
  grid-template-columns: 28px minmax(0, 1fr) 20px;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--csp-fg);
  font: inherit;
  text-align: left;
}

.csp-project-conversation-row:hover {
  background: var(--csp-hover);
}

.csp-project-conversation-glyph,
.csp-project-conversation-avatar {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  color: var(--csp-muted);
  font-size: 14px;
  font-weight: 650;
}

.csp-project-conversation-avatar {
  border: 1px solid var(--csp-border);
  border-radius: 8px;
  background: var(--csp-surface);
  color: var(--csp-fg);
  font-size: 10px;
}

.csp-project-conversation-main {
  min-width: 0;
}

.csp-project-conversation-main strong,
.csp-project-conversation-main small,
.csp-project-conversation-main p {
  display: block;
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-project-conversation-main strong {
  font-size: 14px;
  font-weight: 650;
}

.csp-project-conversation-main small {
  margin-top: 2px;
  color: var(--csp-muted);
  font-size: 11px;
}

.csp-project-conversation-main p {
  margin-top: 5px;
  color: var(--csp-muted);
  font-size: 12px;
}

.csp-project-conversation-arrow {
  align-self: center;
  color: var(--csp-muted);
  font-size: 16px;
}

.csp-project-card-foot {
  display: flex;
  min-height: 44px;
  align-items: center;
  padding: 0 16px;
  border-top: 1px solid var(--csp-border);
  color: var(--csp-muted);
  font-size: 11px;
}

.csp-project-empty {
  padding: 20px;
  color: var(--csp-muted);
  font-size: 13px;
}

.csp-project-folder-card {
  min-height: 0;
  margin-top: 16px;
}

.csp-project-folder-list {
  padding: 8px;
}

.csp-project-folder-row {
  display: grid;
  min-height: 56px;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
}

.csp-project-folder-glyph {
  position: relative;
  width: 17px;
  height: 12px;
  border: 1.5px solid var(--csp-muted);
  border-radius: 2px;
}

.csp-project-folder-row > span:nth-child(2) {
  min-width: 0;
}

.csp-project-folder-row strong,
.csp-project-folder-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-project-folder-row strong {
  font-size: 13px;
  font-weight: 620;
}

.csp-project-folder-row small {
  margin-top: 3px;
  color: var(--csp-muted);
  font-size: 10px;
}

.csp-project-unavailable {
  padding: 4px 8px;
  border: 1px solid var(--csp-border);
  border-radius: 999px;
  color: var(--csp-muted);
  font-size: 10px;
}

.csp-project-view-empty {
  display: grid;
  min-height: 0;
  flex: 1;
  place-items: center;
  padding: 24px;
}

.csp-project-view-empty button {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--csp-border);
  border-radius: 8px;
  background: var(--csp-surface);
  color: var(--csp-fg);
}

.csp-conversation {
  overflow: hidden;
  background: var(--csp-surface);
  color: var(--csp-fg);
}

.csp-conversation-header {
  min-height: 68px;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
  padding: 10px 20px 10px 24px;
  border-color: var(--csp-border-soft);
  background: var(--csp-surface);
}

.csp-conversation-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.csp-conversation-heading > div {
  min-width: 0;
}

.csp-conversation-kicker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  min-height: 20px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--csp-fg);
  font-size: 16px;
  font-weight: 520;
  letter-spacing: 0;
}

.csp-conversation-header h1 {
  overflow: hidden;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.016em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-conversation-header p {
  overflow: hidden;
  margin-top: 3px;
  color: var(--csp-subtle);
  font-size: 12px;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-header-actions {
  display: flex;
  align-items: center;
  flex: none;
  gap: 6px;
}

.csp-header-roster,
.csp-header-mode {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  box-sizing: border-box;
  gap: 5px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--csp-muted);
  font-size: 12px;
  box-shadow: none;
}

.csp-header-roster > span {
  position: relative;
  width: 13px;
  height: 11px;
  overflow: hidden;
  color: transparent;
  font-size: 0;
}

.csp-header-roster > span::before,
.csp-header-roster > span::after {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid var(--csp-muted);
  border-radius: 50%;
  content: '';
}

.csp-header-roster > span::before {
  top: 0;
  left: 2px;
  width: 5px;
  height: 5px;
  box-shadow: 5px 1px 0 -1px var(--csp-surface), 5px 1px 0 0 var(--csp-muted);
}

.csp-header-roster > span::after {
  right: 1px;
  bottom: 0;
  left: 0;
  height: 6px;
  border-radius: 7px 7px 3px 3px;
  border-bottom-color: transparent;
}

.csp-header-mode {
  position: relative;
  width: 36px;
  padding: 0;
  overflow: hidden;
  color: transparent;
  font-size: 0;
}

.csp-header-mode::after {
  color: var(--csp-muted);
  content: '•••';
  font-size: 10px;
  letter-spacing: 1px;
}

.csp-conversation-hero {
  position: relative;
  align-items: flex-start;
  justify-content: flex-start;
  max-width: none;
  box-sizing: border-box;
  margin: 0;
  padding: clamp(44px, 8vh, 82px) clamp(24px, 6vw, 72px);
  text-align: left;
}

.csp-hero-constellation {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 22px;
  border: 1px solid var(--csp-border-soft);
  border-radius: 14px;
  background: var(--csp-hover);
}

.csp-hero-constellation::before,
.csp-hero-constellation::after {
  position: absolute;
  border: 1px solid var(--csp-border-soft);
  border-radius: 50%;
  content: '';
}

.csp-hero-constellation::before { inset: 8px; }
.csp-hero-constellation::after { display: none; }

.csp-hero-constellation > i {
  display: none;
}

.csp-hero-eyebrow {
  margin-bottom: 8px;
  color: var(--csp-subtle);
  font-size: 9px;
  font-weight: 690;
  letter-spacing: 0.075em;
}

.csp-conversation-hero h2 {
  max-width: 600px;
  margin-bottom: 8px;
  font-size: clamp(25px, 3vw, 38px);
  font-weight: 680;
  line-height: 1.08;
  letter-spacing: -0.038em;
}

.csp-conversation-hero > p {
  max-width: 560px;
  color: var(--csp-muted);
  font-size: 13px;
  line-height: 1.55;
}

.csp-hero-flow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(100%, 760px);
  gap: 10px;
  margin-top: 30px;
  color: var(--csp-fg);
}

.csp-hero-flow > span {
  display: flex;
  min-width: 0;
  min-height: 88px;
  box-sizing: border-box;
  align-items: flex-start;
  gap: 10px;
  padding: 15px;
  border: 1px solid var(--csp-border-soft);
  border-radius: 11px;
  background: var(--csp-surface);
}

.csp-hero-flow > span > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 660;
}

.csp-hero-flow small {
  color: var(--csp-subtle);
  font-size: 9.5px;
  font-weight: 450;
  line-height: 1.35;
}

.csp-hero-flow b {
  color: var(--csp-subtle);
  font-size: 8px;
  letter-spacing: 0.05em;
}

.csp-conversation-layout,
.csp-channel-feed {
  background: var(--csp-surface);
}

.csp-message-list {
  padding: 32px 24px 12px;
  scrollbar-color: var(--csp-border) transparent;
}

.csp-message {
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 780px;
  margin: 0 auto 24px;
  padding: 0;
  border-radius: 8px;
}

.csp-message:hover {
  background: transparent;
}

.csp-message-avatar {
  width: 36px;
  height: 36px;
  box-sizing: border-box;
  border: 1px solid var(--csp-border);
  border-radius: 8px;
  background: var(--csp-surface);
  color: var(--csp-fg);
  font-size: 11px;
  font-weight: 650;
}

.csp-message--agent .csp-message-avatar {
  border-color: var(--csp-border);
  background: var(--csp-surface);
  color: var(--csp-accent);
}

.csp-message--system .csp-message-avatar {
  background: var(--csp-hover);
  color: var(--csp-muted);
}

.csp-message header {
  gap: 8px;
  line-height: 18px;
}

.csp-message header strong {
  font-size: 14px;
  font-weight: 650;
}

.csp-message time {
  color: var(--csp-subtle);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.csp-message p {
  margin-top: 4px;
  color: var(--csp-fg);
  font-size: 14px;
  line-height: 1.5;
}

.csp-tag {
  padding: 1px 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--csp-fg) 8%, transparent);
  color: inherit;
  font-weight: 620;
}

.csp-thread-root {
  width: 100%;
  max-width: 780px;
  box-sizing: border-box;
  margin: 0 auto 8px;
  padding: 0 0 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  transition: background-color 150ms cubic-bezier(0.2, 0, 0, 1);
}

.csp-thread-root:hover {
  background: transparent;
  box-shadow: none;
}

.csp-thread-root .csp-message {
  margin: 0;
}

.csp-thread-root:hover .csp-message {
  background: transparent;
}

.csp-thread-open {
  display: inline-flex;
  width: auto;
  min-height: 44px;
  justify-content: flex-start;
  gap: 8px;
  margin: 0 0 0 48px;
  padding: 4px 8px;
  border-radius: 8px;
  color: var(--csp-accent);
  font-size: 12px;
  font-weight: 600;
}

.csp-thread-open:hover {
  background: var(--csp-hover);
}

.csp-thread-status {
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--csp-hover);
  color: var(--csp-subtle);
  font-size: 8.5px;
}

.csp-thread-status--running,
.csp-thread-status--queued {
  background: color-mix(in srgb, var(--csp-warning) 11%, transparent);
  color: var(--csp-warning);
}

.csp-thread-status--error {
  background: color-mix(in srgb, var(--csp-danger) 11%, transparent);
  color: var(--csp-danger);
}

.csp-message-composer {
  display: flex;
  width: calc(100% - 48px);
  max-width: none;
  box-sizing: border-box;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  margin: 0 24px 20px;
  padding: 12px 12px 8px;
  border-color: var(--csp-border);
  border-radius: 12px;
  background: var(--csp-surface);
  box-shadow: none;
}

.csp-message-composer:focus-within {
  border-color: var(--csp-accent);
  box-shadow: none;
}

.csp-composer-input-wrap {
  width: 100%;
}

.csp-message-composer textarea {
  width: 100%;
  min-height: 60px;
  box-sizing: border-box;
  line-height: 1.5;
  resize: none;
}

.csp-message-composer textarea::placeholder,
.csp-thread-composer textarea::placeholder {
  color: var(--csp-subtle);
}

.csp-message-composer textarea:focus-visible,
.csp-thread-composer textarea:focus-visible {
  box-shadow: none;
}

.csp-composer-footer {
  display: flex;
  align-items: center;
  min-height: 52px;
  gap: 10px;
  padding-top: 0;
  border-top: 0;
}

.csp-composer-tools {
  display: flex;
  align-items: center;
  gap: 2px;
}

.csp-composer-tools > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--csp-muted);
  font-size: 14px;
  font-weight: 600;
}

.csp-composer-tools > span:last-child {
  font-size: 12px;
}

.csp-composer-hint {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--csp-subtle);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-composer-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: 44px;
  min-width: 76px;
  padding: 0 16px;
  border-radius: 8px;
  background: var(--csp-accent);
  color: #ffffff;
}

.csp-composer-footer button:disabled {
  background: color-mix(in srgb, var(--csp-accent) 52%, transparent);
  opacity: 0.55;
}

.csp-composer-footer button > span:first-child {
  display: none;
}

.csp-send-label {
  position: static;
  width: auto;
  height: auto;
  overflow: visible;
  clip: auto;
  clip-path: none;
  color: inherit;
  font-size: 14px;
  font-weight: 650;
  white-space: nowrap;
}

.csp-tag-suggestions {
  border-color: var(--csp-border);
  border-radius: 10px;
  background: var(--csp-raised);
  box-shadow: 0 12px 36px rgba(20, 22, 26, 0.14);
}

.csp-tag-suggestions button.is-selected,
.csp-tag-suggestions button:hover {
  background: var(--csp-hover);
}

.csp-command-result {
  width: calc(100% - 28px);
  max-width: none;
  box-sizing: border-box;
  margin: 0 14px 8px;
  padding: 9px 11px;
  border: 1px solid var(--csp-border);
  border-radius: 10px;
  background: var(--csp-hover);
  color: var(--csp-fg);
}

.csp-command-result--success {
  border-color: color-mix(in srgb, var(--csp-success) 32%, var(--csp-border));
  background: color-mix(in srgb, var(--csp-success) 7%, transparent);
}

.csp-command-result--error {
  border-color: color-mix(in srgb, var(--csp-danger) 32%, var(--csp-border));
  background: color-mix(in srgb, var(--csp-danger) 7%, transparent);
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
  font-size: 10.5px;
}

.csp-command-result p {
  margin: 4px 0 0;
  color: var(--csp-muted);
  font-size: 10px;
  line-height: 1.45;
  white-space: pre-line;
}

.csp-command-result button {
  padding: 4px 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--csp-muted);
  font: inherit;
  font-size: 10px;
}

.csp-command-result > div {
  margin-top: 8px;
}

.csp-command-result > div button:first-child {
  background: var(--csp-accent);
  color: #ffffff;
  font-weight: 650;
}

.csp-conversation-layout.has-thread {
  grid-template-columns: minmax(0, 1fr) minmax(340px, 400px);
}

.csp-thread-panel {
  border-color: var(--csp-border);
  background: var(--csp-surface);
  box-shadow: none;
}

.csp-thread-header {
  min-height: 68px;
  padding: 10px 20px;
  border-color: var(--csp-border-soft);
  background: var(--csp-surface);
}

.csp-thread-header strong {
  font-size: 20px;
  font-weight: 650;
}

.csp-thread-header span {
  margin-top: 2px;
  font-size: 11px;
}

.csp-thread-messages {
  padding: 20px;
  scrollbar-color: var(--csp-border) transparent;
}

.csp-thread-messages .csp-message {
  max-width: none;
  margin-bottom: 24px;
}

.csp-thread-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0 20px;
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0;
}

.csp-thread-divider::after {
  height: 1px;
  flex: 1;
  background: var(--csp-border-soft);
  content: '';
}

.csp-thread-composer {
  margin: 0 16px 16px;
  padding: 12px;
  border: 1px solid var(--csp-border);
  border-radius: 12px;
  background: var(--csp-surface);
}

.csp-thread-composer > button {
  min-width: 64px;
  min-height: 44px;
  border-radius: 8px;
  background: var(--csp-accent);
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

.csp-browser-refresh:focus-visible,
.csp-browser-add:focus-visible,
.csp-browser-search:focus-visible,
.csp-project-add:focus-visible,
.csp-browser-row:focus-visible,
.csp-browser-disclosure:focus-visible,
.csp-dm-picker-agent:focus-visible,
.csp-dialog-header button:focus-visible,
.csp-search-result:focus-visible,
.csp-project-menu-item:focus-visible,
.csp-project-back:focus-visible,
.csp-project-tabs button:focus-visible,
.csp-project-conversation-row:focus-visible,
.csp-command-result button:focus-visible,
.csp-message-composer button:focus-visible,
.csp-thread-composer button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--csp-fg) 62%, transparent);
  outline-offset: 1px;
}

@media (max-width: 1100px) {
  .csp-conversation-layout.has-thread {
    grid-template-columns: minmax(0, 1fr);
  }

  .csp-thread-panel {
    position: absolute;
    z-index: 3;
    inset: 0 0 0 auto;
    width: min(92vw, 400px);
    box-shadow: -12px 0 36px rgba(17, 17, 17, 0.1);
  }
}

@media (max-width: 720px) {
  .csp-dialog {
    width: calc(100vw - 18px);
    max-height: calc(100dvh - 18px);
    border-radius: 14px;
  }

  .csp-dialog-body {
    padding: 14px;
  }

  .csp-search-dialog {
    max-height: calc(100dvh - 18px);
  }

  .csp-search-result-meta {
    display: none;
  }

  .csp-search-footer {
    justify-content: center;
  }

  .csp-browser-header {
    min-height: 144px;
    padding: 16px 12px 12px;
  }

  .csp-workspace-identity {
    padding-left: 44px;
  }

  .csp-project-view-header {
    padding-left: 64px;
    padding-right: 12px;
  }

  .csp-project-view-header p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .csp-project-toolbar {
    min-height: 108px;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 12px;
  }

  .csp-project-back {
    order: 1;
  }

  .csp-project-local-pill {
    order: 2;
  }

  .csp-project-tabs {
    order: 3;
    width: 100%;
    overflow-x: auto;
  }

  .csp-project-content {
    padding: 12px;
  }

  .csp-project-card {
    min-height: 360px;
  }

  .csp-project-conversation-row {
    grid-template-columns: 28px minmax(0, 1fr) 16px;
    padding-inline: 8px;
  }

  .csp-project-folder-row {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .csp-project-unavailable {
    display: none;
  }

  .csp-conversation-header {
    padding-right: 12px;
  }

  .csp-header-mode,
  .csp-composer-hint {
    display: none;
  }

  .csp-conversation-hero {
    padding: 62px 20px 36px;
  }

  .csp-hero-flow {
    grid-template-columns: 1fr;
  }

  .csp-hero-flow > span {
    min-height: 68px;
  }

  .csp-message-list {
    padding: 24px 12px 10px;
  }

  .csp-message-composer {
    width: calc(100% - 24px);
    margin: 0 12px 12px;
  }

  .csp-composer-tools > span:nth-child(2),
  .csp-composer-tools > span:nth-child(3) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .csp-section-chevron,
  .csp-browser-search,
  .csp-thread-root {
    transition: none;
  }
}
`
