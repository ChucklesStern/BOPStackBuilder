import puppeteer, { LaunchOptions, Browser } from 'puppeteer';

export const getPuppeteerConfig = (): LaunchOptions => ({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--single-process'
  ],
});

export const isBrowserAvailable = async (): Promise<boolean> => {
  try {
    const browser = await puppeteer.launch(getPuppeteerConfig());
    await browser.close();
    return true;
  } catch (error) {
    console.warn('Browser not available for testing:', (error as Error).message);
    return false;
  }
};

export const launchBrowser = async (): Promise<Browser> => {
  const isAvailable = await isBrowserAvailable();
  if (!isAvailable) {
    throw new Error('Browser dependencies not available in this environment');
  }
  return puppeteer.launch(getPuppeteerConfig());
};