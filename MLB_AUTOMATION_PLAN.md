# MLB Automation, CLI, API, and Postgres Plan

## Implemented Foundation

- Shared Node/TypeScript automation layer now exists under `server/`
- TypeScript CLI added in `cli.ts`
- Lightweight API added in `api.ts`
- Prisma schema and initial migration scaffold added under `prisma/`
- Airflow DAG scaffold added under `airflow/dags/`
- Local config/secrets flow added through `.env` / `.env.example`

## Delivery Shape

The predictor remains usable as a standalone UI, but now has an operational foundation for:

1. refreshing team stats
2. loading a slate
3. enriching slate rows with sharp data
4. generating predictions
5. storing runs in Postgres when configured
6. exporting predictions/results CSV from the automation layer
7. evaluating persisted runs

## Notes

- Fallback mode is preserved: if `DATABASE_URL` is absent, CLI/API still run in non-persistent mode.
- Sharp data is currently derived from ESPN opening/closing line movement and stored as normalized sharp signals.
- The live production predictor remains the existing heuristic model.
- Prisma migrations are scaffolded but still need to be applied against a real Postgres instance.
- Airflow is intentionally orchestration-only and shells out to the CLI.
