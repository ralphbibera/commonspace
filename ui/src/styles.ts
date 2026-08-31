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

.csp-browser-destinations {
  padding: 6px 7px 2px;
}

.csp-browser-destination {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 36px;
  padding: 7px 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  text-align: left;
}

.csp-browser-destination:hover,
.csp-browser-destination[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
}

.csp-browser-destination-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 15px;
  border: 1.5px solid currentColor;
  border-top: 0;
  border-radius: 3px;
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 13px;
  line-height: 1;
}

.csp-inbox-count {
  min-width: 18px;
  margin-left: auto;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-brand, #4d6bfe);
  color: #fff;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: center;
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
.csp-channel-head,
.csp-agent-head {
  display: flex;
  align-items: center;
  gap: 2px;
}

.csp-project-head .csp-browser-row,
.csp-channel-head .csp-browser-row,
.csp-agent-head .csp-browser-row {
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

.csp-channel-context-editor,
.csp-channel-pins { display: grid; gap: 6px; padding: 7px; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 7px; background: var(--dsw-alias-bg-subtle, rgba(0, 0, 0, 0.018)); }
.csp-channel-context-editor > header,
.csp-channel-pins > header { display: flex; align-items: center; justify-content: space-between; color: var(--dsw-alias-label-secondary, #666b74); font-size: 10px; }
.csp-channel-context-editor > header span { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 8px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; }
.csp-channel-context-editor > header span[data-status='stale'],
.csp-channel-context-editor > header span[data-status='failed'] { color: var(--dsw-alias-warning, #9a6700); }
.csp-channel-context-editor > button { justify-self: start; }
.csp-channel-pins > div { display: flex; align-items: center; gap: 5px; }
.csp-channel-pins > div p { min-width: 0; flex: 1; margin: 0; overflow: hidden; color: var(--dsw-alias-label-primary, #202124); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.csp-channel-pins > div input { min-width: 0; flex: 1; }
.csp-channel-pins > div button { flex: none; }

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

.csp-browser-form label input[type='checkbox'],
.csp-browser-form label input[type='radio'] {
  width: 12px;
  height: 12px;
}

.csp-browser-form > div {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.csp-browser-form > .csp-directory-picker {
  justify-content: stretch;
}

.csp-browser-form .csp-directory-picker input {
  min-width: 0;
  flex: 1;
  width: auto;
}

.csp-directory-picker button {
  flex: none;
}

.csp-directory-picker button:disabled {
  cursor: wait;
  opacity: 0.6;
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

.csp-browser-form fieldset.csp-routing-options { grid-template-columns: 1fr; }
.csp-browser-form fieldset.csp-run-defaults { grid-template-columns: 1fr; }
.csp-routing-options button {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  text-align: left;
}
.csp-routing-options button[aria-pressed='true'] {
  border-color: var(--dsw-alias-interactive-brand, #4d6bfe);
  background: color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 10%, transparent);
}
.csp-routing-options button > span:last-child { display: flex; min-width: 0; flex-direction: column; }
.csp-routing-options button small { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 9px; }

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
.csp-message-main { min-width: 0; }
.csp-message header { display: flex; align-items: baseline; gap: 7px; }
.csp-message time { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 10px; }
.csp-message-direct-reply {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 2px 5px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.csp-message-direct-reply:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-label-primary, #202124); }
.csp-message-speech {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font: inherit;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
}
.csp-message-direct-reply + .csp-message-speech { margin-left: 0; }
.csp-message-pin {
  margin-left: auto;
  padding: 2px 5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font: inherit;
  font-size: 9px;
  cursor: pointer;
}
.csp-message-pin:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-interactive-brand, #4d6bfe); }
.csp-message-version-action { padding: 2px 4px; border: 0; border-radius: 4px; background: transparent; color: var(--dsw-alias-label-tertiary, #8a8f98); font: inherit; font-size: 9px; cursor: pointer; }
.csp-message-version-action:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-interactive-brand, #4d6bfe); }
.csp-message-version-action--delete:hover { color: var(--dsw-alias-negative, #b52f3a); }
.csp-message-version-link { display: flex; align-items: center; gap: 6px; margin-top: 3px; color: var(--dsw-alias-interactive-brand, #4d6bfe); font-size: 9px; font-weight: 700; }
.csp-message-version-link button { padding: 0; border: 0; background: transparent; color: var(--dsw-alias-label-tertiary, #8a8f98); font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.csp-message-version-link button:hover { color: var(--dsw-alias-interactive-brand, #4d6bfe); }
.csp-message-deleted { margin: 4px 0 0; padding: 6px 8px; border-left: 2px dashed var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.16)); color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 10px; font-style: italic; }
.csp-message-edit-form { display: grid; gap: 7px; margin-top: 7px; padding: 9px; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12)); border-radius: 7px; background: var(--dsw-alias-bg-subtle, rgba(0, 0, 0, 0.018)); }
.csp-message-edit-form > label { display: grid; gap: 3px; color: var(--dsw-alias-label-secondary, #666b74); font-size: 10px; font-weight: 700; }
.csp-message-edit-form textarea { min-height: 64px; padding: 6px; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14)); border-radius: 5px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #202124); font: inherit; resize: vertical; }
.csp-message-edit-form fieldset { display: flex; flex-wrap: wrap; gap: 5px 10px; margin: 0; padding: 0; border: 0; }
.csp-message-edit-form legend { margin-bottom: 3px; color: var(--dsw-alias-label-secondary, #666b74); font-size: 10px; font-weight: 700; }
.csp-message-edit-form fieldset label { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-primary, #202124); font-size: 10px; }
.csp-message-edit-form > div { display: flex; gap: 6px; }
.csp-message-edit-form button { min-height: 28px; padding: 3px 8px; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14)); border-radius: 5px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #202124); font: inherit; cursor: pointer; }
.csp-message-edit-form button[type='submit'] { border-color: var(--dsw-alias-interactive-brand, #4d6bfe); background: var(--dsw-alias-interactive-brand, #4d6bfe); color: #fff; }
.csp-message-speech:hover,
.csp-message-speech[aria-pressed='true'] { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-label-primary, #202124); }
.csp-message-speech[aria-pressed='true'] { color: var(--dsw-alias-interactive-brand, #4d6bfe); }
.csp-message-plain-text { margin: 3px 0 0; white-space: pre-wrap; font-size: 13px; line-height: 1.55; }
.csp-message-routing { margin-top: 5px; color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 10px; line-height: 1.4; }
.csp-routing-assignments { display: grid; gap: 4px; margin: 5px 0 0; padding: 0; list-style: none; }
.csp-routing-assignments li { padding-left: 7px; border-left: 2px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12)); }
.csp-routing-assignments li[data-status='superseded'] { border-left-style: dashed; opacity: 0.62; }
.csp-routing-assignments strong { color: var(--dsw-alias-label-secondary, #666b74); font-size: 10px; }
.csp-routing-assignments p { margin: 1px 0 0; color: var(--dsw-alias-label-primary, #202124); font-size: 11px; white-space: pre-wrap; }
.csp-routing-attempt-status {
  display: inline-block;
  margin-left: 6px;
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.csp-routing-reroute {
  margin: 2px 0 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.csp-routing-reroute:hover { text-decoration: underline; }
.csp-routing-reroute:focus-visible { outline: 2px solid var(--dsw-alias-interactive-brand, #4d6bfe); outline-offset: 2px; }
.csp-routing-reroute-form {
  display: grid;
  gap: 7px;
  margin: 7px 0 3px;
  padding: 9px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  border-radius: 7px;
  background: var(--dsw-alias-bg-raised, rgba(255, 255, 255, 0.72));
  opacity: 1;
}
.csp-routing-reroute-form > label { display: grid; gap: 3px; color: var(--dsw-alias-label-secondary, #666b74); font-weight: 700; }
.csp-routing-reroute-form select,
.csp-routing-reroute-form textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 5px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
}
.csp-routing-reroute-form textarea { min-height: 54px; padding: 6px; resize: vertical; }
.csp-routing-reroute-form select { min-height: 30px; padding: 4px 6px; }
.csp-routing-reroute-form fieldset { display: flex; flex-wrap: wrap; gap: 5px 10px; margin: 0; padding: 0; border: 0; }
.csp-routing-reroute-form legend { margin-bottom: 3px; color: var(--dsw-alias-label-secondary, #666b74); font-weight: 700; }
.csp-routing-reroute-form fieldset label { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-primary, #202124); }
.csp-routing-reroute-form > div { display: flex; gap: 6px; }
.csp-routing-reroute-form > div button { min-height: 28px; padding: 3px 8px; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14)); border-radius: 5px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #202124); font: inherit; cursor: pointer; }
.csp-routing-reroute-form > div button[type='submit'] { border-color: var(--dsw-alias-interactive-brand, #4d6bfe); background: var(--dsw-alias-interactive-brand, #4d6bfe); color: #fff; }
.csp-routing-reroute-form > div button:disabled { cursor: default; opacity: 0.55; }
.csp-message-attachments { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 7px; }
.csp-message-attachments figure { position: relative; margin: 0; }
.csp-message-attachments figure button { position: absolute; right: 5px; bottom: 5px; padding: 3px 6px; border: 1px solid rgba(255, 255, 255, 0.55); border-radius: 5px; background: rgba(20, 22, 28, 0.72); color: #fff; font: inherit; font-size: 9px; cursor: pointer; }
.csp-message-attachments img {
  display: block;
  width: auto;
  max-width: min(100%, 520px);
  height: auto;
  max-height: 360px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.035);
  object-fit: contain;
}
.csp-message-loading { margin: 4px 0 0; color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 12px; line-height: 1.55; }
.csp-message-content {
  min-width: 0;
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: inherit;
  font-size: 13px;
  line-height: 1.55;
}
.csp-message-content > div > :first-child { margin-top: 0; }
.csp-message-content > div > :last-child { margin-bottom: 0; }
.csp-message-content p { margin: 0 0 9px; white-space: normal; }
.csp-message-content h1,
.csp-message-content h2,
.csp-message-content h3,
.csp-message-content h4 {
  margin: 14px 0 6px;
  color: inherit;
  font-weight: 680;
  line-height: 1.3;
  letter-spacing: -0.012em;
}
.csp-message-content h1 { font-size: 17px; }
.csp-message-content h2 { font-size: 15px; }
.csp-message-content h3 { font-size: 14px; }
.csp-message-content h4 { font-size: 13px; }
.csp-message-content ul,
.csp-message-content ol { margin: 7px 0 10px; padding-left: 22px; }
.csp-message-content li { margin: 2px 0; padding-left: 1px; }
.csp-message-content li::marker { color: var(--dsw-alias-label-tertiary, #8a8f98); }
.csp-message-content blockquote {
  margin: 9px 0;
  padding-left: 11px;
  border-left: 2px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  color: var(--dsw-alias-label-secondary, #666b74);
}
.csp-message-content a { color: var(--dsw-alias-interactive-brand, #4d6bfe); text-decoration: underline; text-underline-offset: 2px; }
.csp-message-content [data-streamdown='strong'] { font-weight: 700; }
.csp-message-content del { color: var(--dsw-alias-label-secondary, #666b74); }
.csp-message-content code { border-radius: 4px; background: rgba(0, 0, 0, 0.055); padding: 1px 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; }
.csp-message-content pre { max-width: 100%; margin: 9px 0; overflow-x: auto; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 8px; background: rgba(0, 0, 0, 0.035); padding: 11px 12px; line-height: 1.5; }
.csp-message-content pre code { border-radius: 0; background: transparent; padding: 0; font-size: 12px; }
.csp-markdown-table-wrap { max-width: 100%; margin: 9px 0; overflow-x: auto; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 8px; }
.csp-markdown-image-placeholder { display: inline-flex; align-items: center; gap: 7px; margin: 5px 0; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 7px; background: rgba(0, 0, 0, 0.035); padding: 5px 7px; color: var(--dsw-alias-label-secondary, #666b74); font-size: 11px; }
.csp-markdown-image-placeholder a { font-weight: 650; }
.csp-message-content table { width: 100%; border-collapse: collapse; font-size: 12px; }
.csp-message-content th,
.csp-message-content td { padding: 6px 9px; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08)); text-align: left; vertical-align: top; }
.csp-message-content th { background: rgba(0, 0, 0, 0.035); font-weight: 650; }
.csp-message-content tr:last-child td { border-bottom: 0; }
.csp-message-content hr { margin: 12px 0; border: 0; border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); }
.csp-message-content input[type='checkbox'] { margin: 0 6px 0 0; }
.csp-message-content [data-streamdown='code-block'],
.csp-message-content [data-streamdown='table-wrapper'] { max-width: 100%; }
.csp-message-content button { color: inherit; }
.csp-trace {
  max-width: 760px;
  margin-top: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: 9px;
  background: color-mix(in srgb, var(--dsw-alias-surface-l1, #fff) 94%, #4d6bfe 6%);
  overflow: hidden;
}
.csp-trace-toggle {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 7px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 7px 9px;
  color: inherit;
  cursor: pointer;
  text-align: left;
  font: inherit;
  font-size: 11px;
}
.csp-trace-toggle:hover { background: rgba(77, 107, 254, 0.055); }
.csp-trace-toggle:focus-visible { outline: 2px solid var(--dsw-alias-interactive-brand, #4d6bfe); outline-offset: -2px; }
.csp-trace-toggle-mark { color: var(--dsw-alias-interactive-brand, #4d6bfe); font-size: 14px; font-weight: 700; }
.csp-trace-summary { color: var(--dsw-alias-label-tertiary, #8a8f98); }
.csp-trace-chevron { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 14px; transition: transform 120ms ease; }
.csp-trace.is-open .csp-trace-chevron { transform: rotate(180deg); }
.csp-trace-panel { border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.09)); }
.csp-trace-intro {
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 9px 11px 5px;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 10px;
}
.csp-trace-intro strong { color: var(--dsw-alias-label-secondary, #5f6570); font-size: 11px; }
.csp-trace-timeline { margin: 0; padding: 3px 11px 10px; list-style: none; }
.csp-trace-entry {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 6px;
  padding: 6px 0;
}
.csp-trace-entry:not(:last-child)::before {
  position: absolute;
  top: 24px;
  bottom: -6px;
  left: 8px;
  width: 1px;
  background: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  content: '';
}
.csp-trace-node {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  border-radius: 5px;
  background: var(--dsw-alias-surface-l1, #fff);
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 9px;
}
.csp-trace-entry-main { min-width: 0; }
.csp-trace-entry-main > header { display: flex; align-items: baseline; gap: 7px; min-height: 17px; }
.csp-trace-entry-main > header strong { overflow-wrap: anywhere; font-size: 11px; font-weight: 650; }
.csp-trace-entry-main > header span { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 9px; }
.csp-trace-text { margin: 3px 0 0; color: var(--dsw-alias-label-secondary, #5f6570); white-space: pre-wrap; font-size: 11px; line-height: 1.45; }
.csp-trace-plan { display: grid; gap: 3px; margin: 4px 0 0; padding: 0; list-style: none; }
.csp-trace-plan li { display: grid; grid-template-columns: 13px minmax(0, 1fr) auto; gap: 4px; align-items: baseline; color: var(--dsw-alias-label-secondary, #5f6570); font-size: 10px; }
.csp-trace-plan li small { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 9px; }
.csp-trace-plan li[data-status='completed'] > span:nth-child(2) { color: var(--dsw-alias-label-tertiary, #8a8f98); }
.csp-trace-plan-check { color: var(--dsw-alias-interactive-brand, #4d6bfe); text-align: center; }
.csp-trace-status { margin-left: auto; border-radius: 999px; padding: 1px 5px; background: rgba(0, 0, 0, 0.045); }
.csp-trace-status--completed { color: #087a59 !important; background: rgba(16, 135, 98, 0.1); }
.csp-trace-status--failed { color: #b42318 !important; background: rgba(180, 35, 24, 0.1); }
.csp-trace-status--in_progress { color: #4058d8 !important; background: rgba(77, 107, 254, 0.1); }
.csp-trace-tool-meta { display: flex; gap: 5px; align-items: center; margin-top: 3px; }
.csp-trace-tool-meta span,
.csp-trace-tool-meta code { border-radius: 4px; background: rgba(0, 0, 0, 0.05); padding: 1px 4px; color: var(--dsw-alias-label-secondary, #5f6570); font-size: 9px; }
.csp-trace-tool-meta code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.csp-trace-payload { margin-top: 5px; }
.csp-trace-payload > span { display: block; margin-bottom: 2px; color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.csp-trace-payload pre { max-height: 220px; margin: 0; overflow: auto; border-radius: 6px; background: rgba(0, 0, 0, 0.045); padding: 7px 8px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 10px; line-height: 1.4; }
.csp-trace-payload code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.csp-trace-cost { margin: 2px 0 0; color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 9px; }
.csp-run-evidence { max-width: 760px; margin-top: 8px; overflow: hidden; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 8px; background: var(--dsw-alias-surface-l1, #fff); }
.csp-run-evidence-toggle { display: grid; grid-template-columns: auto auto 1fr auto; gap: 7px; align-items: center; width: 100%; border: 0; background: transparent; padding: 8px 10px; color: var(--dsw-alias-label-secondary, #5f6570); text-align: left; font: inherit; font-size: 11px; }
.csp-run-evidence-toggle:hover { background: rgba(77, 107, 254, 0.055); }
.csp-run-evidence-toggle > span:nth-last-child(2) { color: var(--dsw-alias-label-tertiary, #8a8f98); }
.csp-run-evidence-panel { border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.09)); padding: 9px 11px; }
.csp-run-root > header { display: flex; gap: 7px; align-items: baseline; font-size: 11px; }
.csp-run-root > header span, .csp-run-preexisting, .csp-run-empty { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 10px; }
.csp-run-preexisting { display: flex; gap: 6px; margin: 6px 0; overflow-wrap: anywhere; }
.csp-run-preexisting strong { color: var(--dsw-alias-label-secondary, #5f6570); }
.csp-run-files { display: grid; gap: 5px; margin: 7px 0 0; padding: 0; list-style: none; }
.csp-run-file-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 7px; align-items: center; font-size: 10px; }
.csp-run-file-row a { overflow-wrap: anywhere; color: var(--dsw-alias-interactive-brand, #4d6bfe); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.csp-run-file-row span, .csp-run-file-row small { color: var(--dsw-alias-label-tertiary, #8a8f98); }
.csp-run-file-row button { border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); border-radius: 5px; background: transparent; padding: 2px 5px; color: var(--dsw-alias-label-secondary, #5f6570); font: inherit; font-size: 9px; }
.csp-run-patch { max-height: 260px; margin: 5px 0 0; overflow: auto; border-radius: 6px; background: rgba(0, 0, 0, 0.045); padding: 7px 8px; white-space: pre; font-size: 10px; line-height: 1.4; }
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

.csp-live-activity {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(280px, 38vh);
  margin: 0 18px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.csp-live-activity-row {
  flex: none;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: 9px;
  background: var(--dsw-alias-fill-l1, #fff);
  color: var(--dsw-alias-label-primary, #222);
  text-align: left;
  font-size: 11px;
}

.csp-live-activity-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.csp-live-activity-trigger {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

button.csp-live-activity-trigger { cursor: pointer; }
button.csp-live-activity-trigger:hover { background: rgba(77, 107, 254, 0.055); }
button.csp-live-activity-trigger:focus-visible { outline: 2px solid var(--dsw-alias-interactive-brand, #4d6bfe); outline-offset: -2px; }
.csp-live-activity-copy { min-width: 0; flex: 1; }
.csp-live-activity-heading { display: flex; align-items: baseline; gap: 6px; }
.csp-live-activity-heading > span { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 10px; }
.csp-live-activity-summary { display: block; margin-top: 3px; overflow: hidden; color: var(--dsw-alias-label-secondary, #5f6570); text-overflow: ellipsis; white-space: nowrap; }
.csp-live-activity-chevron { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 14px; transition: transform 120ms ease; }
.csp-live-activity-row.is-expanded .csp-live-activity-chevron { transform: rotate(180deg); }
.csp-live-activity-panel {
  max-height: min(164px, 24vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.09));
  background: color-mix(in srgb, var(--dsw-alias-fill-l1, #fff) 82%, var(--dsw-alias-interactive-brand, #4d6bfe));
}
.csp-live-activity-panel .csp-trace-timeline { padding-top: 6px; }
.csp-live-activity-empty { margin: 0; padding: 10px 12px; color: var(--dsw-alias-label-secondary, #5f6570); }
.csp-live-activity-stop {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 10px;
  padding: 5px 9px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-negative, #c83f49) 45%, transparent);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-negative, #b52f3a);
  cursor: pointer;
  font: inherit;
}
.csp-live-activity-stop:hover { background: color-mix(in srgb, var(--dsw-alias-negative, #c83f49) 8%, transparent); }
.csp-thread-messages .csp-live-activity { margin-right: 0; margin-left: 0; }

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
.csp-tag-hint { margin: 3px 0 6px; color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 9px; letter-spacing: 0.01em; }
.csp-tag-hint b { color: var(--dsw-alias-interactive-brand, #4d6bfe); font-weight: 750; }
.csp-composer-attachments { display: flex; flex-wrap: wrap; gap: 7px; margin: 2px 0 6px; }
.csp-composer-attachments figure {
  position: relative;
  width: 82px;
  margin: 0;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.035);
}
.csp-composer-attachments img { display: block; width: 72px; height: 58px; border-radius: 5px; object-fit: cover; }
.csp-composer-attachments figcaption { margin-top: 3px; overflow: hidden; color: var(--dsw-alias-label-secondary, #666b74); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.csp-message-composer .csp-composer-attachments button,
.csp-thread-composer .csp-composer-attachments button {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  min-width: 0;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 999px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  font-size: 13px;
  line-height: 1;
}
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
.csp-tag-suggestion-group { padding: 6px 9px 3px; border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1)); color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 10px; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; }
.csp-tag-suggestion-group:first-child { border-top: 0; }

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
  grid-template-columns: minmax(0, var(--csp-channel-width, 50fr)) 6px minmax(0, var(--csp-thread-width, 50fr));
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

.csp-thread-root--focused {
  background: color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 8%, transparent);
  box-shadow: inset 3px 0 0 var(--dsw-alias-interactive-brand, #4d6bfe);
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

.csp-thread-reply-summary,
.csp-thread-reply-agents {
  display: inline-flex;
  align-items: center;
}

.csp-thread-reply-summary { gap: 7px; }
.csp-thread-reply-agents { gap: 3px; }

.csp-thread-meta,
.csp-thread-agent-activity {
  display: inline-flex;
  align-items: center;
}

.csp-thread-meta { gap: 7px; }

.csp-thread-agent-activity {
  gap: 3px;
  padding: 2px 0;
}

.csp-thread-agent-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 35%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 10%, var(--dsw-alias-bg-base, #fff));
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
  font-size: 9px;
  font-weight: 750;
  line-height: 1;
}

.csp-thread-agent-avatar--responding {
  animation: csp-thread-agent-bop 720ms ease-in-out infinite alternate;
  animation-delay: calc(var(--csp-thread-agent-index, 0) * 90ms);
}

@keyframes csp-thread-agent-bop {
  from { transform: translateY(1px); }
  to { transform: translateY(-3px); }
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
  background: var(--dsw-alias-bg-base, #fff);
}

.csp-thread-resizer {
  position: relative;
  z-index: 1;
  width: 6px;
  cursor: col-resize;
  touch-action: none;
}

.csp-thread-resizer::after {
  position: absolute;
  inset: 0 2px;
  background: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  content: '';
  transition: background 120ms ease, inset 120ms ease;
}

.csp-thread-resizer:hover::after,
.csp-thread-resizer:focus-visible::after,
.csp-conversation-layout.is-resizing .csp-thread-resizer::after {
  inset: 0 1px;
  background: var(--dsw-alias-interactive-brand, #4d6bfe);
}

.csp-thread-resizer:focus-visible {
  outline: 2px solid var(--dsw-alias-interactive-brand, #4d6bfe);
  outline-offset: -2px;
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

.csp-thread-header .csp-thread-header-actions { flex-direction: row; align-items: center; gap: 4px; }
.csp-thread-header .csp-thread-header-actions button:first-child { width: auto; padding: 0 8px; font-size: 10px; font-weight: 700; }
.csp-thread-header .csp-thread-header-actions button[aria-pressed='true'] { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-interactive-brand, #4d6bfe); }

.csp-thread-context {
  max-height: min(58%, 520px);
  overflow: auto;
  padding: 12px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  background: var(--dsw-alias-bg-subtle, rgba(0, 0, 0, 0.018));
  font-size: 11px;
}
.csp-thread-context details { padding-left: 9px; border-left: 2px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14)); }
.csp-thread-context details summary { color: var(--dsw-alias-label-secondary, #666b74); font-weight: 700; cursor: pointer; }
.csp-thread-context details p { margin: 5px 0; color: var(--dsw-alias-label-primary, #202124); white-space: pre-wrap; }
.csp-thread-context details ul { margin: 4px 0 0; padding-left: 16px; }
.csp-thread-context form { display: grid; gap: 7px; margin-top: 11px; }
.csp-thread-context form > header { display: flex; align-items: center; justify-content: space-between; }
.csp-thread-context form > header span { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.csp-thread-context form > header span[data-status='stale'] { color: var(--dsw-alias-warning, #9a6700); }
.csp-thread-context form label { display: grid; gap: 3px; color: var(--dsw-alias-label-secondary, #666b74); font-weight: 700; }
.csp-thread-context form textarea {
  width: 100%;
  min-height: 44px;
  padding: 6px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  border-radius: 5px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  resize: vertical;
}
.csp-thread-context form > div { display: flex; gap: 6px; }
.csp-thread-context form button { min-height: 28px; padding: 3px 8px; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14)); border-radius: 5px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #202124); font: inherit; cursor: pointer; }
.csp-thread-context form button[type='submit'] { border-color: var(--dsw-alias-interactive-brand, #4d6bfe); background: var(--dsw-alias-interactive-brand, #4d6bfe); color: #fff; }
.csp-thread-context button:disabled { cursor: default; opacity: 0.55; }
.csp-thread-projects { display: flex; flex-wrap: wrap; gap: 5px 10px; margin: 12px 0 0; padding: 9px; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12)); border-radius: 6px; background: var(--dsw-alias-bg-base, #fff); }
.csp-thread-projects legend { padding: 0 3px; color: var(--dsw-alias-label-secondary, #666b74); font-weight: 700; }
.csp-thread-projects p { flex-basis: 100%; margin: 0; color: var(--dsw-alias-label-tertiary, #8a8f98); }
.csp-thread-projects label { display: inline-flex; align-items: center; gap: 4px; color: var(--dsw-alias-label-primary, #202124); font-weight: 500; }
.csp-thread-pins { display: grid; gap: 6px; margin-top: 12px; }
.csp-thread-pins > header { display: flex; align-items: center; justify-content: space-between; color: var(--dsw-alias-label-secondary, #666b74); }
.csp-thread-pins > header span { min-width: 20px; padding: 1px 5px; border-radius: 999px; background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); text-align: center; }
.csp-thread-pins > div { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 7px; padding: 6px 7px; border-left: 2px solid var(--dsw-alias-interactive-brand, #4d6bfe); background: var(--dsw-alias-bg-base, #fff); }
.csp-thread-pins > div > span { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 8px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.csp-thread-pins > div p { min-width: 0; margin: 0; overflow: hidden; color: var(--dsw-alias-label-primary, #202124); text-overflow: ellipsis; white-space: nowrap; }
.csp-thread-pins > div button { padding: 2px 4px; border: 0; background: transparent; color: var(--dsw-alias-label-tertiary, #8a8f98); font: inherit; font-size: 9px; cursor: pointer; }
.csp-thread-pins > div button:hover { color: var(--dsw-alias-negative, #b52f3a); }
.csp-thread-pins > form { display: flex; gap: 6px; margin: 0; }
.csp-thread-pins > form input { min-width: 0; flex: 1; padding: 6px; border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14)); border-radius: 5px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #202124); font: inherit; }
.csp-thread-pins > form button { min-height: 28px; padding: 3px 8px; border: 1px solid var(--dsw-alias-interactive-brand, #4d6bfe); border-radius: 5px; background: var(--dsw-alias-interactive-brand, #4d6bfe); color: #fff; font: inherit; cursor: pointer; }

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

.csp-thread-composer .csp-composer-input-wrap { display: flex; flex-direction: column; gap: 6px; }

.csp-thread-reply-target {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1px 8px;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 24%, transparent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 8%, transparent);
  color: var(--dsw-alias-label-primary, #202124);
  font-size: 11px;
}

.csp-thread-reply-target span { font-weight: 650; }
.csp-thread-reply-target small { color: var(--dsw-alias-label-tertiary, #8a8f98); font-size: 9px; }
.csp-thread-reply-target button {
  grid-row: 1 / span 2;
  grid-column: 2;
  padding: 1px 5px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 15px;
  cursor: pointer;
}
.csp-thread-reply-target button:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06)); }

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

.csp-thread-composer > button {
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

.csp-inbox {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-inbox-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  width: min(100%, 860px);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 34px 28px 22px;
}

.csp-inbox-header h1,
.csp-inbox-empty h2 {
  margin: 0;
}

.csp-inbox-header h1 {
  font-size: 28px;
  letter-spacing: -0.03em;
}

.csp-inbox-header p,
.csp-inbox-empty p {
  margin: 5px 0 0;
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 12px;
}

.csp-inbox-eyebrow {
  display: block;
  margin-bottom: 5px;
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.12em;
}

.csp-inbox-mark-read {
  flex: none;
  min-height: 32px;
  padding: 6px 11px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  border-radius: 8px;
  background: var(--dsw-alias-bg-base, #fff);
  color: var(--dsw-alias-label-primary, #202124);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
}

.csp-inbox-mark-read:disabled {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  cursor: default;
  opacity: 0.7;
}

.csp-inbox-toolbar {
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
}

.csp-inbox-filters {
  display: flex;
  gap: 4px;
  width: min(100%, 860px);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 0 28px 10px;
}

.csp-inbox-filters button {
  padding: 6px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666b74);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
}

.csp-inbox-filters button:hover,
.csp-inbox-filters button[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-inbox-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.csp-inbox-list {
  width: min(100%, 860px);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 12px 20px 36px;
  list-style: none;
}

.csp-inbox-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.08));
}

.csp-inbox-list .csp-inbox-item-open {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  width: 100%;
  min-width: 0;
  padding: 14px 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.csp-inbox-list .csp-inbox-item-open:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.045));
}

.csp-inbox-row-action,
.csp-inbox-row-actions button {
  padding: 6px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font: inherit;
  font-size: 10px;
  font-weight: 650;
  white-space: nowrap;
}

.csp-inbox-row-action:hover,
.csp-inbox-row-actions button:hover,
.csp-inbox-row-action[aria-pressed='true'],
.csp-inbox-row-actions button[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--dsw-alias-label-primary, #202124);
}

.csp-inbox-row-actions {
  display: flex;
  gap: 2px;
  padding-right: 8px;
}

.csp-inbox-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 13%, transparent);
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
  font-size: 11px;
  font-weight: 750;
}

.csp-inbox-item-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5px;
}

.csp-inbox-item-heading {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
  font-size: 11px;
}

.csp-inbox-item-heading strong {
  font-size: 12px;
}

.csp-inbox-item-heading span,
.csp-inbox-item-heading time {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
}

.csp-inbox-item-heading time {
  margin-left: auto;
  font-size: 10px;
  white-space: nowrap;
}

.csp-inbox-item-text {
  overflow: hidden;
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 12px;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csp-inbox-kind {
  align-self: flex-start;
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.csp-inbox-kind--failure,
.csp-inbox-kind--timeout,
.csp-inbox-kind--needs-attention {
  color: #b42318;
}

.csp-inbox-kind--mention,
.csp-inbox-kind--input-request {
  color: #9a6700;
}

.csp-inbox-kind--running {
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
}

.csp-inbox-unread-dot {
  flex: none;
  width: 7px;
  height: 7px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-interactive-brand, #4d6bfe);
}

.csp-inbox-empty {
  width: min(100%, 860px);
  box-sizing: border-box;
  margin: 0 auto;
  padding: min(18vh, 150px) 28px 40px;
  text-align: center;
}

.csp-inbox-empty > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--dsw-alias-interactive-brand, #4d6bfe) 10%, transparent);
  color: var(--dsw-alias-interactive-brand, #4d6bfe);
}

.csp-inbox-empty h2 {
  font-size: 16px;
}

@media (max-width: 600px) {
  .csp-inbox-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
    padding: 24px 18px 18px 64px;
  }

  .csp-inbox-filters {
    padding-right: 18px;
    padding-left: 18px;
  }

  .csp-inbox-list {
    padding-right: 9px;
    padding-left: 9px;
  }

  .csp-inbox-item-heading time {
    display: none;
  }
}

@media (max-width: 720px) {
  .csp-conversation-layout.has-thread {
    grid-template-columns: minmax(0, 1fr);
  }

  .csp-thread-panel {
    position: absolute;
    inset: 0;
    z-index: 3;
  }

  .csp-thread-resizer {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .csp-trigger-chevron,
  .csp-section-chevron,
  .csp-trace-chevron {
    transition: none;
  }

  .csp-thread-agent-avatar--responding {
    animation: none;
  }
}
`
