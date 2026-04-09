import { useEffect, useState } from "react";
import "./PWAInstallPrompt.css";

type Platform = "android" | "ios" | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}


function detectPlatform(): Platform {
  if (window.innerWidth >= 1024) return null;
  if (window.matchMedia("(display-mode: standalone)").matches) return null;
  if ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone) return null;

  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) return "ios";

  return null; // android/chrome handled via beforeinstallprompt event
}

export default function PWAInstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {

    const detected = detectPlatform();
    if (detected === "ios") {
      setPlatform("ios");
      setVisible(true);
      return;
    }

    if (window.innerWidth >= 1024) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  function dismiss() {
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    } else {
      dismiss();
    }
    setDeferredPrompt(null);
  }

  if (!visible) return null;

  const iconUrl = `${import.meta.env.BASE_URL}icons/icon-192.png`;

  return (
    <div className="pwa-prompt" role="dialog" aria-label="Install app">
      <div className="pwa-prompt__inner">
        <div className="pwa-prompt__top">
          <img src={iconUrl} alt="" className="pwa-prompt__icon" aria-hidden="true" />
          <div className="pwa-prompt__text">
            <span className="pwa-prompt__title">Add to Home Screen</span>
            <span className="pwa-prompt__body">
              {platform === "ios"
                ? <>Tap the share icon <ShareIcon /> then <strong>Add to Home Screen</strong></>
                : "Install Training Log for quick access — no browser bar, full screen."}
            </span>
          </div>
          <button
            type="button"
            className="pwa-prompt__dismiss-btn"
            onClick={dismiss}
            aria-label="Dismiss"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M18 6 6 18M6 6l12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {platform === "android" && (
          <button
            type="button"
            className="pwa-prompt__install-btn"
            onClick={handleInstall}
          >
            Install app
          </button>
        )}
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      className="pwa-prompt__share-icon"
      aria-hidden="true"
    >
      <path
        d="M8.59 13.51 15.42 17M15.41 7 8.59 10.49M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
