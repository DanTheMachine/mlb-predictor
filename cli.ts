import {
  evaluate,
  exportPredictionsCsv,
  exportResultsCsv,
  generatePredictions,
  getLatestRuns,
  ingestResults,
  loadSlate,
  refreshTeamStats,
  runDailyPipeline,
} from './server/services/mlbAutomation.js'
import { importHistoricalPredictionsSheet } from './server/services/historicalImport.js'
import {
  approveOddsOverrides,
  importBulkOddsOverridesFromFile,
  listOddsOverrides,
  rejectOddsOverrides,
} from './server/services/oddsOverrides.js'
import { captureOddsOverrides } from './server/services/oddsCapture.js'

// eslint-disable-next-line no-unused-vars
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
    return loadSlate(toStringArg(args.date), {
      useOddsOverrides: toBoolArg(args['use-odds-overrides']),
      overrideSource: toStringArg(args['override-source']),
    })
  },
  async 'run-predictions'(args) {
    return generatePredictions(toStringArg(args.date), {
      useOddsOverrides: toBoolArg(args['use-odds-overrides']),
      overrideSource: toStringArg(args['override-source']),
    })
  },
  async 'run-daily-pipeline'(args) {
    return runDailyPipeline(toStringArg(args.date), {
      useOddsOverrides: toBoolArg(args['use-odds-overrides']),
      overrideSource: toStringArg(args['override-source']),
    })
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
  async 'import-season-sheet'(args) {
    const file = toStringArg(args.file)
    if (!file) {
      throw new Error('import-season-sheet requires --file PATH_TO_TSV_OR_CSV')
    }

    return importHistoricalPredictionsSheet({
      file,
      source: toStringArg(args.source),
    })
  },
  async 'import-odds-overrides'(args) {
    const file = toStringArg(args.file)
    if (!file) {
      throw new Error('import-odds-overrides requires --file PATH_TO_BULK_ODDS_TEXT')
    }

    return importBulkOddsOverridesFromFile({
      date: toStringArg(args.date),
      file,
      source: toStringArg(args.source),
    })
  },
  async 'list-odds-overrides'(args) {
    return listOddsOverrides(toStringArg(args.date))
  },
  async 'capture-odds-overrides'(args) {
    return captureOddsOverrides({
      date: toStringArg(args.date),
      source: toStringArg(args.source),
    })
  },
  async 'approve-odds-overrides'(args) {
    return approveOddsOverrides({
      date: toStringArg(args.date),
      source: toStringArg(args.source),
      lookupKeys: toCsvArgs(args.lookupKeys),
    })
  },
  async 'reject-odds-overrides'(args) {
    return rejectOddsOverrides({
      date: toStringArg(args.date),
      source: toStringArg(args.source),
      lookupKeys: toCsvArgs(args.lookupKeys),
    })
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
        '  load-slate --date YYYY-MM-DD [--use-odds-overrides] [--override-source LABEL]',
        '  run-predictions --date YYYY-MM-DD [--use-odds-overrides] [--override-source LABEL]',
        '  run-daily-pipeline --date YYYY-MM-DD [--use-odds-overrides] [--override-source LABEL]',
        '  export-predictions-csv --date YYYY-MM-DD [--runId RUN_ID]',
        '  ingest-results --date YYYY-MM-DD',
        '  export-results-csv --date YYYY-MM-DD',
        '  evaluate --from YYYY-MM-DD --to YYYY-MM-DD',
        '  list-runs',
        '  import-season-sheet --file PATH [--source LABEL]',
        '  import-odds-overrides --date YYYY-MM-DD --file PATH [--source LABEL]',
        '  capture-odds-overrides --date YYYY-MM-DD [--source LABEL]',
        '  list-odds-overrides --date YYYY-MM-DD',
        '  approve-odds-overrides --date YYYY-MM-DD [--source LABEL] [--lookupKeys KEY1,KEY2]',
        '  reject-odds-overrides --date YYYY-MM-DD [--source LABEL] [--lookupKeys KEY1,KEY2]',
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

function toBoolArg(value: string | boolean | undefined) {
  return value === true || value === 'true'
}

function toCsvArgs(value: string | boolean | undefined) {
  if (typeof value !== 'string') return undefined
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

void main()
