Roulette Slack App
---

## Slack App and Zoom App

You must a create a JWT App in the Zoom developer section, and a regular Slack app.

Afterwards, just create a `/roulette` command in your workspace and use the following url if your app listens on port PORT at the domain yourdomain.com :

    https://yourdomain.com:PORT/slack/events

## Local development

Create your own `.env` file and `config.js` from the example files.

Then :

    npm i
    npm run start
