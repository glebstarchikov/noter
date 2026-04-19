import { describe, test, expect } from 'bun:test'
import { buildDraftProposalPrompt } from '@/lib/notes/prompts'
import type { ResolvedNoteTemplate } from '@/lib/note-template'

const template: ResolvedNoteTemplate = {
  id: 'default',
  name: 'General Meeting',
  prompt: 'A general-purpose meeting template.',
}

const baseArgs = {
  template,
  structuredContext: 'summary: x',
  transcript: 'full transcript',
}

describe('buildDraftProposalPrompt — enhance mode', () => {
  test('sparse draft gets expand instructions', () => {
    const shortDraft = 'Just a few words here.'
    const prompt = buildDraftProposalPrompt({
      mode: 'enhance',
      currentDocumentText: shortDraft,
      ...baseArgs,
    })

    expect(prompt).toContain('Mode: Enhance — sparse draft')
    expect(prompt).toContain('Expand it significantly')
    expect(prompt).not.toContain('Mode: Enhance — substantial draft')
  })

  test('substantial draft gets preserve-and-polish instructions', () => {
    const longDraft = Array.from({ length: 200 }, () => 'word').join(' ')
    const prompt = buildDraftProposalPrompt({
      mode: 'enhance',
      currentDocumentText: longDraft,
      ...baseArgs,
    })

    expect(prompt).toContain('Mode: Enhance — substantial draft')
    expect(prompt).toContain('Preserve every user-written sentence verbatim')
    expect(prompt).toContain('A response that looks almost identical to the input is a correct response')
    expect(prompt).not.toContain('Mode: Enhance — sparse draft')
  })

  test('empty draft classifies as sparse, not substantial', () => {
    const prompt = buildDraftProposalPrompt({
      mode: 'enhance',
      currentDocumentText: '',
      ...baseArgs,
    })

    expect(prompt).toContain('Mode: Enhance — sparse draft')
  })

  test('generate mode ignores draft length and always instructs full generation', () => {
    const longDraft = Array.from({ length: 200 }, () => 'word').join(' ')
    const prompt = buildDraftProposalPrompt({
      mode: 'generate',
      currentDocumentText: longDraft,
      ...baseArgs,
    })

    expect(prompt).toContain('Mode: Generate')
    expect(prompt).not.toContain('Mode: Enhance')
  })
})
