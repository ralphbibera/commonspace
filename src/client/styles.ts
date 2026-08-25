export const commonspaceStyles = String.raw`
.csp-launcher {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.csp-trigger {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  height: 38px;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  cursor: pointer;
}

.csp-trigger:hover,
.csp-trigger[aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
}

.csp-trigger:disabled {
  cursor: default;
  opacity: 0.72;
}

.csp-trigger--rail {
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
}

.csp-mark {
  display: inline-grid;
  grid-template-columns: repeat(2, 5px);
  grid-template-rows: repeat(2, 5px);
  gap: 2px;
  flex: none;
  width: 12px;
  height: 12px;
  transform: rotate(45deg);
}

.csp-mark > span {
  display: block;
  border-radius: 1.5px;
  background: currentColor;
}

.csp-trigger-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 550;
}

.csp-trigger-chevron,
.csp-section-chevron {
  flex: none;
  transition: transform 150ms ease;
}

.csp-trigger-chevron--open,
.csp-section-chevron--open {
  transform: rotate(180deg);
}

.csp-inline {
  width: 100%;
  max-height: min(430px, calc(100vh - 300px));
  overflow-y: auto;
  box-sizing: border-box;
  margin: 0 0 4px;
  padding: 5px 2px 7px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  color: var(--dsw-alias-label-primary, #202124);
  font-family: inherit;
}

.csp-sections {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.csp-section-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.csp-section-button {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  min-width: 0;
  min-height: 34px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.csp-section-button:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
}

.csp-add-button,
.csp-remove-button,
.csp-composer-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666b74);
  font: inherit;
  cursor: pointer;
}

.csp-add-button {
  width: 28px;
  height: 28px;
  font-size: 18px;
  line-height: 1;
}

.csp-add-button:hover,
.csp-remove-button:hover,
.csp-composer-action:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-section-label {
  flex: 1;
}

.csp-section-count {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 11px;
  font-weight: 500;
}

.csp-section-content {
  margin: 0 4px 5px 25px;
  padding: 3px 4px 5px 8px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 12px;
  line-height: 18px;
}

.csp-empty {
  padding: 4px 5px;
}

.csp-item-row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 2px;
}

.csp-item-button {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  min-height: 28px;
  padding: 4px 6px;
  overflow: hidden;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666b74);
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.csp-item-button:hover,
.csp-item-button[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-item-button[aria-pressed='true'] {
  font-weight: 600;
}

.csp-item-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.csp-item-prefix,
.csp-composer-prefix {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-weight: 700;
}

.csp-project-dot,
.csp-presence-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.csp-project-dot {
  border-radius: 2px;
  background: var(--dsw-alias-interactive-brand, #4d6bfe);
}

.csp-presence-dot {
  background: #24a148;
  box-shadow: 0 0 0 1px var(--dsw-specific-sidebar-fill, #f8f9fb);
}

.csp-item-pending {
  margin-left: auto;
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
  font-weight: 700;
}

.csp-remove-button {
  width: 26px;
  height: 26px;
  opacity: 0;
  font-size: 15px;
}

.csp-item-row:hover .csp-remove-button,
.csp-item-row:focus-within .csp-remove-button {
  opacity: 1;
}

.csp-composer {
  display: flex;
  align-items: flex-start;
  gap: 3px;
  min-height: 30px;
  padding: 2px 0;
}

.csp-composer-fields {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.csp-composer-name-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.csp-composer-prefix {
  padding-left: 5px;
}

.csp-composer-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  box-sizing: border-box;
  padding: 4px 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 7px;
  outline: none;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  font-size: 12px;
}

.csp-composer-input:focus {
  border-color: var(--dsw-alias-interactive-brand, #4d6bfe);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 14%, transparent);
}

.csp-composer-select {
  width: 100%;
  height: 27px;
  box-sizing: border-box;
  padding: 3px 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 7px;
  outline: none;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-secondary, #666b74);
  font: inherit;
  font-size: 11px;
}

.csp-workspace-empty {
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(197, 48, 48, 0.08);
  color: #b42318;
  font-size: 11px;
  line-height: 15px;
}

.csp-composer-action {
  width: 26px;
  height: 26px;
  font-size: 13px;
}

.csp-composer-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.csp-runtime-error {
  margin: 5px 5px 1px;
  padding: 7px 8px;
  border-radius: 7px;
  background: rgba(197, 48, 48, 0.08);
  color: #b42318;
  font-size: 11px;
  line-height: 15px;
}

.csp-switch {
  width: 100%;
}

.csp-folder-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 14px;
  height: 14px;
  font-size: 17px;
}

.csp-switch-arrow {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 12px;
}

.csp-browser {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-browser-rail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 4px auto;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: inherit;
}

.csp-browser-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 9px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
}

.csp-browser-header > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.csp-browser-header strong {
  font-size: 14px;
}

.csp-browser-header span {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 11px;
}

.csp-browser-refresh,
.csp-browser-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666b74);
  font: inherit;
  cursor: pointer;
}

.csp-browser-refresh:hover,
.csp-browser-add:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-browser-status,
.csp-browser-empty {
  padding: 7px 10px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 11px;
  line-height: 16px;
}

.csp-browser-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 6px 4px 14px;
}

.csp-browser-section {
  margin: 2px 0 5px;
}

.csp-browser-section-head {
  display: flex;
  align-items: center;
}

.csp-browser-disclosure {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 32px;
  flex: 1;
  padding: 5px 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}

.csp-browser-disclosure:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
}

.csp-browser-count {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 10px;
  font-weight: 500;
}

.csp-browser-section-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 12px;
}

.csp-browser-row {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 34px;
  padding: 5px 8px;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666b74);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.csp-browser-row:hover,
.csp-browser-row[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-browser-row-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.csp-browser-row-main strong,
.csp-browser-row-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-browser-row-main small {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 10px;
}

.csp-project-group {
  min-width: 0;
}

.csp-project-head,
.csp-channel-head {
  display: flex;
  align-items: center;
  gap: 2px;
}

.csp-project-head .csp-browser-row,
.csp-channel-head .csp-browser-row {
  flex: 1;
  width: auto;
}

.csp-project-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 27px;
  height: 27px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666b74);
  font: inherit;
  font-size: 16px;
  cursor: pointer;
}

.csp-project-add:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
}

.csp-project-workspaces {
  margin: 1px 4px 5px 22px;
  padding-left: 8px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
}

.csp-workspace-row {
  display: grid;
  grid-template-columns: 13px minmax(0, 1fr);
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 3px 5px;
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 11px;
}

.csp-workspace-row > span:nth-child(2),
.csp-workspace-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-workspace-row small {
  grid-column: 2;
  margin-top: -4px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 9px;
}

.csp-path-form {
  margin: 3px 0 1px;
}

.csp-channel-members {
  margin: 3px 4px 6px 22px;
}

.csp-browser-hash {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-weight: 700;
}

.csp-agent-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9aa0aa;
}

.csp-agent-dot--running { background: #24a148; }
.csp-agent-dot--stopped { background: #f59e0b; }

.csp-browser-form {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 2px 4px 7px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  border-radius: 9px;
  background: var(--dsw-alias-bg-base, #fff);
}

.csp-browser-form input,
.csp-browser-form select,
.csp-browser-form textarea {
  width: 100%;
  height: 29px;
  box-sizing: border-box;
  padding: 4px 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 7px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  font-size: 11px;
}

.csp-browser-form textarea {
  min-height: 64px;
  height: auto;
  resize: vertical;
}

.csp-context-label {
  display: flex !important;
  align-items: stretch !important;
  flex-direction: column;
  gap: 3px !important;
}

.csp-memory-preview {
  padding: 5px 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: 7px;
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 10px;
}

.csp-memory-preview summary {
  cursor: pointer;
  font-weight: 600;
}

.csp-memory-preview pre {
  max-height: 140px;
  margin: 6px 0;
  overflow: auto;
  white-space: pre-wrap;
  font: inherit;
}

.csp-memory-preview p {
  margin: 4px 0;
}

.csp-browser-form fieldset {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  margin: 0;
  padding: 5px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: 7px;
}

.csp-browser-form legend,
.csp-browser-form label {
  font-size: 10px;
}

.csp-browser-form label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.csp-browser-form label input {
  width: 12px;
  height: 12px;
}

.csp-browser-form > div {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.csp-browser-form button,
.csp-message-composer button {
  padding: 5px 9px;
  border: 0;
  border-radius: 7px;
  background: var(--dsw-alias-interactive-brand, #4d6bfe);
  color: white;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.csp-conversation {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-conversation-header {
  display: flex;
  align-items: center;
  min-height: 58px;
  padding: 8px 18px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
}

.csp-conversation-header h1,
.csp-conversation-header p {
  margin: 0;
}

.csp-conversation-header h1 { font-size: 15px; }
.csp-conversation-header p { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 11px; }

.csp-conversation-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 32px;
  text-align: center;
}

.csp-mark--large {
  grid-template-columns: repeat(2, 8px);
  grid-template-rows: repeat(2, 8px);
  width: 18px;
  height: 18px;
  margin-bottom: 18px;
}

.csp-conversation-hero h2 { margin: 0 0 7px; font-size: 19px; }
.csp-conversation-hero p { margin: 0; color: var(--dsw-alias-label-secondary, #666b74); font-size: 13px; }

.csp-message-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px 12px;
}

.csp-message {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 9px;
  margin: 0 0 17px;
}

.csp-message-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #252b37;
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.csp-message--agent .csp-message-avatar { background: var(--dsw-alias-interactive-brand, #4d6bfe); }
.csp-message header { display: flex; align-items: baseline; gap: 7px; }
.csp-message time { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 10px; }
.csp-message p { margin: 3px 0 0; white-space: pre-wrap; font-size: 13px; line-height: 1.55; }
.csp-tag { padding: 1px 4px; border-radius: 4px; font: inherit; font-weight: 600; }
.csp-tag--agent { background: rgba(77, 107, 254, 0.14); color: #4058d8; }
.csp-tag--project { background: rgba(137, 87, 229, 0.14); color: #7547bd; }
.csp-tag--channel { background: rgba(16, 135, 98, 0.14); color: #087a59; }

.csp-conversation-empty,
.csp-agent-working {
  padding: 12px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  text-align: center;
  font-size: 12px;
}

.csp-message-composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 0 18px 16px;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 12px;
}

.csp-message-composer textarea {
  min-height: 38px;
  max-height: 160px;
  flex: 1;
  resize: vertical;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
}

.csp-composer-input-wrap { position: relative; flex: 1; min-width: 0; }
.csp-tag-suggestions {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: calc(100% + 8px);
  left: 0;
  display: grid;
  gap: 2px;
  padding: 5px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 9px;
  background: var(--dsw-alias-fill-l1, #fff);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}
.csp-tag-suggestions button { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 0; border-radius: 6px; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.csp-tag-suggestions button.is-selected, .csp-tag-suggestions button:hover { background: rgba(77, 107, 254, 0.1); }
.csp-tag-suggestions button strong { min-width: 85px; font-size: 12px; }
.csp-tag-suggestions button span { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 11px; }

.csp-message-composer button:disabled { opacity: 0.45; cursor: not-allowed; }

.csp-conversation-error {
  margin: 0 18px 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(197, 48, 48, 0.08);
  color: #b42318;
  font-size: 11px;
}

.csp-conversation-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.csp-conversation-layout.has-thread {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 38%);
}

.csp-channel-feed {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.csp-thread-root {
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
}

.csp-thread-open {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: calc(100% - 76px);
  margin: -6px 20px 10px 56px;
  padding: 5px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.csp-thread-open:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
}

.csp-thread-status {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 10px;
}

.csp-thread-status--running,
.csp-thread-status--queued {
  color: #b45309;
}

.csp-thread-status--error {
  color: #b42318;
}

.csp-thread-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  background: var(--dsw-alias-bg-base, #fff);
}

.csp-thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 0 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
}

.csp-thread-header > div {
  display: flex;
  flex-direction: column;
}

.csp-thread-header span {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 10px;
}

.csp-thread-header button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 18px;
  cursor: pointer;
}

.csp-thread-header button:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
}

.csp-thread-messages {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.csp-thread-divider {
  margin: 4px 14px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.csp-message--compact {
  padding-top: 8px;
  padding-bottom: 8px;
}

.csp-thread-composer {
  display: flex;
  gap: 7px;
  padding: 10px 12px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
}

.csp-thread-composer textarea {
  flex: 1;
  min-width: 0;
  min-height: 38px;
  max-height: 100px;
  resize: vertical;
  box-sizing: border-box;
  padding: 8px 9px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 8px;
  outline: none;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  font-size: 12px;
}

.csp-thread-composer button {
  align-self: flex-end;
  padding: 7px 10px;
  border: 0;
  border-radius: 8px;
  background: var(--dsw-alias-interactive-brand, #4d6bfe);
  color: #fff;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .csp-conversation-layout.has-thread {
    grid-template-columns: minmax(0, 1fr);
  }

  .csp-thread-panel {
    position: absolute;
    inset: 0;
    z-index: 3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .csp-trigger-chevron,
  .csp-section-chevron {
    transition: none;
  }
}
`
