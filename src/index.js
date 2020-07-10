/* eslint-disable no-return-await */
/* eslint-disable global-require */
/* eslint-disable no-await-in-loop */
require('dotenv').config();
const cron = require('node-cron');
const Logger = require('js-logger');

const testApi = require('./testApi');
const testUi = require('./testUi');
const checkDepedencies = require('./checkDeps');

const SCHEDULE_CRON = process.env.SCHEDULE_CRON === 'true';

const ARGS = process.argv.slice(2);

// set up logging globally
Logger.useDefaults({
  defaultLevel: ARGS.includes('-v') ? Logger.DEBUG : Logger.INFO,
  formatter: function (messages, context) {
      messages.unshift(new Date().toISOString())
  }
})

const runSmokeTest = async () => {
  if (ARGS.some((a) => ['api', 'ui', 'deps'].includes(a))) {
    if (ARGS.includes('api')) {
      await testApi();
    }
    if (ARGS.includes('ui')) {
      await testUi();
    }
    if (ARGS.includes('deps')) {
      await checkDepedencies();
    }
  } else {
    // no args = do everything
    await testApi();
    await testUi();
    await checkDepedencies();
  }
  Logger.info('Test(s) completed.');
  process.exit(0);
}

if (SCHEDULE_CRON) {
  Logger.info('Scheduling smoke tests...');
  cron.schedule('0 */3 * * *', async () => {
    Logger.info(`Running smoke test at ${new Date(Date.now()).toTimeString()}`);
    await runSmokeTest();
  });
} else {
  Logger.info('Running smoke tests now...');
  runSmokeTest();
}
