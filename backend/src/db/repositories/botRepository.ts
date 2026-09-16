import { query, withTransaction } from '../pool.js'

/* Arbitrary constant key for pg_advisory_xact_lock — it only has to be unique
   among this app's advisory locks, not meaningful. */
const BOT_PROVISION_LOCK = 8421_0001

export interface Bot {
  id: string
  bot_number: string // BIGINT — node-postgres returns it as a string, see below
  client_id: string
  name: string
  channel: string
  config: Record<string, unknown>
  archived_at: string | null
  config_version: number
  config_updated_at: string
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

  /**
   * The current bot, creating one if the workspace has none.
   *
   * The install snippet needs a real id at all times — a dashboard that shows
   * a placeholder until someone remembers to press "create bot" hands out
   * snippets that cannot work. So provisioning is automatic.
   *
   * The advisory lock is what stops two dashboard tabs opening at once from
   * each seeing "no bots" and each creating one. It is keyed to a constant, so
   * only concurrent first-provisions contend; every later call takes the
   * SELECT path and returns before reaching it. Released with the transaction.
   */
  async findOrCreateCurrent(defaultClientId: string, botName: string): Promise<Bot> {
    return withTransaction(async (client) => {
      const existing = await client.query<Bot>(
        `SELECT * FROM bots WHERE archived_at IS NULL ORDER BY bot_number DESC LIMIT 1`,
      )
      if (existing.rows[0]) return existing.rows[0]

      await client.query(`SELECT pg_advisory_xact_lock($1)`, [BOT_PROVISION_LOCK])

      // Re-check: another transaction may have provisioned while we waited.
      const recheck = await client.query<Bot>(
        `SELECT * FROM bots WHERE archived_at IS NULL ORDER BY bot_number DESC LIMIT 1`,
      )
      if (recheck.rows[0]) return recheck.rows[0]

      await client.query(
        `INSERT INTO clients (id, name) VALUES ($1, 'Default workspace') ON CONFLICT (id) DO NOTHING`,
        [defaultClientId],
      )
      const created = await client.query<Bot>(
        `INSERT INTO bots (client_id, name, channel) VALUES ($1, $2, 'webchat') RETURNING *`,
        [defaultClientId, botName],
      )
      const bot = created.rows[0]
      if (!bot) throw new Error('Failed to provision bot')
      return bot
    })
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
   * Merges `patch` into the bot's config and returns the new version.
   *
   * A merge, not a replace: the dashboard sends the keys it changed, and two
   * people editing different sections at the same time should not silently
   * undo each other. `||` is jsonb concatenation — right-hand keys win, which
   * is what makes this last-write-wins PER KEY instead of per document.
   *
   * config_version is bumped by the trigger in 004, never here.
   */
  async updateConfig(botNumber: string, patch: Record<string, unknown>): Promise<Bot | null> {
    const rows = await query<Bot>(
      `UPDATE bots
       SET config = config || $2::jsonb
       WHERE bot_number = $1::bigint AND archived_at IS NULL
       RETURNING *`,
      [botNumber, JSON.stringify(patch)],
    )
    return rows[0] ?? null
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
