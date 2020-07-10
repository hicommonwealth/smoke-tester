const request = require('superagent');
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { bnToBn } = require('@polkadot/util/bn');
const { u128 } = require('@polkadot/types');
const { IdentityTypes } = require('edgeware-node-types/dist/identity');
const { SignalingTypes } = require('edgeware-node-types/dist/signaling');
const { VotingTypes } = require('edgeware-node-types/dist/voting');
const { performance } = require('perf_hooks');
const Logger = require('js-logger');

const { postToWebhook } = require('./util');

const runAPITest = async (nodeUrl, types) => {
  return new Promise(async (resolve, reject) => {
    Logger.debug(`Connecting to API for ${nodeUrl}...`);
    let connected;
    setTimeout(() => {
      if (connected) return;
      reject(new Error('API connection timeout'));
    }, 10000);

    // initialize the api
    const api = await ApiPromise.create({
      provider: new WsProvider(nodeUrl),
      types,
    });
    connected = true;

    //
    // get relevant chain data
    //
    try {
      const [issuance, properties, block] = await Promise.all([
        api.query.balances.totalIssuance(),
        api.rpc.system.properties(),
      ]);
      const tokenDecimals = properties.tokenDecimals.unwrap().toString(10);
      const issuanceStr = issuance.div(bnToBn(10).pow(bnToBn(tokenDecimals))).toString(10);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

const testApi = async () => {
  Logger.info('Running API smoke tests');
  const req = await request.get('https://edgeware-supply.now.sh/');
  const supplyIsValid = JSON.stringify(JSON.parse(req.text)) === req.text;
  if (supplyIsValid) {
    postToWebhook(`✅ Edgeware supply endpoint returns valid result: ${req.text}`);
  } else {
    postToWebhook(`❌ Edgeware supply endpoint returns invalid result: ${req.text}`);
  }

  const nodes = [
    [ 'edgeware', 'ws://mainnet1.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet2.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet3.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet4.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet5.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet6.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet7.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet8.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet9.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet10.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet11.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet12.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet13.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet14.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet15.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet16.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet17.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet18.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet19.edgewa.re:9944', ],
    [ 'edgeware', 'ws://mainnet20.edgewa.re:9944', ],
    [ 'kusama', 'wss://kusama-rpc.polkadot.io' ],
    [ 'polkadot', 'wss://rpc.polkadot.io' ],
  ];

  for ([ chain, nodeUrl ] of nodes) {
    try {
      let types = {};
      if (chain === 'edgeware') {
        types = {
          ...IdentityTypes,
          ...SignalingTypes,
          ...VotingTypes,
          Balance2: u128,
        };
      }

      const tStart = performance.now();
      await runAPITest(nodeUrl, types);
      const tEnd = performance.now();
      const tMs = (tEnd - tStart);
      // TODO: send this out to metrics/instrumentation

      postToWebhook(`✅ Polkadot API connection test succeeded for ${nodeUrl} in ${tMs.toFixed(2)}ms.`);
    } catch (e) {
      postToWebhook(`❌ Polkadot API connection test failed for ${nodeUrl}: ${e.message}.`);
    }
  }
}

module.exports = testApi;
