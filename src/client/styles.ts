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

@media (prefers-reduced-motion: reduce) {
  .csp-trigger-chevron,
  .csp-section-chevron {
    transition: none;
  }
}
`
