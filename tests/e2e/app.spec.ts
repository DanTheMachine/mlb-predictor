import { expect, test } from '@playwright/test'

test('shows the MLB predictor scaffold', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'MLB Predictor' })).toBeVisible()
  await expect(page.getByText('Single Game Tools')).toBeVisible()
  await expect(page.getByText('Daily Schedule')).toBeVisible()
})
