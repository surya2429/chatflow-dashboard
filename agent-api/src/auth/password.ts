import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * Password hashing with scrypt from node:crypto — memory-hard, no native
 * addon to compile on every deploy target.
 *
 * Stored self-describing ("scrypt$N$r$p$salt$hash") so the cost can be raised
 * later without a migration: old hashes still verify with the parameters they
 * were made with, and `needsRehash` tells login to upgrade them.
 */
const N = 2 ** 15
const R = 8
const P = 1
const KEYLEN = 64
// scrypt needs 128·N·r bytes; Node's default 32MB cap is exactly N=2^15, r=8.
const MAXMEM = 64 * 1024 * 1024

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string]
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function needsRehash(stored: string): boolean {
  const [, n, r, p] = stored.split('$')
  return Number(n) !== N || Number(r) !== R || Number(p) !== P
}

/**
 * A hash of a random password, verified against when the email doesn't exist
 * so that "no such user" and "wrong password" take the same time and can't be
 * told apart by a stopwatch.
 */
export const DUMMY_HASH_PROMISE = hashPassword(randomBytes(16).toString('hex'))
