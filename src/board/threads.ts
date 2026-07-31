import { nanoid } from 'nanoid'
import { DefaultThreadStoreAuth, ThreadStore } from '@blocknote/core/comments'
import type { CommentBody, CommentData, ThreadData } from '@blocknote/core/comments'
import { pageDoc } from './page'

const THREADS = 'threads'

// Threads live in the page's own document rather than in a table. Every mark a comment attaches
// to is already in there, so the two cannot drift apart, and they are carried by the storage and
// the sharing the page already has.
//
// What that costs: the server cannot read a comment, so "the comments waiting on me" across a
// workspace is not a question this can answer. That inbox is the reason to move them to rows,
// and the shape below is the shape a table would have.
type StoredComment = Omit<CommentData, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

type StoredThread = Omit<ThreadData, 'createdAt' | 'updatedAt' | 'comments' | 'resolvedUpdatedAt' | 'deletedAt'> & {
  createdAt: number
  updatedAt: number
  comments: StoredComment[]
  resolvedUpdatedAt?: number
  deletedAt?: number
}

// Dates cross into the document as numbers. A Date put into a Y.Map comes back as one anyway,
// and a comment written by one machine is read by another.
const outComment = (c: StoredComment): CommentData => {
  const { deletedAt, ...rest } = c
  return {
    ...rest,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
    ...(deletedAt ? { deletedAt: new Date(deletedAt), body: undefined } : {}),
  } as CommentData
}

const out = (t: StoredThread): ThreadData => {
  const { resolvedUpdatedAt, deletedAt, ...rest } = t
  return {
    ...rest,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
    comments: (t.comments ?? []).map(outComment),
    ...(resolvedUpdatedAt ? { resolvedUpdatedAt: new Date(resolvedUpdatedAt) } : {}),
    ...(deletedAt ? { deletedAt: new Date(deletedAt) } : {}),
  }
}

export class PageThreadStore extends ThreadStore {
  private readonly userId: string
  // Undefined rather than a method: the base class uses its presence to decide whether to place
  // the mark itself, and letting the editor do it is what we want.
  addThreadToDocument = undefined

  constructor(userId: string, role: 'comment' | 'editor' = 'editor') {
    super(new DefaultThreadStoreAuth(userId, role))
    this.userId = userId
  }

  private map() {
    return pageDoc().getMap<StoredThread>(THREADS)
  }

  private write(id: string, change: (was: StoredThread) => StoredThread) {
    const held = this.map().get(id)
    if (!held) throw new Error('No such thread')
    this.map().set(id, { ...change(held), updatedAt: Date.now() })
  }

  private comment(body: CommentBody, metadata?: unknown): StoredComment {
    const now = Date.now()
    return {
      type: 'comment',
      id: nanoid(12),
      userId: this.userId,
      createdAt: now,
      updatedAt: now,
      reactions: [],
      metadata,
      body,
    } as StoredComment
  }

  async createThread(options: { initialComment: { body: CommentBody; metadata?: unknown }; metadata?: unknown }) {
    const now = Date.now()
    const thread: StoredThread = {
      type: 'thread',
      id: nanoid(12),
      createdAt: now,
      updatedAt: now,
      comments: [this.comment(options.initialComment.body, options.initialComment.metadata)],
      resolved: false,
      metadata: options.metadata,
    }
    this.map().set(thread.id, thread)
    return out(thread)
  }

  async addComment(options: { comment: { body: CommentBody; metadata?: unknown }; threadId: string }) {
    const made = this.comment(options.comment.body, options.comment.metadata)
    this.write(options.threadId, (was) => ({ ...was, comments: [...was.comments, made] }))
    return outComment(made)
  }

  async updateComment(options: { comment: { body: CommentBody; metadata?: unknown }; threadId: string; commentId: string }) {
    this.write(options.threadId, (was) => ({
      ...was,
      comments: was.comments.map((c) => (c.id === options.commentId
        ? { ...c, body: options.comment.body, metadata: options.comment.metadata, updatedAt: Date.now() }
        : c)),
    }))
  }

  // Soft: a reply that answers a question nobody can see any more is a reply to nothing, so the
  // comment stays in place and says it was withdrawn.
  async deleteComment(options: { threadId: string; commentId: string }) {
    this.write(options.threadId, (was) => ({
      ...was,
      comments: was.comments.map((c) => (c.id === options.commentId
        ? { ...c, deletedAt: Date.now(), body: undefined }
        : c)),
    }))
  }

  async deleteThread(options: { threadId: string }) {
    this.map().delete(options.threadId)
  }

  async resolveThread(options: { threadId: string }) {
    this.write(options.threadId, (was) => ({
      ...was,
      resolved: true,
      resolvedUpdatedAt: Date.now(),
      resolvedBy: this.userId,
    }))
  }

  async unresolveThread(options: { threadId: string }) {
    this.write(options.threadId, (was) => ({ ...was, resolved: false, resolvedUpdatedAt: Date.now() }))
  }

  async addReaction(options: { threadId: string; commentId: string; emoji: string }) {
    this.write(options.threadId, (was) => ({
      ...was,
      comments: was.comments.map((c) => {
        if (c.id !== options.commentId) return c
        const held = c.reactions.find((r) => r.emoji === options.emoji)
        if (held?.userIds.includes(this.userId)) return c
        return {
          ...c,
          reactions: held
            ? c.reactions.map((r) => (r.emoji === options.emoji
              ? { ...r, userIds: [...r.userIds, this.userId] }
              : r))
            : [...c.reactions, { emoji: options.emoji, createdAt: new Date(), userIds: [this.userId] }],
        }
      }),
    }))
  }

  async deleteReaction(options: { threadId: string; commentId: string; emoji: string }) {
    this.write(options.threadId, (was) => ({
      ...was,
      comments: was.comments.map((c) => (c.id === options.commentId
        ? {
          ...c,
          reactions: c.reactions
            .map((r) => (r.emoji === options.emoji
              ? { ...r, userIds: r.userIds.filter((u) => u !== this.userId) }
              : r))
            .filter((r) => r.userIds.length),
        }
        : c)),
    }))
  }

  getThread(threadId: string): ThreadData {
    const held = this.map().get(threadId)
    if (!held) throw new Error('No such thread')
    return out(held)
  }

  getThreads(): Map<string, ThreadData> {
    const all = new Map<string, ThreadData>()
    for (const [id, held] of this.map().entries()) all.set(id, out(held))
    return all
  }

  subscribe(cb: (threads: Map<string, ThreadData>) => void) {
    const map = this.map()
    const tell = () => cb(this.getThreads())
    map.observeDeep(tell)
    tell()
    return () => map.unobserveDeep(tell)
  }
}
