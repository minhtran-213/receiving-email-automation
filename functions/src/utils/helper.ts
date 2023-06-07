import { client } from './oauth'
import { google } from 'googleapis'

const gmail = google.gmail('v1')

export const getMessageById = (messageId: string) => {
  return gmail.users.messages.get({
    auth: client,
    id: messageId,
    userId: 'me',
  })
}

export const listMessagesIds = async () => {
  return gmail.users.messages
    .list({
      auth: client,
      userId: 'me',
    })
    .then((res) => res.data)
}
