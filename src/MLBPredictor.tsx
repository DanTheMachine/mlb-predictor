import { useState } from 'react'

import { AutomationDashboard } from './components/AutomationDashboard'
import { ModelEvaluation } from './components/ModelEvaluation'
import { ResultsTracker } from './components/ResultsTracker'
import { ScheduleAnalysis } from './components/ScheduleAnalysis'
import { SingleGameControls } from './components/SingleGameControls'
import { SingleGameResults } from './components/SingleGameResults'
import { useAutomationDashboard } from './hooks/useAutomationDashboard'
import { useMlbModelData } from './hooks/useMlbModelData'
import { usePredictorState } from './hooks/usePredictorState'
import { useResultsTracker } from './hooks/useResultsTracker'

type PredictorTab = 'predictor' | 'automation' | 'results' | 'evaluation'

export function MLBPredictor() {
  const modelData = useMlbModelData()
  const predictorState = usePredictorState(modelData.teams, modelData.leagueAvgRunsPerGame)
  const resultsTracker = useResultsTracker()
  const automationDashboard = useAutomationDashboard()
  const [activeTab, setActiveTab] = useState<PredictorTab>('predictor')
  const [singleGameOpen, setSingleGameOpen] = useState(false)

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <h1>MLB Predictor</h1>
        </div>
      </header>

      <div className="tab-row">
        <button className={`tab-button ${activeTab === 'predictor' ? 'tab-button-active' : ''}`} onClick={() => setActiveTab('predictor')}>
          Predictor
        </button>
        <button className={`tab-button ${activeTab === 'results' ? 'tab-button-active' : ''}`} onClick={() => setActiveTab('results')}>
          Results Tracker
        </button>
        <button className={`tab-button ${activeTab === 'evaluation' ? 'tab-button-active' : ''}`} onClick={() => setActiveTab('evaluation')}>
          Model Eval
        </button>
        <button className={`tab-button ${activeTab === 'automation' ? 'tab-button-active' : ''}`} onClick={() => setActiveTab('automation')}>
          Automation
        </button>
      </div>

      {activeTab === 'predictor' ? (
        <section className="grid">
          <ScheduleAnalysis
            teams={modelData.teams}
            leagueAvgRunsPerGame={modelData.leagueAvgRunsPerGame}
            teamDataTone={modelData.teamDataTone}
            teamDataStatus={modelData.teamDataStatus}
            teamsUpdated={modelData.teamsUpdated}
            teamsUpdatedAt={null}
            loadedSeason={null}
            fetchTeamData={modelData.fetchTeamData}
          />
          <section className="panel accordion-panel">
            <button className="accordion-toggle" onClick={() => setSingleGameOpen((prev) => !prev)}>
              <div>
                <strong>Single Game Tools</strong>
                <span>Open the matchup builder for manual projections, ESPN fetches, and one-off analysis.</span>
              </div>
              <span className="accordion-icon">{singleGameOpen ? 'Hide' : 'Open'}</span>
            </button>

            {singleGameOpen ? (
              <div className="accordion-content">
                <section className="grid two-up">
                  <SingleGameControls state={predictorState} />
                  <SingleGameResults
                    result={predictorState.result}
                    odds={predictorState.odds}
                    homeTeam={predictorState.teams[predictorState.homeTeam]}
                    awayTeam={predictorState.teams[predictorState.awayTeam]}
                    homeStarterName={predictorState.homeStarterName}
                    awayStarterName={predictorState.awayStarterName}
                  />
                </section>
              </div>
            ) : null}
          </section>
        </section>
      ) : null}

      {activeTab === 'automation' ? (
        <section className="grid">
          <AutomationDashboard {...automationDashboard} />
        </section>
      ) : null}

      {activeTab === 'results' ? (
        <section className="grid">
          <ResultsTracker {...resultsTracker} />
        </section>
      ) : null}

      {activeTab === 'evaluation' ? (
        <section className="grid">
          <ModelEvaluation />
        </section>
      ) : null}
    </main>
  )
}
