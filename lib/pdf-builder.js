const puppeteer = require('puppeteer');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

const CSS = `
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    line-height: 1.4;
    color: #333;
    margin: 40px;
    font-size: 11pt;
  }
  h1 { font-size: 24pt; margin-bottom: 5px; color: #000; text-align: center; }
  h2 { font-size: 16pt; border-bottom: 1px solid #ccc; margin-top: 20px; padding-bottom: 3px; color: #2c3e50; text-transform: uppercase; }
  h3 { font-size: 12pt; margin-top: 15px; margin-bottom: 5px; }
  p { margin: 5px 0; }
  ul { margin: 5px 0; padding-left: 20px; }
  li { margin-bottom: 3px; }
  a { color: #3498db; text-decoration: none; }
  hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
  .contact-info { text-align: center; margin-bottom: 20px; font-size: 10pt; color: #666; }
`;

async function buildPdf(markdown, title) {
  const htmlContent = md.render(markdown);
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>${CSS}</style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: {
      top: '0.5in',
      right: '0.5in',
      bottom: '0.5in',
      left: '0.5in'
    },
    printBackground: true
  });

  await browser.close();
  return pdfBuffer;
}

module.exports = { buildPdf };
