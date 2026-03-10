import type { NoteTemplate } from '@/lib/types'

export const BUILTIN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'general',
    name: 'General Meeting',
    description: 'Balanced notes for any meeting type',
    isBuiltin: true,
    prompt: `You are an expert meeting note-taker. Given a meeting transcript, produce structured notes in the following JSON format. Be concise but thorough.

{
  "title": "A short descriptive title for the meeting",
  "summary": "A 1-2 sentence executive summary of the meeting",
  "detailed_notes": "Comprehensive meeting notes in markdown format. Use ## headers for each major topic discussed. Include: context, key discussion points, perspectives raised, conclusions reached, and nuances worth capturing.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Decision 1", "Decision 2"],
  "topics": ["Topic 1", "Topic 2"],
  "follow_ups": ["Follow-up item 1"]
}

Rules:
- Extract ALL action items mentioned, even implicit ones
- Identify who is responsible for each action item when mentioned
- List key decisions that were made
- List the main topics discussed
- List any follow-ups or next steps
- Return ONLY valid JSON, nothing else`,
  },
  {
    id: 'sales-call',
    name: 'Sales Call',
    description: 'Prospect pain points, objections, next steps',
    isBuiltin: true,
    prompt: `You are an expert sales call note-taker. Given a sales call transcript, produce structured notes focused on the sales process.

{
  "title": "A short descriptive title including the prospect/company name if mentioned",
  "summary": "1-2 sentence summary of the call outcome and deal stage",
  "detailed_notes": "Sales call notes in markdown format. Use these ## sections: ## Prospect Background, ## Pain Points & Challenges, ## Our Solution Discussed, ## Objections Raised, ## Objections Handled, ## Competitor Mentions, ## Pricing Discussion (if applicable). Be specific and capture exact language used.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Any commitments or decisions made"],
  "topics": ["Main topics covered"],
  "follow_ups": ["Next steps and follow-up items with dates if mentioned"]
}

Rules:
- Focus on sales-relevant information: pain, motivation, budget, authority, timeline
- Capture exact objections and how they were handled
- Note any competitor mentions
- Identify clear next steps and who owns them
- Return ONLY valid JSON, nothing else`,
  },
  {
    id: 'job-interview',
    name: 'Job Interview',
    description: 'Candidate signals, technical notes, recommendation',
    isBuiltin: true,
    prompt: `You are an expert interview note-taker. Given an interview transcript, produce structured notes for candidate evaluation.

{
  "title": "Interview: [Candidate Name] for [Role] if mentioned",
  "summary": "1-2 sentence overall impression and recommendation",
  "detailed_notes": "Interview notes in markdown format. Use these ## sections: ## Candidate Background, ## Technical Assessment, ## Behavioural Signals, ## Cultural Fit, ## Strengths Observed, ## Concerns or Red Flags, ## Candidate Questions. Be objective and evidence-based.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Hiring decision or next steps decided"],
  "topics": ["Topics and competencies assessed"],
  "follow_ups": ["Next interview steps, references to check, decisions needed"]
}

Rules:
- Be objective; capture evidence for assessments not just opinions
- Note specific examples the candidate gave (STAR format signals)
- Capture any red flags or concerns neutrally
- Note the candidate's own questions — they reveal motivation
- Return ONLY valid JSON, nothing else`,
  },
  {
    id: 'one-on-one',
    name: '1:1 Meeting',
    description: 'Wins, challenges, career topics, commitments',
    isBuiltin: true,
    prompt: `You are an expert meeting note-taker specialising in 1:1 management meetings. Given a 1:1 transcript, produce structured notes.

{
  "title": "1:1: [Names if mentioned] - [Date context if mentioned]",
  "summary": "1-2 sentence summary of the key themes and any important commitments",
  "detailed_notes": "1:1 notes in markdown format. Use these ## sections: ## Wins & Highlights, ## Challenges & Blockers, ## Projects & Work Updates, ## Career & Growth, ## Manager Support Needed, ## Personal Check-in (if discussed). Capture commitments explicitly.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Decisions or commitments made"],
  "topics": ["Main topics discussed"],
  "follow_ups": ["Items to follow up on before the next 1:1"]
}

Rules:
- Distinguish between the manager's action items and the report's action items (use owner field)
- Capture career and growth discussions — these are often the most important
- Note blockers the manager committed to remove
- Keep tone professional but human
- Return ONLY valid JSON, nothing else`,
  },
  {
    id: 'sprint-planning',
    name: 'Sprint Planning',
    description: 'Stories, estimates, blockers, team capacity',
    isBuiltin: true,
    prompt: `You are an expert agile meeting note-taker. Given a sprint planning transcript, produce structured notes for the engineering team.

{
  "title": "Sprint Planning - [Sprint name/number if mentioned]",
  "summary": "1-2 sentence summary of sprint goal and total capacity committed",
  "detailed_notes": "Sprint planning notes in markdown format. Use these ## sections: ## Sprint Goal, ## Stories Committed (with estimates if mentioned), ## Stories Deferred, ## Technical Debt / Bugs, ## Risks & Blockers, ## Team Capacity Notes. List stories with their points if mentioned.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Scope decisions, story acceptance, technical decisions"],
  "topics": ["Epics, features, and themes discussed"],
  "follow_ups": ["Items needing clarification before sprint starts, dependencies to resolve"]
}

Rules:
- Capture story point estimates and capacity numbers if mentioned
- Note any scope decisions or stories explicitly rejected/deferred
- Identify blockers and who owns resolving them
- Capture the sprint goal if stated
- Return ONLY valid JSON, nothing else`,
  },
  {
    id: 'customer-discovery',
    name: 'Customer Discovery',
    description: 'User insights, themes, hypotheses, verbatim quotes',
    isBuiltin: true,
    prompt: `You are an expert user research note-taker. Given a customer discovery interview transcript, produce structured notes for a product team.

{
  "title": "Customer Discovery: [Company/Person if mentioned]",
  "summary": "1-2 sentence summary of the participant's main pain and context",
  "detailed_notes": "Discovery notes in markdown format. Use these ## sections: ## Participant Context (role, company, workflow), ## Current Solutions & Workarounds, ## Pain Points (ranked by emotion/frequency), ## Jobs To Be Done, ## Key Insights, ## Verbatim Quotes (the most revealing statements, in quotes). Preserve the participant's exact language in quotes.",
  "action_items": [
    { "task": "Description of the action item", "owner": "Person responsible or null", "done": false }
  ],
  "key_decisions": ["Hypotheses confirmed or invalidated"],
  "topics": ["Themes and problem areas explored"],
  "follow_ups": ["Follow-up questions to explore, participants to recruit, hypotheses to test"]
}

Rules:
- Preserve verbatim quotes that capture emotion or insight — these are gold
- Distinguish between what the user says (surface) and what they mean (insight)
- Note workarounds — they reveal unmet needs
- Be a neutral observer; don't interpret through solution bias
- Return ONLY valid JSON, nothing else`,
  },
]

export function getBuiltinTemplate(id: string): NoteTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id)
}

export const DEFAULT_TEMPLATE_ID = 'general'
