import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Keep verification artifacts with the project. An override is useful for CI,
// but reject Desktop and paths outside this project's artifacts tree so a
// browser run cannot silently scatter screenshots into a user folder.
const defaultScreenshotDir = path.join(projectRoot, 'artifacts', 'browser-captures')
const requestedScreenshotDir = process.env.AURIA_SCREENSHOT_DIR
  ? path.resolve(process.env.AURIA_SCREENSHOT_DIR)
  : defaultScreenshotDir
const artifactsRoot = path.resolve(path.join(projectRoot, 'artifacts'))
const isInsideArtifacts = requestedScreenshotDir === artifactsRoot || requestedScreenshotDir.startsWith(`${artifactsRoot}${path.sep}`)
if (!isInsideArtifacts || /(^|[\\/])desktop([\\/]|$)/i.test(requestedScreenshotDir)) {
  throw new Error(`Screenshot output must stay under ${artifactsRoot}; got ${requestedScreenshotDir}`)
}

export const SCREENSHOT_DIR = requestedScreenshotDir

export async function ensureScreenshotDir() {
  await mkdir(SCREENSHOT_DIR, { recursive: true })
  return SCREENSHOT_DIR
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await ensureScreenshotDir())
}
