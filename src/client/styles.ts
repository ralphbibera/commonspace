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

.csp-section-button {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
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
  padding: 6px 8px;
  border-left: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  color: var(--dsw-alias-label-secondary, #666b74);
  font-size: 12px;
  line-height: 18px;
}

.csp-channel-preview {
  display: flex;
  align-items: center;
  gap: 6px;
}

.csp-channel-hash {
  color: var(--dsw-alias-label-tertiary, #8a8f98);
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .csp-trigger-chevron,
  .csp-section-chevron {
    transition: none;
  }
}
`
