const { getBrowser } = require('./browser');

async function scrapeJD(url) {
  // SSRF Validation: Only allow http/https
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol. Only http and https are supported.');
    }
  } catch (err) {
    throw new Error(`Invalid job URL: ${err.message}`);
  }

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for content
    await new Promise(r => setTimeout(r, 2000));

    const content = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script, style, nav, footer, header, noscript, iframe');
      scripts.forEach(s => s.remove());

      const selectors = [
        '#jobDescriptionText',
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

    await page.close(); // Only close the page, not the browser
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .slice(0, 8000);

  } catch (error) {
    console.error('Scraping error:', error.message);
    throw new Error(`Browser fetch failed: ${error.message}`);
  }
}

module.exports = { scrapeJD };
