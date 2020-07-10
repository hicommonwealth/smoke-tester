const fs = require('fs');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const ipfsClient = require('ipfs-http-client');
const { performance } = require('perf_hooks');
const Logger = require('js-logger');
const { postToWebhook } = require('./util');

const DRIVER_TIMEOUT = 15000;

const getAllCommunities = async (driver) => {
  Logger.debug('Reading communities from homepage.');
  try {
    const community = await driver.findElements(webdriver.By.className('communities'));
    const elts = await community[0].findElements(webdriver.By.className('home-card'));
    const eltDetails = await Promise.all(elts.map(async (elt) => {
      const text = await elt.getText();
      const id = await elt.getId();
      return { text, id };
    }));
    return { elts, eltDetails };
  } catch (error) {
    return await getAllCommunities(driver);
  }
};

const clickIntoCommunity = async (driver, identifyingText) => {
  Logger.debug('Clicking header logo.');
  const community = identifyingText.split('\n')[0];
  const homeElt = (await driver.findElements(webdriver.By.className('header-logo')))[0];
  await homeElt.click();
  await driver.wait(webdriver.until.elementLocated(webdriver.By.className('communities')), DRIVER_TIMEOUT);
  const { elts } = await getAllCommunities(driver);
  for (let index = 0; index < elts.length; index++) {
    const element = elts[index];
    const text = await element.getText();
    if (text === identifyingText) {
      Logger.debug('Clicking:', community);
      const clickTime = performance.now();
      await element.click();
      await driver.wait(webdriver.until.elementLocated(webdriver.By.className('DiscussionRow')), DRIVER_TIMEOUT);
      const loadTime = performance.now();
      return loadTime - clickTime;
    }
  }
  throw new Error('Failed to locate community:', community);
};

const clickThroughNavItems = async (driver, communityText, webhookUrl) => {
  const communityTitle = communityText.split('\n')[0];
  Logger.debug('Starting clickThroughNavItems:', communityTitle);
  let headerElts = await driver.findElements(webdriver.By.className('NavigationItem undefined'));
  const visited = [];
  while (visited.length < headerElts.length) {
    for (let index = 0; index < headerElts.length; index++) {
      const element = headerElts[index];
      const text = await element.getText();

      if (visited.indexOf(text) === -1) {
        Logger.debug(`Clicking ${text} of ${communityTitle}`);
        visited.push(text);
        await element.click();
        if (text.toLowerCase().indexOf('council') !== -1) {
          await driver.wait(webdriver.until.elementLocated(webdriver.By.className('council-candidates')), DRIVER_TIMEOUT);
          await driver.wait(webdriver.until.elementLocated(webdriver.By.className('CollectiveMember')), DRIVER_TIMEOUT);
        } else if (text.toLowerCase().indexOf('proposal') !== -1) {
          await driver.wait(webdriver.until.elementLocated(webdriver.By.className('proposals-subheader')), DRIVER_TIMEOUT);
          await driver.wait(webdriver.until.elementLocated(webdriver.By.className('ProposalRow')), DRIVER_TIMEOUT);
        } else if (text.toLowerCase().indexOf('discussions') !== -1) {
          await driver.wait(webdriver.until.elementLocated(webdriver.By.className('DiscussionRow')), DRIVER_TIMEOUT);
        } else if (text.toLowerCase().indexOf('validators') !== -1) {
          await driver.wait(webdriver.until.elementLocated(webdriver.By.className('validators-preheader')), DRIVER_TIMEOUT);
          await driver.wait(webdriver.until.elementLocated(webdriver.By.className('ValidatorRow')), DRIVER_TIMEOUT);
          await driver.wait(webdriver.until.elementLocated(webdriver.By.className('val-action')), DRIVER_TIMEOUT);
        }
        const image = await driver.takeScreenshot();
        fs.writeFileSync(`output/${communityTitle}-2-${text.toLowerCase()}.png`, image, 'base64');
        break;
      }

      await clickIntoCommunity(driver, communityText);
      headerElts = await driver.findElements(webdriver.By.className('NavigationItem undefined'));
    }
  }
};

const runThroughFlows = async (event, driver, identifier) => {
  Logger.debug('Running through community flows.');

  // gather all communities
  const { elts } = await getAllCommunities(driver);
  const texts = await Promise.all(elts.map((e) => e.getText()));
  for (const text of texts) {
    const community = text.split('\n')[0];
    try {
      // first navigate to discussion page and screenshot it
      const loadTime = await clickIntoCommunity(driver, text);
      postToWebhook(`⏰ Load time for ${community} discussions: ${loadTime.toFixed(2)}ms.`);

      const image = await driver.takeScreenshot();
      fs.writeFileSync(`output/${community}-1-homepage.png`, image, 'base64');

      // then click through the sidebar/navigation menu
      await clickThroughNavItems(driver, text, event.webhookUrl);
      postToWebhook(`✅ Automated tests succeeded for ${community}.`);
    } catch (e) {
      postToWebhook(`❌ Automated tests failed for ${community}. \n ${e.message}`);
    }
  }
};

const setupDriver = (event) => {
  Logger.debug('Setting up headless browser driver');
  const builder = new webdriver.Builder().forBrowser('chrome');
  const chromeOptions = new chrome.Options();
  const defaultChromeFlags = [
    '--headless',
    '--disable-gpu',
    '--window-size=1280x1696', // Letter size
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--homedir=/tmp',
    '--single-process',
    '--data-path=/tmp/data-path',
    '--disk-cache-dir=/tmp/cache-dir',
    '--user-data-dir=/tmp/user-data',
    '--hide-scrollbars',
    '--log-level=0',
    '--v=99',
    '--ignore-certificate-errors',
  ];

  chromeOptions.addArguments(defaultChromeFlags);
  builder.setChromeOptions(chromeOptions);

  const driver = builder
    .withCapabilities(webdriver.Capabilities.chrome())
    .build();
  return driver;
};

const uploadPicsToIpfs = async (webhookUrl) => {
  Logger.debug('Uploading screenshots to IPFS');
  try {
    const ipfs = ipfsClient('/ip4/127.0.0.1/tcp/5001');
    const pics = fs.readdirSync('output');
    const files = pics.map((p) => ({
      path: p,
      content: fs.readFileSync(`output/${p}`),
    }));

    const result = await ipfs.add(files, { recursive: true});

    const urls = [];
    result.forEach(r => {
      urls.push([
        `https://ipfs.io/ipfs/${r.hash}`,
        r.path.split('.png')[0],
      ].join(' - '));
    });
    postToWebhook(urls.join('\n'));
  } catch (e) {
    postToWebhook('No IPFS client available - results will not be posted');
  }
}

const testUi = async () => {
  Logger.info('Running UI smoke tests');
  if (!fs.existsSync('output/')) {
    fs.mkdirSync('output/');
  }
  const event = {
    url: 'https://commonwealth.im',
    webhookUrl: process.env.WEBHOOK_URL,
  };
  const driver = setupDriver(event);
  Logger.info('Driver setup complete. Starting headless browser now');
  driver.get(event.url);
  await runThroughFlows(event, driver);
  await uploadPicsToIpfs(event.webhookUrl);
  driver.close();
  driver.quit();
  Logger.info('Driver quit, all done\n');
}

module.exports = testUi;
