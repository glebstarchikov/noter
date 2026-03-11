export const ENHANCEMENT_INVALID_PROPOSAL_MESSAGE =
  'Drafting hit a safety check. Try again.'
export const ENHANCEMENT_MODEL_FAILED_MESSAGE =
  'Drafting couldn’t finish. Try again.'
export const ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE =
  'No useful edits to suggest right now.'

export function isNeutralEnhancementMessage(value: string | null | undefined) {
  return value === ENHANCEMENT_NO_USEFUL_CHANGES_MESSAGE
}
