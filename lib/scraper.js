const puppeteer = require('puppeteer');

async function scrapeJD(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit for dynamic content
    await new Promise(r => setTimeout(r, 2000));

    const content = await page.evaluate(() => {
      // Remove noise
      const scripts = document.querySelectorAll('script, style, nav, footer, header, noscript, iframe');
      scripts.forEach(s => s.remove());

      // Common JD selectors
      const selectors = [
        '#jobDescriptionText', // Indeed specific
        '.jobsearch-JobComponent-description', 
        '.description',
        'main',
        'article',
        'body'
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length > 200) {
          return el.innerText;
        }
      }
      return document.body.innerText;
    });

    return content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .slice(0, 8000);

  } catch (error) {
    console.error('Puppeteer scraping error:', error.message);
    throw new Error(`Browser fetch failed: ${error.message}. You may need to paste the JD manually if the site is protected.`);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeJD };
