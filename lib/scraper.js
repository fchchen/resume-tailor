const { getBrowser } = require('./browser');

async function scrapeJD(url) {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Invalid protocol: ${parsedUrl.protocol}. Only http and https are supported.`);
    }
  } catch (err) {
    throw new Error(`Invalid URL: ${err.message}`);
  }

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const metadata = await page.evaluate(() => {
      // Find company
      let company = '';
      
      // Selectors for common sites
      const companySelectors = [
        '.jobsearch-CompanyReview--title', // Indeed
        '.jobsearch-JobInfoHeader-companyName', // Indeed
        '.topcard__org-name-link', // LinkedIn
        '.top-card-layout__first-subline .topcard__org-name-link', // LinkedIn
        '[class*="companyName"]',
        '[class*="employer-name"]'
      ];

      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) {
          company = el.innerText.trim();
          break;
        }
      }

      // Meta tags fallback
      if (!company) {
        const ogSite = document.querySelector('meta[property="og:site_name"]');
        if (ogSite) company = ogSite.content;
      }

      // Title parsing fallback (e.g. "Software Engineer at Acme")
      if (!company) {
        const title = document.title;
        if (title.includes(' at ')) {
          company = title.split(' at ')[1].split('|')[0].split('-')[0].trim();
        }
      }

      // Clean noise
      const scripts = document.querySelectorAll('script, style, nav, footer, header, noscript, iframe');
      scripts.forEach(s => s.remove());

      const jdSelectors = [
        '#jobDescriptionText',
        '.jobsearch-JobComponent-description', 
        '.description',
        'main',
        'article',
        'body'
      ];

      let description = '';
      for (const selector of jdSelectors) {
        const el = document.querySelector(selector);
        if (el && el.innerText.length > 200) {
          description = el.innerText;
          break;
        }
      }
      if (!description) description = document.body.innerText;

      return { company, description };
    });

    await page.close();
    
    return {
      company: metadata.company,
      description: metadata.description
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()
        .slice(0, 8000)
    };

  } catch (error) {
    console.error('Scraping error:', error.message);
    throw new Error(`Scrape failed: ${error.message}`);
  }
}

module.exports = { scrapeJD };
