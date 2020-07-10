/* eslint-disable no-return-await */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
require('dotenv').config();
const cron = require('node-cron');
const testApi = require('./testApi');
const testUi = require('./testUi');
const checkDepedencies = require('./checkDeps');

const SCHEDULE_CRON = process.env.SCHEDULE_CRON === 'true';

const runSmokeTest = async () => {
  const args = process.argv.slice(2);
  console.log(args);
  if (args) {
    if (args.includes('api')) {
      await testApi();
    }
    if (args.includes('ui')) {
      await testUi();
    }
    if (args.includes('deps')) {
      await checkDepedencies();
    }
  } else {
    // no args = do everything
    await testApi();
    await testUi();
    await checkDepedencies();
  }
}

if (SCHEDULE_CRON) {
  console.log('Scheduling smoke tests...');
  cron.schedule('0 */3 * * *', async () => {
    console.log(`Running smoke test at ${new Date(Date.now()).toTimeString()}`);
    await runSmokeTest();
  });
} else {
  console.log('Running smoke tests now...');
  runSmokeTest();
}
