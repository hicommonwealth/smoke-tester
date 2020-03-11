/* eslint-disable no-return-await */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
const fs = require('fs');
const request = require('superagent');
const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const chromedriver = require('chromedriver');
const ipfsClient = require('ipfs-http-client');

const getAllCommunities = async (driver) => {
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
  try {
    const homeElt = (await driver.findElements(webdriver.By.className('header-logo')))[0];
    await homeElt.click();
    await driver.wait(webdriver.until.elementLocated(webdriver.By.className('communities')), 5000);
    const { elts } = await getAllCommunities(driver);
    for (let index = 0; index < elts.length; index++) {
      const element = elts[index];
      const text = await element.getText();
      if (text === identifyingText) {
        await element.click();
        await driver.wait(webdriver.until.elementLocated(webdriver.By.className('DiscussionRow')), 5000);
        break;
      }
    }
  } catch (error) {
    return await clickIntoCommunity(driver, identifyingText);
  }
};

const clickThroughNavItems = async (driver, communityText, webhookUrl) => {
  const communityTitle = communityText.split('\n')[0];
  let headerElts = await driver.findElements(webdriver.By.className('NavigationItem undefined'));
  const visited = [];
  while (visited.length < headerElts.length) {
    for (let index = 0; index < headerElts.length; index++) {
      const element = headerElts[index];
      const text = await element.getText();
      if (visited.indexOf(text) === -1) {
        console.log(`Clicking ${text} of ${communityTitle}`);
        visited.push(text);
        await element.click();
        try {
          if (text.toLowerCase().indexOf('council') !== -1) {
            await driver.wait(webdriver.until.elementLocated(webdriver.By.className('council-candidates')), 5000);
            await driver.wait(webdriver.until.elementLocated(webdriver.By.className('CouncilCandidate')), 5000);
          } else if (text.toLowerCase().indexOf('proposal') !== -1) {
            await driver.wait(webdriver.until.elementLocated(webdriver.By.className('proposals-subheader')), 5000);
            await driver.wait(webdriver.until.elementLocated(webdriver.By.className('ProposalRow')), 5000);
          } else if (text.toLowerCase().indexOf('discussions') !== -1) {
            await driver.wait(webdriver.until.elementLocated(webdriver.By.className('DiscussionRow')), 5000);
          } else if (text.toLowerCase().indexOf('validators') !== -1) {
            await driver.wait(webdriver.until.elementLocated(webdriver.By.className('validators-preheader')), 15000);
            await driver.wait(webdriver.until.elementLocated(webdriver.By.className('ValidatorRow')), 15000);
            await driver.wait(webdriver.until.elementLocated(webdriver.By.className('val-action')), 15000);
          }
          const image = await driver.takeScreenshot();
          fs.writeFileSync(`output/${communityTitle}-2-${text.toLowerCase()}.png`, image, 'base64');
        } catch (e) {
          const msg = `Failed to click into ${text} for ${communityTitle}\n${e.message}`;
          const data = JSON.stringify({ text: msg });
          await request.post(webhookUrl).send(data);
        }
        break;
      }

      await clickIntoCommunity(driver, communityText);
      headerElts = await driver.findElements(webdriver.By.className('NavigationItem undefined'));
    }
  }
};

const runThroughFlows = async (event, driver, identifier) => {
  const { elts, eltDetails } = await getAllCommunities(driver);
  let eelts = elts;
  const seenText = [];
  while (seenText.length < eltDetails.length) {
    for (let index = 0; index < eelts.length; index++) {
      const element = eelts[index];
      const text = await element.getText();
      const communityTitle = text.split('\n')[0];
      if (!seenText.includes(text)) {
        console.log(`Clicking ${communityTitle}`);
        seenText.push(text);
        await element.click();
        await driver.wait(webdriver.until.elementLocated(webdriver.By.className('DiscussionRow')), 5000);
        const image = await driver.takeScreenshot();
        fs.writeFileSync(`output/${communityTitle}-1-homepage.png`, image, 'base64');
        await clickThroughNavItems(driver, text, event.webhookUrl);
        const homeElt = (await driver.findElements(webdriver.By.className('header-logo')))[0];
        await homeElt.click();
        await driver.wait(webdriver.until.elementLocated(webdriver.By.className('communities')), 5000);
        break;
      }
    }

    eelts = await driver.findElements(webdriver.By.className('home-card'));
  }
};

const setupDriver = (event) => {
  chrome.setDefaultService(new chrome.ServiceBuilder(chromedriver.path).build());
  const builder = new webdriver.Builder();
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
    '--enable-logging',
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
  const data = JSON.stringify({ text: urls.join('\n') }, null, 4);
  await request.post(webhookUrl).send(data);
}

(async () => {
  if (!fs.existsSync('output/')) {
    fs.mkdirSync('output/');
  }
  const event = {
    url: 'https://commonwealth.im',
    webhookUrl: process.env.WEBHOOK_URL,
  };
  const driver = setupDriver(event);
  driver.get(event.url);
  await runThroughFlows(event, driver);
  await uploadPicsToIpfs(event.webhookUrl);
  driver.quit();
  process.exit(0);
})();
