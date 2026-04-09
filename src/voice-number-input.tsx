import { useCallback, useEffect, useState } from "react";
import { WidgetRuntime } from "./core";

export interface VoiceNumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "value" | "onChange"
> {
  value: string;
  onValueChange: (value: string) => void;
  lang?: string;
  timeoutMs?: number;
  allowNegative?: boolean;
  showMic?: "auto" | "always" | "hover";
  micButtonLabel?: string;
  stopButtonLabel?: string;
  onVoiceError?: (error: Error) => void;
}

const inputBase: React.CSSProperties = {
  width: "100%",
  paddingRight: "44px",
};

const micButtonBase: React.CSSProperties = {
  position: "absolute",
  right: "8px",
  top: "50%",
  transform: "translateY(-50%)",
  width: "30px",
  height: "30px",
  borderRadius: "999px",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 150ms, transform 150ms, background 150ms",
  background: "rgba(244,63,94,0.14)",
  color: "#e11d48",
};

function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function cleanNumericText(input: string, allowNegative: boolean): string {
  if (!allowNegative) {
    return input.replace(/[^0-9]/g, "");
  }

  const normalized = input.replace(/[^0-9-]/g, "");
  if (!normalized.includes("-")) return normalized;

  const hasLeadingMinus = normalized.startsWith("-");
  const digitsOnly = normalized.replace(/-/g, "");
  return hasLeadingMinus ? `-${digitsOnly}` : digitsOnly;
}

export function VoiceNumberInput({
  value,
  onValueChange,
  lang = "vi-VN",
  timeoutMs = 10000,
  allowNegative = false,
  showMic = "auto",
  micButtonLabel = "Voice answer",
  stopButtonLabel = "Stop listening",
  onVoiceError,
  style,
  onFocus,
  onBlur,
  disabled,
  ...inputProps
}: VoiceNumberInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false);

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

  useEffect(() => {
    return () => {
      if (isListening) {
        WidgetRuntime.stopStt();
      }
    };
  }, [isListening]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = cleanNumericText(event.target.value, allowNegative);
      onValueChange(cleaned);
    },
    [allowNegative, onValueChange],
  );

  const handleMicClick = useCallback(() => {
    if (disabled) return;

    if (isListening) {
      WidgetRuntime.stopStt();
      setIsListening(false);
      return;
    }

    setIsListening(true);

    WidgetRuntime.requestSpokenNumber({
      lang,
      timeoutMs,
    })
      .then((spokenValue) => {
        const cleaned = cleanNumericText(spokenValue, allowNegative);
        if (!cleaned) {
          throw new Error("No numeric value recognized");
        }
        onValueChange(cleaned);
      })
      .catch((error) => {
        if (error instanceof Error && error.message === "STT stopped") {
          return;
        }

        if (onVoiceError) {
          onVoiceError(error as Error);
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : String(error || "Unknown voice error");

        const expectedFailures = [
          "No number recognized from speech",
          "No speech recognized.",
          "Speech timeout. Please try again.",
          "Speech session ended before transcript was captured.",
          "Speech recognition aborted.",
        ];

        if (expectedFailures.includes(message)) {
          return;
        }

        console.error("VoiceNumberInput error:", error);
      })
      .finally(() => {
        setIsListening(false);
      });
  }, [
    allowNegative,
    disabled,
    isListening,
    lang,
    onValueChange,
    onVoiceError,
    timeoutMs,
  ]);

  const alwaysVisible =
    showMic === "always" || (showMic === "auto" && isTouchLikeDevice);
  const showButton = alwaysVisible || hovered || focused || isListening;

  return (
    <div
      style={{ position: "relative", width: "100%" }}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <input
        {...inputProps}
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={handleInputChange}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={{ ...inputBase, ...style }}
      />

      <button
        type="button"
        onClick={handleMicClick}
        disabled={disabled}
        aria-label={isListening ? stopButtonLabel : micButtonLabel}
        title={isListening ? stopButtonLabel : micButtonLabel}
        style={{
          ...micButtonBase,
          opacity: showButton ? 1 : 0,
          pointerEvents: showButton ? "auto" : "none",
          background: isListening
            ? "rgba(220,38,38,0.18)"
            : "rgba(244,63,94,0.14)",
          color: isListening ? "#b91c1c" : "#e11d48",
        }}
      >
        {isListening ? <StopIcon /> : <MicIcon />}
      </button>
    </div>
  );
}
