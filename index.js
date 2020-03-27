const request = require('request');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken')
const { App, LogLevel } = require('@slack/bolt');
const { getAllUsers, filterUsersByChannel, chooseActiveUsers, postZoomLinkTo } = require('./utils/helpers');

dotenv.config()
console.log("🛠  Config read from .env file")

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.INFO,
  // endpoints: { // Just for reference since there is no documentation for that
  //   events: '/slack/events',
  //   commands: '/slack/events' 
  // }
});

const payload = {
    iss: process.env.ZOOM_API_KEY,
    exp: ((new Date()).getTime() + 5000)
};
const zoomToken = jwt.sign(payload, process.env.ZOOM_API_SEC);
console.log(`🔐 Zoom token created`)

const meetingOptions = (email) => ({
  method: 'POST',
  url: `https://api.zoom.us/v2/users/${encodeURIComponent(email)}/meetings`,
  headers: {
    'content-type': 'application/json',
    authorization: 'Bearer ' + zoomToken
  },
  body: {
    topic: process.env.ZOOM_TOPIC,
    type: 1, // Instant meeting
    settings: {
      audio: 'voip',
      host_video: true,
      participant_video: true
    }
  },
  json: true
});

app.error((error) => {
  // Check the details of the error to handle cases where you should retry sending a message or stop the app
  console.error(error);
});

getAllUsers(app).then((users) => {
  console.log(`👪 We have ${users.length} users in the workspace`)

  app.command('/roulette', async ({ack, respond, payload }) => {
    ack();

    if (payload.channel_name === 'privategroup') {
      respond({
        text: 'You are not allowed to run `/roulette` in a private group.',
        response_type: 'ephemeral'
      });
      return
    }
    // Find requesting user
    const requestingUser = users.find(u => u.id === payload.user_id);

    if (!requestingUser) {
      respond({
        text: 'You are not allowed to run this command.',
        response_type: 'ephemeral'
      });
      return
    }

    console.log(new Date().toISOString())
    console.log(`⏩ Received a /roulette${payload.text?' '+payload.text:''} command from ${requestingUser.real_name} (${payload.user_id}) in ${payload.channel_name} (${payload.channel_id})`);

    // Choose one random active user
    let randomUsers = []
    if (payload.text === "duo") {
      // Choose all active users of the channel
      randomUsers = await filterUsersByChannel(app, users, payload.channel_id)
      console.log(`ℹ️  There are ${randomUsers.length} users in ${payload.channel_name}.`);
    } else {
      randomUsers = [requestingUser].concat(await chooseActiveUsers(app, users, 1, true))
    }

    if (randomUsers.length < 2) {
      respond({
        text: 'Not enough active users. Try again later!',
        response_type: 'ephemeral'
      });
      return
    }

    console.log(`⏯  Creating random roulette between ${randomUsers.map(u => u.real_name).join(', ')}.`);

    // Pair them 2 by 2
    let userA = null
    let userB = null
    while (randomUsers.length >= 4) {
      // Take two out of the users, create a meeting
      userA = randomUsers.pop()
      userB = randomUsers.pop()
      request(meetingOptions(userA.email), async (error, response, body) => {
        if (!('join_url' in body) && ('message' in body)) {
          respond({
            text: `There was a problem with the Zoom API: ${body.message || error}`,
            response_type: 'ephemeral'
          })
          console.log(`🚫 There was a problem with the Zoom API: ${body.message || error}`)
          return
        }

        // Send the meeting details to both in DM
        await postZoomLinkTo(app, [userA, userB], body.join_url);
        console.log(`✅ Sent link ${body.join_url} to ${userA.real_name} and ${userB.real_name}`);
      });
    }

    // finally, remaining duo or trio
    request(meetingOptions(randomUsers[0].email), async (error, response, body) => {
      if (!('join_url' in body) && ('message' in body)) {
        respond({
          text: `There was a problem with the Zoom API: ${body.message || error}`,
          response_type: 'ephemeral'
        })
        console.log(`🚫 There was a problem with the Zoom API: ${body.message || error}`)
        return
      }

      // Send the meeting details to both in DM
      await postZoomLinkTo(app, randomUsers, body.join_url);
      console.log(`✅ Sent link ${body.join_url} to ${randomUsers.map(u => u.real_name).join(', ')}`);
    });

    respond({
      text: `Creating random roulette between ${randomUsers.map(u => u.real_name).join(', ')}. They have been notified!`,
      response_type: 'ephemeral'
    })
  });
});

(async () => {
  const port = process.env.PORT || 4000
  await app.start(port);
  console.log(`⚡️ Roulette Slack app is running on port ${port}`);
})();
