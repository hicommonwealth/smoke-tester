const chromium = require('chrome-aws-lambda');
const aws = require("aws-sdk");
const fs = require('fs');

const PAGES = [
  'edgeware',
  'edgeware/proposals',
  'edgeware/council',
  'edgeware/validators',
  'kusama',
  'kusama/proposals',
  'kusama/council',
  'kusama/validators',
  'near',
  'ethereum',
]

const runHomePage = async (page) => {
  await page.waitUntilVisible('div.communities', timeout = 5000);
  await page.waitUntilVisible('a.home-card', timeout = 5000);
};

const runOtherPages = async (browser, event) => {
  const s3 = new aws.S3();
  const bucket = "commonwealth-smoke-tests";
  await Promise.all(PAGES.map(async p => {
    let page = await browser.newPage();
    await page.goto(`${event.url}/${p}`);
    await page.title();
    if (event.url.indexOf('council') !== -1) {
      await page.waitUntilVisible('div.council-candidates', timeout = 5000);
      await page.waitUntilVisible('a.CouncilCandidate', timeout = 5000);
    } else if (event.url.indexOf('proposal') !== -1) {
      await page.waitUntilVisible('h4.proposals-subheader', timeout = 5000);
      await page.waitUntilVisible('div.ProposalRow', timeout = 5000);
    } else if (event.url.indexOf('discussions') !== -1) {
      await page.waitUntilVisible('a.DiscussionRow', timeout = 5000);
    } else if (event.url.indexOf('validators') !== -1) {
      await page.waitUntilVisible('div.validators-preheader', timeout = 15000);
      await page.waitUntilVisible('tr.ValidatorRow', timeout = 15000);
      await page.waitUntilVisible('td.val-action', timeout = 15000);
    }
    let buffer = await page.screenshot({ type: "png" });
    fs.writeFileSync(`output/${p.replace('/', '-')}.png`, buffer, 'base64');
    // const key = emailSubject+".png";
    // const params = { Bucket: bucket, Key: key, Body: buffer, ContentType: 'image/jpeg', ACL: 'public-read' };
    // await s3.putObject(params).promise();
  }))
};

(async () => {
  const event = {
    url: 'https://commonwealth.im',
    webhookUrl: process.env.WEBHOOK_URL,
  };

// exports.handler = async (event, context) => {
  let result = null;
  let browser = null;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    let page = await browser.newPage();

    await page.goto(event.url);
    result = await page.title();
    await runHomePage(page);
    await runOtherPages(browser, event);
  } catch (error) {
    console.log(error);
    // return context.fail(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  // return context.succeed(result);
// };
})();