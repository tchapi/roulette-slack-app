const dotenv = require('dotenv');
dotenv.config()

const { excludedAccounts, emails, includeRestricted } = require('../config')

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
      .filter(u => !excludedAccounts.includes(u.id) && !u.deleted && !u.is_bot && (!u.is_restricted || includeRestricted) )
      .map((u) => {
        return {
          id: u.id,
          real_name: (u.profile.real_name || u.real_name).toLowerCase().replace('.', ' ').replace(/(^|\s)\S/g, l => l.toUpperCase()),
          email: emails[u.id]
        }
      });
  } catch (error) {
    console.error(error);
  }
  return [];
}

const chooseActiveUsers = async (app, userList, count = 1, needsShuffle = true) => {
  if (count === 0) {
    return [];
  }
  if (userList.length === 0) {
    console.error('No user is active at the moment');
    return [];
  }
  if (needsShuffle) {
    shuffle(userList)
  }
  user = userList.pop()

  // Check if user is active or not
  try {
    const result = await app.client.users.getPresence({
      token: process.env.SLACK_BOT_TOKEN,
      user: user.id
    });
    
    if (result.presence === 'active') {
      return [user].concat(await chooseActiveUsers(app, userList, count - 1, false));
    }
  } catch (error) {
    console.error(error);
  }

  return await chooseActiveUsers(app, userList, count, false);
}

const postZoomLinkTo = async (app, userList, link) => {
    for (var user of userList) {
      const pairedNames = userList.filter(u => u.id !== user.id).map(u => u.real_name).join(', ')
      try {
        const result = await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: user.id,
          text: `Ready for your chat with *${pairedNames}*? See you there: ${link}!`
        });
        console.log(`🗯  ${user.real_name}: Ready for your chat with *${pairedNames}*? See you there: ${link}!`)
        //console.log(result);
      }
      catch (error) {
        console.error(error);
      }
    }
}

module.exports = {
  getAllUsers,
  chooseActiveUsers,
  postZoomLinkTo
}
