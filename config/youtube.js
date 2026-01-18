const { google } = require('googleapis')

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
})

module.exports = {
  youtube,
  channelId: process.env.YOUTUBE_CHANNEL_ID,
  notificationChannelId: process.env.NOTIFICATION_CHANNEL_ID,
  setupDate: process.env.YOUTUBE_CHANNEL_SETUP_DATE,
}
