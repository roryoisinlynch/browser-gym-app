// Capture beforeinstallprompt as early as possible — before React mounts.
// The event fires very early in the page lifecycle and is missed if we only
// listen inside a useEffect.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let _captured: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  _captured = e as BeforeInstallPromptEvent;
});

export function getCapturedInstallPrompt(): BeforeInstallPromptEvent | null {
  return _captured;
}

export function clearCapturedInstallPrompt(): void {
  _captured = null;
}
