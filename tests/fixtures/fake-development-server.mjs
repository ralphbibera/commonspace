import { appendFile } from 'node:fs/promises'

const logPath = process.env.FAKE_DEVELOPMENT_SERVER_LOG
const drainDelayMs = Number(process.env.FAKE_DEVELOPMENT_SERVER_DRAIN_MS ?? 150)

async function record(event) {
  if (logPath !== undefined) await appendFile(logPath, `${event}:${String(process.pid)}\n`)
}

await record('started')

let exiting = false
async function exit(event) {
  if (exiting) return
  exiting = true
  await record(event)
  if (process.connected) process.disconnect()
  process.exit(0)
}

process.on('message', (message) => {
  if (typeof message !== 'object' || message === null || message.type !== 'commonspace:development-restart') return
  void record('restart-requested').then(() => {
    setTimeout(() => { void exit('drained') }, drainDelayMs)
  })
})
process.once('SIGINT', () => { void exit('forced') })
process.once('SIGTERM', () => { void exit('forced') })
process.send?.({ type: 'commonspace:development-ready' })
