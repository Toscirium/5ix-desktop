import { useEffect } from "react";

interface ShortcutHandlers {
  onFocusSearch: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
  onSelectGroupIndex: (index: number) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Global single-key shortcuts. Disabled entirely while focus is in a form control, so typing is never hijacked. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        handlers.onFocusSearch();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        handlers.onNavigateUp();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        handlers.onNavigateDown();
        return;
      }
      if (e.key === "t" || e.key === "T") {
        handlers.onToggleTheme();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        handlers.onRefresh();
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        handlers.onSelectGroupIndex(Number(e.key) - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
