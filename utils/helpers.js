const dotenv = require('dotenv');
dotenv.config()

const { excludedAccounts, emails } = require('../config')

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

const getAllUsers = async (app) => {
  try {
    const result = await app.client.users.list({
      token: process.env.SLACK_BOT_TOKEN
    });

    return result.members
      .filter(u => !excludedAccounts.includes(u.id) && !u.deleted && !u.is_bot && !u.is_restricted)
      .map((u) => {
        return { id: u.id, real_name: u.profile.real_name || u.real_name, email: (emails[u.id] || u.name) + '@wearestim.com' }
      });
  } catch (error) {
    console.error(error);
  }
  return [];
}

const chooseActiveUser = async (app, userList, needsShuffle = true) => {
  if (userList.length == 0) {
    console.error('No user is active at the moment');
    return [];
  }
  if (needsShuffle) {
    shuffle(userList)
  }
  user = userList.pop()

  // Check if user is present
  try {
    const result = await app.client.users.getPresence({
      token: process.env.SLACK_BOT_TOKEN,
      user: user.id
    });
    
    if (result.presence == 'active') {
      return user;
    }
  } catch (error) {
    console.error(error);
  }

  return chooseActiveUser(app, userList, false);
}

const postZoomLinkTo = async (app, userA, userB, link) => {
    try {
      const result = await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: userA.id,
        text: `Here is your roulette with *${userB.real_name}*: ${link}`
      });
      console.log(result);
    }
    catch (error) {
      console.error(error);
    }
    try {
      const result = await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: userB.id,
        text: `Here is your roulette with *${userA.real_name}*: ${link}`
      });
      console.log(result);
    }
    catch (error) {
      console.error(error);
    }
}

module.exports = {
  getAllUsers,
  chooseActiveUser,
  postZoomLinkTo
}
