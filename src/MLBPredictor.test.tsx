import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MLBPredictor } from './MLBPredictor'

describe('MLBPredictor', () => {
  it('renders the predictor shell', () => {
    render(<MLBPredictor />)

    expect(screen.getByRole('heading', { name: 'MLB Predictor' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Predictor' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Daily Schedule' })).toBeTruthy()
  })
})
