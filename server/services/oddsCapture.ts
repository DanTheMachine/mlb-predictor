import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { chromium, type Frame, type Locator, type Page } from '@playwright/test'

import { parseBulkOdds } from '../../src/lib/bulkOddsParser.js'
import { appConfig, assertDateInput } from '../config.js'
import { importBulkOddsOverrides } from './oddsOverrides.js'

type CaptureSettings = {
  loginUrl: string
  pageUrl: string | null
  username: string
  password: string
  loginFrameSelector: string | null
  usernameSelector: string
  passwordSelector: string
  submitSelector: string
  successSelector: string | null
  contentSelector: string
  readySelector: string | null
  modalCloseSelector: string | null
  postLoginScript: string | null
  navSelectors: string[]
}

export async function captureOddsOverrides(args?: { date?: string; source?: string }) {
  const date = assertDateInput(args?.date)
  const source = args?.source?.trim() || appConfig.oddsCaptureProvider

  const settings = validateCaptureConfig()
  const browser = await chromium.launch({
    headless: appConfig.oddsCaptureHeadless,
    channel: appConfig.oddsCaptureBrowserChannel ?? undefined,
  })

  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: appConfig.oddsCaptureUserAgent,
      viewport: { width: 1440, height: 900 },
    })
    const page = await context.newPage()
    page.setDefaultTimeout(appConfig.oddsCaptureTimeoutMs)

    await gotoWithFallback(page, settings.loginUrl)
    const loginFrame = settings.loginFrameSelector ? await findFrame(page, settings.loginFrameSelector) : null

    const usernameField = await findLocator(page, settings.usernameSelector, loginFrame)
    const passwordField = await findLocator(page, settings.passwordSelector, loginFrame)
    const submitButton = await findLocator(page, settings.submitSelector, loginFrame)

    await typeIntoField(usernameField, settings.username)
    await usernameField.press('Tab')

    await typeIntoField(passwordField, settings.password)
    await passwordField.press('Tab')
    await page.waitForTimeout(300)

    await submitLogin(page, passwordField, submitButton)
    await waitForAppShell(page)

    if (settings.successSelector) {
      await (await findLocator(page, settings.successSelector)).waitFor()
    }

    if (settings.pageUrl && page.url() !== settings.pageUrl) {
      await gotoWithFallback(page, settings.pageUrl)
    }

    await closeModalIfPresent(page, settings.modalCloseSelector)
    await page.waitForTimeout(2000)

    if (settings.postLoginScript) {
      await tryRunPostLoginScript(page, settings.postLoginScript)
    }

    for (const selector of settings.navSelectors) {
      await closeModalIfPresent(page, settings.modalCloseSelector)
      await clickNavTarget(page, selector, settings.modalCloseSelector)
    }

    await page.waitForTimeout(2000)

    const contentLocator = await findLocator(page, settings.contentSelector)
    const raw = await contentLocator.innerText()
    const parsedGames = parseBulkOdds(raw)
    const successArtifact = await saveSuccessfulCaptureArtifact(date, raw, parsedGames, page)

    const importResult = await importBulkOddsOverrides({
      date,
      raw,
      source,
      metadata: {
        importedVia: 'playwright-capture',
        captureUrl: settings.pageUrl ?? settings.loginUrl,
      },
    })

    return {
      ...importResult,
      provider: appConfig.oddsCaptureProvider,
      headless: appConfig.oddsCaptureHeadless,
      contentLength: raw.length,
      rawCapturePath: successArtifact.rawPath,
      parsedCapturePath: successArtifact.parsedPath,
      rawCapturePreview: buildRawPreview(raw),
      parsedMatchups: parsedGames.map((game) => `${game.awayAbbr} at ${game.homeAbbr}`),
    }
  } catch (error) {
    await saveDebugArtifacts(date, error, browser)
    throw error
  } finally {
    await browser.close()
  }
}

function validateCaptureConfig(): CaptureSettings {
  const loginUrl = appConfig.oddsCaptureLoginUrl || appConfig.oddsCaptureBaseUrl
  if (!loginUrl) {
    throw new Error('ODDS_CAPTURE_LOGIN_URL or ODDS_CAPTURE_BASE_URL must be configured before browser capture can run.')
  }

  const username = requireSetting(appConfig.oddsCaptureUsername, 'username')
  const password = requireSetting(appConfig.oddsCapturePassword, 'password')
  const usernameSelector = requireSetting(appConfig.oddsCaptureUsernameSelector, 'usernameSelector')
  const passwordSelector = requireSetting(appConfig.oddsCapturePasswordSelector, 'passwordSelector')
  const submitSelector = requireSetting(appConfig.oddsCaptureSubmitSelector, 'submitSelector')
  const contentSelector = requireSetting(appConfig.oddsCaptureContentSelector, 'contentSelector')

  return {
    loginUrl,
    pageUrl: appConfig.oddsCapturePageUrl,
    username,
    password,
    loginFrameSelector: appConfig.oddsCaptureLoginFrameSelector,
    usernameSelector,
    passwordSelector,
    submitSelector,
    successSelector: appConfig.oddsCaptureSuccessSelector,
    contentSelector,
    readySelector: appConfig.oddsCaptureReadySelector,
    modalCloseSelector: appConfig.oddsCaptureModalCloseSelector,
    postLoginScript: appConfig.oddsCapturePostLoginScript,
    navSelectors: appConfig.oddsCaptureNavSelectors,
  }
}

function requireSetting(value: string | null, key: string) {
  if (!value) {
    throw new Error(`Missing browser odds capture config: ${key}.`)
  }
  return value
}

async function gotoWithFallback(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('Timeout')) {
      throw error
    }

    await page.goto(url, { waitUntil: 'commit', timeout: Math.max(15000, Math.round(appConfig.oddsCaptureTimeoutMs / 2)) })
  }

  await waitForAppShell(page)
}

async function findLocator(page: Page, selector: string, targetFrame?: Frame | null, timeoutMs = appConfig.oddsCaptureTimeoutMs): Promise<Locator> {
  const normalized = selector.startsWith('//') || selector.startsWith('(') ? `xpath=${selector}` : selector
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const frames = targetFrame ? [targetFrame] : page.frames()
    for (const frame of frames) {
      const locator = frame.locator(normalized).first()
      if ((await locator.count()) > 0) {
        return locator
      }
    }
    await page.waitForTimeout(250)
  }

  throw new Error(`Timed out locating selector: ${selector}`)
}

async function findNavLocator(page: Page, selector: string) {
  const navTimeoutMs = Math.min(1500, appConfig.oddsCaptureTimeoutMs)
  try {
    return await findVisibleLocator(page, selector, navTimeoutMs)
  } catch (error) {
    const fallbacks = getNavFallbackSelectors(selector)
    for (const fallback of fallbacks) {
      try {
        return await findVisibleLocator(page, fallback, navTimeoutMs)
      } catch {
        // Try the next known fallback for the current sportsbook layout.
      }
    }

    const permissiveSelectors = [selector, ...fallbacks]
    for (const permissiveSelector of permissiveSelectors) {
      try {
        return await findLocator(page, permissiveSelector, undefined, navTimeoutMs)
      } catch {
        // Fall through to the original error.
      }
    }

    throw error instanceof Error ? error : new Error(`Timed out locating selector: ${selector}`)
  }
}

async function findVisibleLocator(page: Page, selector: string, timeoutMs: number) {
  const locator = await findLocator(page, selector, undefined, timeoutMs)
  if (await locator.isVisible().catch(() => false)) {
    return locator
  }

  throw new Error(`Located selector but it was not visible: ${selector}`)
}

function getNavFallbackSelectors(selector: string) {
  const normalized = selector.toUpperCase()

  if (normalized.includes('MLB')) {
    return [
      `//ul[@id='mobile-popular']//a[.//p[normalize-space(text())='MLB']]`,
      `//ul[@id='uSportListUL']//a[contains(normalize-space(text()),'Baseball - MLB - Games')]`,
      `//li[contains(@class,'sub-menu')][.//b[normalize-space(text())='MLB']]//a[normalize-space(text())='Games']`,
    ]
  }

  return []
}

async function findFrame(page: Page, selector: string) {
  const normalized = selector.startsWith('//') || selector.startsWith('(') ? `xpath=${selector}` : selector
  const deadline = Date.now() + appConfig.oddsCaptureTimeoutMs

  while (Date.now() < deadline) {
    const frameElement = page.locator(normalized).first()
    if ((await frameElement.count()) > 0) {
      const frame = await frameElement.elementHandle().then((handle) => handle?.contentFrame())
      if (frame) {
        return frame
      }
    }
    await page.waitForTimeout(250)
  }

  throw new Error(`Timed out locating login frame: ${selector}`)
}

async function closeModalIfPresent(page: Page, selector: string | null) {
  const activeModal = page.locator('.bootbox.modal.in, .modal.in').last()
  if ((await activeModal.count()) > 0 && (await activeModal.isVisible())) {
    const closeCandidates = [
      '.bootbox-close-button',
      '.close',
      '.modal-footer .btn-primary',
      '.modal-footer button',
    ]

    for (const closeSelector of closeCandidates) {
      const button = activeModal.locator(closeSelector).first()
      if ((await button.count()) > 0 && (await button.isVisible())) {
        await button.click({ force: true })
        await activeModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
        if (!(await activeModal.isVisible().catch(() => false))) {
          return
        }
      }
    }

    await page.keyboard.press('Escape').catch(() => {})
    await activeModal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
  }

  if (!selector) return

  try {
    const locator = await findLocator(page, selector)
    if ((await locator.count()) > 0 && (await locator.isVisible())) {
      await locator.click()
      await locator.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
    }
  } catch {
    // Some sessions may not show the account modal.
  }
}

async function clickWithModalFallback(page: Page, locator: Locator, modalSelector: string | null) {
  try {
    await locator.click()
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('intercepts pointer events')) {
      throw error
    }

    await closeModalIfPresent(page, modalSelector)
    await locator.click({ force: true })
  }
}

async function clickNavTarget(page: Page, selector: string, modalSelector: string | null) {
  const locator = await findNavLocator(page, selector)
  const visible = await locator.isVisible().catch(() => false)
  if (visible) {
    await clickWithModalFallback(page, locator, modalSelector)
    return
  }

  const href = await locator.getAttribute('href')
  if (href?.startsWith('javascript:')) {
    await page.evaluate((script) => {
      ;(0, eval)(script)
    }, href.slice('javascript:'.length))
    return
  }

  await clickWithModalFallback(page, locator, modalSelector)
}

async function typeIntoField(locator: Locator, value: string) {
  await locator.click()
  await locator.fill(value)
}


async function submitLogin(page: Page, passwordField: Locator, submitButton: Locator) {
  await submitButton.click()

  const advancedAfterClick = await waitForPostLoginTransition(page, Math.max(5000, appConfig.oddsCaptureStepDelayMs * 3))
  if (advancedAfterClick) return

  await passwordField.click()
  await page.waitForTimeout(250)
  await passwordField.press('Enter')

  const advancedAfterEnter = await waitForPostLoginTransition(page, Math.max(8000, appConfig.oddsCaptureStepDelayMs * 4))
  if (advancedAfterEnter) return

  await submitButton.click({ force: true })
  await waitForPostLoginTransition(page, Math.max(10000, appConfig.oddsCaptureStepDelayMs * 5))
}

async function waitForAppShell(page: Page) {
  try {
    await page.waitForLoadState('domcontentloaded')
  } catch {
    // Keep going and rely on DOM checks below.
  }

  await page.waitForFunction(() => {
    return Boolean(document.body) && document.head.childElementCount > 0
  })

  try {
    await page.waitForFunction(() => {
      return document.body !== null && document.body.childElementCount > 0
    }, { timeout: Math.min(15000, appConfig.oddsCaptureTimeoutMs) })
  } catch {
    // Some pages build the body lazily; later selectors may still succeed.
  }
}

async function tryRunPostLoginScript(page: Page, script: string) {
  try {
    await page.waitForFunction(() => typeof (window as typeof window & { OpenLineLink?: unknown }).OpenLineLink === 'function', {
      timeout: Math.min(5000, appConfig.oddsCaptureTimeoutMs),
    })
  } catch {
    return false
  }

  await page.evaluate((scriptValue) => {
    // The target site exposes navigation helpers like OpenLineLink on window.
    ;(0, eval)(scriptValue)
  }, script)

  return true
}

async function waitForPostLoginTransition(page: Page, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const url = page.url()
    if (!url.includes('/SplashScreen/lotus/betlotus.html')) {
      return true
    }

    const frameUrls = page.frames().map((frame) => frame.url())
    if (frameUrls.some((urlValue) => urlValue.includes('/defaultfd') || urlValue.includes('/LoginAgent.aspx'))) {
      return true
    }

    await page.waitForTimeout(250)
  }

  return false
}

async function saveDebugArtifacts(date: string, error: unknown, browser: Awaited<ReturnType<typeof chromium.launch>>) {
  try {
    const debugDir = getOddsCaptureDebugDir()
    await mkdir(debugDir, { recursive: true })

    const context = browser.contexts()[0]
    const page = context?.pages()[0]
    if (!page) return

    const stamp = `${date}-${Date.now()}`
    const htmlPath = path.join(debugDir, `${stamp}.html`)
    const screenshotPath = path.join(debugDir, `${stamp}.png`)
    const metaPath = path.join(debugDir, `${stamp}.txt`)

    await writeFile(htmlPath, await page.content(), 'utf8')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    await writeFile(
      metaPath,
      [
        `url=${page.url()}`,
        `error=${error instanceof Error ? error.message : String(error)}`,
        `frames=${page.frames().map((frame) => frame.url()).join('\n')}`,
      ].join('\n\n'),
      'utf8',
    )
  } catch {
    // Best-effort debug capture only.
  }
}

async function saveSuccessfulCaptureArtifact(
  date: string,
  raw: string,
  parsedGames: ReturnType<typeof parseBulkOdds>,
  page: Page,
) {
  const debugDir = getOddsCaptureDebugDir()
  await mkdir(debugDir, { recursive: true })

  const stamp = `${date}-${Date.now()}`
  const rawPath = path.join(debugDir, `${stamp}-raw.txt`)
  const parsedPath = path.join(debugDir, `${stamp}-parsed.json`)
  const metaPath = path.join(debugDir, `${stamp}-meta.txt`)

  await writeFile(rawPath, raw, 'utf8')
  await writeFile(parsedPath, JSON.stringify(parsedGames, null, 2), 'utf8')
  await writeFile(
    metaPath,
    [
      `url=${page.url()}`,
      `capturedAt=${new Date().toISOString()}`,
      `contentLength=${raw.length}`,
      `parsedGames=${parsedGames.length}`,
    ].join('\n'),
    'utf8',
  )

  return { rawPath, parsedPath, metaPath }
}

function buildRawPreview(raw: string) {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 2000)
}

function getOddsCaptureDebugDir() {
  return path.resolve(appConfig.exportDir, 'odds-capture-debug')
}
