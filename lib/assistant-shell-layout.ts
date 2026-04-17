export const ASSISTANT_COLLAPSED_HEIGHT = 64
export const ASSISTANT_TRANSCRIPT_TRIGGER_WIDTH = 48
export const ASSISTANT_EXPANDED_MAX_WIDTH_REM = 48
export const ASSISTANT_EXPANDED_HEIGHT_MOBILE_REM = 28
export const ASSISTANT_EXPANDED_HEIGHT_DESKTOP_REM = 32

export function getAssistantExpandedHeightCss(isMobile: boolean): string {
  return isMobile
    ? `min(60vh, ${ASSISTANT_EXPANDED_HEIGHT_MOBILE_REM}rem)`
    : `min(70vh, ${ASSISTANT_EXPANDED_HEIGHT_DESKTOP_REM}rem)`
}

export function resolveAssistantExpandedHeightPx(isMobile: boolean): number {
  const vh = window.innerHeight
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const vhLimit = isMobile ? vh * 0.6 : vh * 0.7
  const remLimit = isMobile
    ? ASSISTANT_EXPANDED_HEIGHT_MOBILE_REM * rem
    : ASSISTANT_EXPANDED_HEIGHT_DESKTOP_REM * rem

  return Math.min(vhLimit, remLimit)
}
