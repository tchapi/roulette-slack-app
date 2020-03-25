const request = require('request');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken')
const { App } = require('@slack/bolt');
const { getAllUsers, chooseActiveUsers, postZoomLinkTo, alertUser } = require('./utils/helpers');

dotenv.config()
console.log("🛠 Config read from .env file")

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
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

getAllUsers(app).then((users) => {
  console.log(`👪 We have ${users.length} users in the workspace`)
  //console.log(users.map(u => u.real_name))

  app.command('roulette', async ({ command, ack, payload }) => {
    ack();

    console.log(command);

    // Find requesting user
    const requestingUser = users.find(u => u.id === payload.user);
    console.log(`⏩ Received a /roulette command from ${requestingUser.real_name}`);

    // Choose one random active user
    const randomUsers = await chooseActiveUsers(app, users, 1, true)

    // Create a meeting for them
    request(meetingOptions(requestingUser.email), async (error, response, body) => {
      if (error) {
        alertUser(app, payload.channel, payload.user, 'You have reached the API limit of 100 meetings / day. See you tomorrow!')
        return
      }
      // Send the meeting details to both in DM
      await postZoomLinkTo(app, [requestingUser, randomUsers[0]], body.join_url);
      console.log(`✅ Sent link ${body.join_url} to ${requestingUser.real_name} and ${randomUsers[0].real_name}`);
    });
  });

  app.command('roulette-4', async ({ ack, payload }) => {
    ack();

    // Find requesting user
    const requestingUser = users.find(u => u.id === payload.user);
    console.log(`⏩ Received a /roulette-4 command from ${requestingUser.real_name}`);

    // Choose four random active user in the channel
    const randomUsers = await chooseActiveUsers(app, users, 4, true)

    if (randomUsers.length === 1) {
      alertUser(app, payload.channel, payload.user, 'Il n\'a qu\'un seul utilisateur actif. Tentez plus tard!')
    } else if (randomUsers.length === 4) {
      // Create a meeting for them - First couple
      request(meetingOptions(randomUsers[0].email), async (error, response, body) => {
        if (error) {
          alertUser(app, payload.channel, payload.user, 'You have reached the API limit of 100 meetings / day. See you tomorrow!')
          return
        }

        // Send the meeting details to both in DM
        await postZoomLinkTo(app, [randomUsers[0], randomUsers[1]], body.join_url);
        console.log(`✅ Sent link ${body.join_url} (1/2) to ${randomUsers[0].real_name} and ${randomUsers[1].real_name}`);
      });

      // Create a meeting for them - Second couple
      request(meetingOptions(randomUsers[2].email), async (error, response, body) => {
        if (error) {
          alertUser(app, payload.channel, payload.user, 'You have reached the API limit of 100 meetings / day. See you tomorrow!')
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
          alertUser(app, payload.channel, payload.user, 'You have reached the API limit of 100 meetings / day. See you tomorrow!')
          return
        }

        // Send the meeting details to both in DM
        await postZoomLinkTo(app, randomUsers, body.join_url);
        console.log(`✅ Sent link ${body.join_url} to ${randomUsers.length} users`);
      });
    }
  });
});

(async () => {
  const port = process.env.PORT || 4000
  await app.start(port);
  console.log(`⚡️ Roulette Slack app is running on port ${port}`);
})();
