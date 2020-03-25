const request = require('request');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken')
const { App } = require('@slack/bolt');
const { getAllUsers, chooseActiveUser, postZoomLinkTo } = require('./utils/helpers');

dotenv.config()
console.log("🛠 Config read from .env file")

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const payload = {
    iss: process.env.ZOOM_API_KEY,
    exp: ((new Date()).getTime() + 5000)
};
const zoomToken = jwt.sign(payload, process.env.ZOOM_API_SEC);
console.log(`🔐 Zoom token created: ${zoomToken}`)

const meetingOptions = (email) => ({
  method: 'POST',
  url: `https://api.zoom.us/v2/users/${encodeURIComponent(email)}/meetings`,
  headers: {
    'content-type': 'application/json',
    authorization: 'Bearer ' + zoomToken
  },
  body: {
    topic: 'Stim Roulette',
    type: 1, // Instant meeting
    settings: {
      audio: 'voip',
      host_video: true,
      participant_video: true
    }
  },
  json: true
});

getAllUsers(app).then((users) => {
  console.log(`👪 We have ${users.length} users :`)
  console.log(users)

  // Listen for a slash command
  app.command('roulette', async ({ ack, context, payload }) => {
    ack();

    // Find requesting user
    const requestingUser = users.find(u => u.id === payload.user);

    console.log(`Received a /roulette command from ${requestingUser.real_name} (${requestingUser.email})`);

    // Choose one random active user
    const randomUser = await chooseActiveUser(app, users, true)

    // Create a meeting for them
    request(meetingOptions(requestingUser.email), async (error, response, body) => {
      if (error) throw new Error(error);

      console.log(body);

      // Send the meeting details to both in DM
      await postZoomLinkTo(app, requestingUser.id, randomUser.id, body.join_url);
    });
  });
});

(async () => {
  const port = process.env.PORT || 4000
  await app.start(port);
  console.log(`⚡️ STIM Slack app is running on port ${port}`);
})();
