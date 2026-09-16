import { query } from '../pool.js'

export interface Bot {
  id: string
  bot_number: string // BIGINT — node-postgres returns it as a string, see below
  client_id: string
  name: string
  channel: string
  config: Record<string, unknown>
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateBotInput {
  clientId: string
  name: string
  channel?: string
}

/**
 * A note on `bot_number` being a string.
 *
 * node-postgres returns BIGINT as a string rather than a number, because
 * PostgreSQL's BIGINT range exceeds Number.MAX_SAFE_INTEGER and silently
 * losing precision on a customer-facing identifier would be far worse than
 * carrying it as text. Nothing here does arithmetic on it — it is an
 * identifier, not a quantity — so string is also the honest type for it.
 */
export const botRepository = {
  /**
   * Creates a bot and lets the database assign its number.
   *
   * The number deliberately is NOT computed here (no MAX(bot_number) + 1, no
   * count of the client's bots): two concurrent creations reading the same
   * MAX would both write the same number, and the UNIQUE constraint would
   * turn that into a failed signup. `DEFAULT nextval(...)` is the only form
   * that is correct under concurrency, so the insert simply omits the column.
   */
  async create(input: CreateBotInput): Promise<Bot> {
    const rows = await query<Bot>(
      `INSERT INTO bots (client_id, name, channel)
       VALUES ($1, $2, COALESCE($3::varchar, 'webchat'))
       RETURNING *`,
      [input.clientId, input.name, input.channel ?? null],
    )
    const bot = rows[0]
    if (!bot) throw new Error('Failed to create bot')
    return bot
  },

  /** Resolve the `?id=` a widget snippet was installed with. */
  async findByNumber(botNumber: string): Promise<Bot | null> {
    const rows = await query<Bot>(
      `SELECT * FROM bots WHERE bot_number = $1::bigint AND archived_at IS NULL`,
      [botNumber],
    )
    return rows[0] ?? null
  },

  /**
   * The bot the dashboard is currently configuring.
   *
   * Stands in for a session-scoped lookup until this backend has auth —
   * mirrors instagramAccountRepository.findActive(), which resolves "the
   * workspace's connected account" the same way. Once requests carry a client,
   * this becomes listForClient(...)[0] or an explicit selection.
   */
  async findCurrent(): Promise<Bot | null> {
    const rows = await query<Bot>(
      `SELECT * FROM bots WHERE archived_at IS NULL ORDER BY bot_number DESC LIMIT 1`,
    )
    return rows[0] ?? null
  },

  /** Oldest first, so a client's list reads in the order they created them. */
  async listForClient(clientId: string): Promise<Bot[]> {
    return query<Bot>(
      `SELECT * FROM bots
       WHERE client_id = $1 AND archived_at IS NULL
       ORDER BY bot_number ASC`,
      [clientId],
    )
  },

  /**
   * Soft-delete. The row stays and the number is never reused — an archived
   * bot's id may still be pasted into a live page somewhere, and handing that
   * number to a different client later would point someone else's website at
   * the wrong bot.
   */
  async archive(botNumber: string): Promise<void> {
    await query(`UPDATE bots SET archived_at = now() WHERE bot_number = $1::bigint`, [botNumber])
  },
}
