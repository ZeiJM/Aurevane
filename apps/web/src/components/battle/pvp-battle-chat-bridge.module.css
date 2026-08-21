.panel {
  position: fixed;
  right: clamp(0.5rem, 1.5vw, 1rem);
  bottom: max(4.2rem, calc(env(safe-area-inset-bottom) + 3.6rem));
  z-index: 8500;
  display: none;
  width: min(25rem, calc(100vw - 1rem));
  height: min(31rem, calc(100dvh - 7rem));
  overflow: hidden;
  border: 1px solid rgba(207, 169, 93, 0.45);
  border-radius: 0.7rem;
  background: #070a0f;
  box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.65);
}

.panel[data-open] {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.panelTop {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid rgba(207, 169, 93, 0.18);
  background: rgba(255, 255, 255, 0.025);
}

.panelTop strong {
  color: var(--av-brass-300);
  font: 800 0.53rem/1 var(--av-font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.panelTop button {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 1px solid var(--av-border);
  border-radius: 50%;
  color: var(--av-text);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
}

.triggerBadge {
  display: inline-flex;
  min-width: max-content;
  margin-left: 0.3rem;
  padding: 0.18rem 0.32rem;
  border: 1px solid rgba(95, 188, 133, 0.28);
  border-radius: 999px;
  color: var(--av-verdant-400);
  background: rgba(55, 126, 82, 0.11);
  font: 800 0.42rem/1 var(--av-font-mono);
  vertical-align: middle;
}

@media (max-width: 620px) {
  .panel {
    right: 0.35rem;
    bottom: max(3.8rem, calc(env(safe-area-inset-bottom) + 3.2rem));
    width: calc(100vw - 0.7rem);
    height: min(27rem, calc(100dvh - 5.5rem));
  }
}
