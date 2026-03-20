import { useState, useRef, useCallback, useEffect } from "react";
import { WidgetRuntime } from "./core";

// ============================================================
// <Speak> component
// ============================================================
export interface SpeakProps {
  /** Text to read. If omitted, reads the text content of children. */
  text?: string;
  /** BCP 47 language tag sent to host TTS. Default: "vi-VN" */
  lang?: string;
  /** Optional speech rate hint sent to host TTS. */
  rate?: number;
  /** Timeout for host response in ms. Default: 25000 */
  timeoutMs?: number;
  /**
   * Icon visibility behavior:
   * - "auto": always show on touch devices, hover on desktop (default)
   * - "always": always visible
   * - "hover": visible on hover/focus only
   */
  showIcon?: "auto" | "always" | "hover";
  /** Icon size in px. Default: 16 */
  iconSize?: number;
  children: React.ReactNode;
}

const btnBase: React.CSSProperties = {
  position: "absolute",
  top: "-2px",
  right: "-24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  padding: 0,
  transition: "opacity 150ms, transform 150ms, background 150ms",
  zIndex: 10,
  background: "rgba(99,102,241,0.12)",
  color: "#6366f1",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

function SpeakerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function StopIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export function Speak({
  text,
  lang = "vi-VN",
  rate = 0.9,
  timeoutMs = 25000,
  showIcon = "auto",
  iconSize = 16,
  children,
}: SpeakProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const mountedRef = useRef(true);

  // Keep state updates safe if the component unmounts during async flow.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouchLikeDevice(media.matches);

    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (speaking) {
        WidgetRuntime.stopTts();
        setSpeaking(false);
        return;
      }

      const content = text ?? containerRef.current?.textContent?.trim() ?? "";
      if (!content) return;

      setSpeaking(true);

      WidgetRuntime.requestTtsSpeak({
        text: content,
        lang,
        rate,
        timeoutMs,
      })
        .catch((err) => {
          if (err instanceof Error && err.message === "TTS stopped") {
            return;
          }
          console.error("❌ Host TTS failed:", err);
        })
        .finally(() => {
          if (mountedRef.current) setSpeaking(false);
        });
    },
    [text, lang, rate, timeoutMs, speaking],
  );

  const alwaysVisible =
    showIcon === "always" || (showIcon === "auto" && isTouchLikeDevice);
  const showBtn = alwaysVisible || hovered || focused || speaking;

  return (
    <span
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        const nextFocus = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(nextFocus)) {
          setFocused(false);
        }
      }}
      style={{ position: "relative", display: "inline" }}
    >
      {children}
      <button
        onClick={handleClick}
        aria-label={speaking ? "Dừng đọc" : "Đọc"}
        style={{
          ...btnBase,
          opacity: showBtn ? 1 : 0,
          pointerEvents: showBtn ? "auto" : "none",
          transform: showBtn ? "scale(1)" : "scale(0.7)",
          background: speaking
            ? "rgba(239,68,68,0.15)"
            : "rgba(99,102,241,0.12)",
          color: speaking ? "#ef4444" : "#6366f1",
        }}
      >
        {speaking ? (
          <StopIcon size={iconSize - 4} />
        ) : (
          <SpeakerIcon size={iconSize} />
        )}
      </button>
    </span>
  );
}
