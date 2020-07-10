const request = require('superagent');
const Logger = require('js-logger');

const postToWebhook = async (message) => {
  Logger.warn(`POST: ${message}`);
  if (process.env.WEBHOOK_URL) {
    const data = JSON.stringify({ text: message });
    return request.post(process.env.WEBHOOK_URL)
      .set('Content-Type', 'application/json')
      .send(data);
  } else {
    return;
  }
};

module.exports.postToWebhook = postToWebhook;
