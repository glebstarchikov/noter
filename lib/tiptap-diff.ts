import { hashUnknownContent } from '@/lib/document-hash'
import type { TiptapDocument, TiptapNode } from '@/lib/tiptap-converter'

export type TiptapDiffSegment =
  | {
      kind: 'unchanged'
      id: string
      nodes: TiptapNode[]
    }
  | {
      kind: 'change'
      id: string
      changeType: 'insert' | 'delete' | 'replace'
      baseNode: TiptapNode | null
      proposedNode: TiptapNode | null
    }

function stableNodeKey(node: TiptapNode) {
  return hashUnknownContent(node)
}

function buildLcsTable(baseKeys: string[], proposedKeys: string[]) {
  const table = Array.from({ length: baseKeys.length + 1 }, () =>
    Array.from<number>({ length: proposedKeys.length + 1 }).fill(0)
  )

  for (let baseIndex = baseKeys.length - 1; baseIndex >= 0; baseIndex -= 1) {
    for (let proposedIndex = proposedKeys.length - 1; proposedIndex >= 0; proposedIndex -= 1) {
      if (baseKeys[baseIndex] === proposedKeys[proposedIndex]) {
        table[baseIndex][proposedIndex] = table[baseIndex + 1][proposedIndex + 1] + 1
      } else {
        table[baseIndex][proposedIndex] = Math.max(
          table[baseIndex + 1][proposedIndex],
          table[baseIndex][proposedIndex + 1]
        )
      }
    }
  }

  return table
}

function createChangeId(
  changeType: 'insert' | 'delete' | 'replace',
  baseNode: TiptapNode | null,
  proposedNode: TiptapNode | null,
  index: number
) {
  return `${changeType}-${index}-${hashUnknownContent([baseNode, proposedNode])}`
}

export function createTopLevelDiff(
  baseDocument: TiptapDocument,
  proposedDocument: TiptapDocument
): TiptapDiffSegment[] {
  const baseNodes = baseDocument.content
  const proposedNodes = proposedDocument.content
  const baseKeys = baseNodes.map(stableNodeKey)
  const proposedKeys = proposedNodes.map(stableNodeKey)
  const lcsTable = buildLcsTable(baseKeys, proposedKeys)
  const segments: TiptapDiffSegment[] = []

  let baseIndex = 0
  let proposedIndex = 0
  let unchangedBuffer: TiptapNode[] = []
  let removedBuffer: TiptapNode[] = []
  let insertedBuffer: TiptapNode[] = []

  const flushUnchanged = () => {
    if (unchangedBuffer.length === 0) return
    segments.push({
      kind: 'unchanged',
      id: `same-${segments.length}-${hashUnknownContent(unchangedBuffer)}`,
      nodes: unchangedBuffer,
    })
    unchangedBuffer = []
  }

  const flushChanges = () => {
    if (removedBuffer.length === 0 && insertedBuffer.length === 0) return

    const basePosition = segments.length
    let changeIndex = 0
    const pairCount = Math.min(removedBuffer.length, insertedBuffer.length)

    for (let index = 0; index < pairCount; index += 1) {
      const baseNode = removedBuffer[index]
      const proposedNode = insertedBuffer[index]
      segments.push({
        kind: 'change',
        id: createChangeId('replace', baseNode, proposedNode, basePosition + changeIndex),
        changeType: 'replace',
        baseNode,
        proposedNode,
      })
      changeIndex += 1
    }

    for (let index = pairCount; index < removedBuffer.length; index += 1) {
      const baseNode = removedBuffer[index]
      segments.push({
        kind: 'change',
        id: createChangeId('delete', baseNode, null, basePosition + changeIndex),
        changeType: 'delete',
        baseNode,
        proposedNode: null,
      })
      changeIndex += 1
    }

    for (let index = pairCount; index < insertedBuffer.length; index += 1) {
      const proposedNode = insertedBuffer[index]
      segments.push({
        kind: 'change',
        id: createChangeId('insert', null, proposedNode, basePosition + changeIndex),
        changeType: 'insert',
        baseNode: null,
        proposedNode,
      })
      changeIndex += 1
    }

    removedBuffer = []
    insertedBuffer = []
  }

  while (baseIndex < baseNodes.length && proposedIndex < proposedNodes.length) {
    if (baseKeys[baseIndex] === proposedKeys[proposedIndex]) {
      flushChanges()
      unchangedBuffer.push(baseNodes[baseIndex])
      baseIndex += 1
      proposedIndex += 1
      continue
    }

    flushUnchanged()

    if (lcsTable[baseIndex + 1][proposedIndex] >= lcsTable[baseIndex][proposedIndex + 1]) {
      removedBuffer.push(baseNodes[baseIndex])
      baseIndex += 1
    } else {
      insertedBuffer.push(proposedNodes[proposedIndex])
      proposedIndex += 1
    }
  }

  flushUnchanged()

  while (baseIndex < baseNodes.length) {
    removedBuffer.push(baseNodes[baseIndex])
    baseIndex += 1
  }

  while (proposedIndex < proposedNodes.length) {
    insertedBuffer.push(proposedNodes[proposedIndex])
    proposedIndex += 1
  }

  flushChanges()

  if (segments.length === 0) {
    return [
      {
        kind: 'unchanged',
        id: `same-empty-${hashUnknownContent(baseNodes)}`,
        nodes: baseNodes,
      },
    ]
  }

  return segments
}
