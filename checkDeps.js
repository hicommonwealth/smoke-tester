const fs = require('fs');
const ncu = require('npm-check-updates');
const smoker = require('./');

const checkDependencies = async () => {
  const upgraded = await ncu.run({
    jsonUpgraded: true,
    packageManager: 'npm',
    silent: true,
    packageData: fs.readFileSync(`${__dirname}/../commonwealth/package.json`, 'utf-8')
  });
  var filtered = Object.fromEntries(Object.entries(upgraded).filter(([k,v]) => k.includes('polkadot')));
  console.log('Polkadot dependencies to upgrade', filtered);
  await smoker.postToWebhook(`\`\`\`Polkadot dependencies to upgrade ${JSON.stringify(filtered, null, 4)}\`\`\``);
};

module.exports = checkDependencies;

