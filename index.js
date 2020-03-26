const request = require('request');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken')
const { App, LogLevel } = require('@slack/bolt');
const { getAllUsers, chooseActiveUsers, postZoomLinkTo } = require('./utils/helpers');

dotenv.config()
console.log("🛠 Config read from .env file")

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.DEBUG,
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
  //console.log(users.map(u => u.real_name))

  app.command('/roulette', async ({ack, respond, payload }) => {
    ack();

    const isDuo = (payload.text === "duo")

    // Find requesting user
    const requestingUser = users.find(u => u.id === payload.user_id);

    if (!requestingUser) {
      respond({
        message: 'You are not allowed to run this command.',
        response_type: 'ephemeral'
      });
    }

    console.log(`⏩ Received a /roulette command from ${requestingUser.real_name} (${payload.user_id}) in ${payload.channel_name} (${payload.channel_id})`);

    // Choose one random active user
    let randomUsers = []
    if (payload.text === "duo") {
      randomUsers = await chooseActiveUsers(app, users, 4, true)
    } else {
      randomUsers = [requestingUser].concat(await chooseActiveUsers(app, users, 1, true))
    }

    if (randomUsers.length < 2) {
      respond({
        message: 'Il n\'a pas assez d\'utilisateurs actifs. Tentez plus tard!',
        response_type: 'ephemeral'
      });
      return
    }
    console.log(randomUsers)
    console.log(`⏩ Creating random roulette between ${randomUsers.map(u => u.real_name).join(', ')}`);

    if (randomUsers.length === 4) {
      // Create a meeting for them - First couple
      request(meetingOptions(randomUsers[0].email), async (error, response, body) => {
        if (error) {
          respond({
            message: 'You have reached the API limit of 100 meetings / day. See you tomorrow!',
            response_type: 'ephemeral'
          })
          return
        }

        // Send the meeting details to both in DM
        await postZoomLinkTo(app, [randomUsers[0], randomUsers[1]], body.join_url);
        console.log(`✅ Sent link ${body.join_url} (1/2) to ${randomUsers[0].real_name} and ${randomUsers[1].real_name}`);
      });

      // Create a meeting for them - Second couple
      request(meetingOptions(randomUsers[2].email), async (error, response, body) => {
        if (error) {
          respond({
            message: 'You have reached the API limit of 100 meetings / day. See you tomorrow!',
            response_type: 'ephemeral'
          })
          return
        }

        // Send the meeting details to both in DM
        await postZoomLinkTo(app, [randomUsers[2], randomUsers[3]], body.join_url);
        console.log(`✅ Sent link ${body.join_url} (2/2) to ${randomUsers[2].real_name} and ${randomUsers[3].real_name}`);
      });
    } else {
      // Create a meeting for all
      request(meetingOptions(randomUsers[0].email), async (error, response, body) => {
        if (error) {
          respond({
            message: 'You have reached the API limit of 100 meetings / day. See you tomorrow!',
            response_type: 'ephemeral'
          })
          return
        }

        // Send the meeting details to both in DM
        await postZoomLinkTo(app, randomUsers, body.join_url);
        console.log(`✅ Sent link ${body.join_url} to ${randomUsers.map(u => u.real_name).join(', ')}`);
      });
    }

    respond({
      message: `Creating random roulette between ${randomUsers.map(u => u.real_name).join(', ')}`,
      response_type: 'ephemeral'
    })
  });
});

(async () => {
  const port = process.env.PORT || 4000
  await app.start(port);
  console.log(`⚡️ Roulette Slack app is running on port ${port}`);
})();
