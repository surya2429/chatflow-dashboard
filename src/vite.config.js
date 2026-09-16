/*
 * Vite resolves its config from the process cwd, and this project gets started
 * from both the repo root and src/ depending on the launcher. Rather than keep
 * two configs in sync — they had already drifted once — this one re-exports
 * the root config, which sets `root` from its own location and so is correct
 * regardless of which directory Vite was invoked from.
 */
export { default } from '../vite.config.js'
