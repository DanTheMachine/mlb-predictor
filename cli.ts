import {
  evaluate,
  exportPredictionsCsv,
  exportResultsCsv,
  generatePredictions,
  getLatestRuns,
  ingestResults,
  loadSlate,
  refreshTeamStats,
} from './server/services/mlbAutomation.js'

type CommandHandler = (args: Record<string, string | boolean>) => Promise<unknown>

function parseArgs(argv: string[]) {
  const [command = 'help', ...rest] = argv
  const args: Record<string, string | boolean> = {}

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token?.startsWith('--')) continue
    const key = token.slice(2)
    const next = rest[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    index += 1
  }

  return { command, args }
}

const commands: Record<string, CommandHandler> = {
  async 'fetch-team-stats'(args) {
    return refreshTeamStats(toStringArg(args.date))
  },
  async 'load-slate'(args) {
    return loadSlate(toStringArg(args.date))
  },
  async 'run-predictions'(args) {
    return generatePredictions(toStringArg(args.date))
  },
  async 'export-predictions-csv'(args) {
    return exportPredictionsCsv({
      date: toStringArg(args.date),
      runId: toStringArg(args.runId),
    })
  },
  async 'ingest-results'(args) {
    return ingestResults(toStringArg(args.date))
  },
  async 'export-results-csv'(args) {
    return exportResultsCsv(toStringArg(args.date))
  },
  async evaluate(args) {
    const from = toStringArg(args.from) ?? new Date().toISOString().slice(0, 10)
    const to = toStringArg(args.to) ?? from
    return evaluate({ from, to })
  },
  async 'list-runs'() {
    return getLatestRuns()
  },
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2))
  const handler = commands[command]

  if (!handler) {
    console.log(
      [
        'Available commands:',
        '  fetch-team-stats --date YYYY-MM-DD',
        '  load-slate --date YYYY-MM-DD',
        '  run-predictions --date YYYY-MM-DD',
        '  export-predictions-csv --date YYYY-MM-DD [--runId RUN_ID]',
        '  ingest-results --date YYYY-MM-DD',
        '  export-results-csv --date YYYY-MM-DD',
        '  evaluate --from YYYY-MM-DD --to YYYY-MM-DD',
        '  list-runs',
      ].join('\n'),
    )
    process.exitCode = command === 'help' ? 0 : 1
    return
  }

  try {
    const result = await handler(args)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Command failed.')
    process.exitCode = 1
  }
}

function toStringArg(value: string | boolean | undefined) {
  return typeof value === 'string' ? value : undefined
}

void main()
