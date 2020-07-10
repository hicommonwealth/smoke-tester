const fs = require('fs');
const ncu = require('npm-check-updates');
const { postToWebhook } = require('./util');

const checkDependencies = async () => {
  console.log('Checking for dependency updates');
  const pkg = fs.readFileSync(`${__dirname}/../../commonwealth/package.json`, 'utf-8');
  const parsedPkg = JSON.parse(pkg);
  const upgraded = await ncu.run({
    pre: 1,
    jsonUpgraded: true,
    packageManager: 'npm',
    packageData: pkg
  });
  var filtered = Object.fromEntries(
    Object.entries(upgraded)
      .filter(([k,v]) => k.includes('polkadot'))
      .map(([k,v]) => ([k, `${parsedPkg['dependencies'][k]} --> ${v}`]))
  )
  await postToWebhook(`\`\`\`Polkadot dependencies to upgrade ${JSON.stringify(filtered, null, 4)}\`\`\``);
};

module.exports = checkDependencies;

