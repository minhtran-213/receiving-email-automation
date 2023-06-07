import * as admin from 'firebase-admin'
import * as config from './config/config'
import * as functions from 'firebase-functions'
import * as helper from './utils/helper'
import * as oauth from './utils/oauth'
import * as querystring from 'querystring'

import { google } from 'googleapis'
import { logger } from 'firebase-functions'

const gmail = google.gmail('v1')

export const oauth2init = functions.https.onRequest(
  (req: functions.Request, res: functions.Response) => {
    const scopes = ['https://www.googleapis.com/auth/gmail.modify']

    const authUrl = oauth.client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    })

    return res.redirect(authUrl)
  }
)

export const oauth2Callback = functions.https.onRequest(
  async (req: functions.Request, res: functions.Response) => {
    const code = req.query.code as string

    return oauth.client
      .getToken(code)
      .then(({ tokens }) => {
        oauth.client.setCredentials(tokens)
        return Promise.all([tokens, oauth.getEmailAddress()])
      })
      .then(([tokens, emailAddress]) => {
        return Promise.all([emailAddress, oauth.saveToken(emailAddress)])
      })
      .then(([emailAddress]) => {
        res.redirect(
          `/initWatch?emailAddress=${querystring.escape(emailAddress || '')}`
        )
      })
      .catch((err) => {
        logger.warn('oauth2Callback - Something went wrong\n', err)
        res.status(500).send('Something went wrong, check the logs\n' + err)
      })
  }
)
export const initWatch = functions.https.onRequest(
  async (req: functions.Request, res: functions.Response) => {
    if (!req.query.emailAddress) {
      res.status(400).send('No email address specified!!')
      return
    }

    const email = querystring.unescape(req.query.emailAddress.toString())

    if (!email.includes('@')) {
      res.status(400).send('Invalid email address')
      return
    }

    return oauth.fetchToken(email).then(async () => {
      return gmail.users
        .watch({
          auth: oauth.client,
          userId: 'me',
          requestBody: {
            labelIds: ['INBOX', 'UNREAD'],
            topicName: config.TOPIC_NAME,
          },
        })
        .then(() => {
          res.write('Watch initialized!')
          res.status(200).end()
        })
        .catch((err) => {
          if (err.message === config.UNKNOWN_USER_MESSAGE) {
            res.redirect('/oauth2init')
          } else {
            logger.warn(err)
            res.status(500).send('Something went wrong; check the logs')
          }
        })
    })
  }
)

export const onNewMessage = functions.pubsub
  .topic(config.TOPIC_ID)
  .onPublish(async (message) => {
    const data = message.json
    logger.debug(`Message received: ${data}`)
    return oauth
      .fetchToken(data.emailAddress)
      .then(helper.listMessagesIds)
      .then((res) => res.messages && res.messages[0])
      .then((latestMessage) => {
        if (latestMessage) {
          admin
            .firestore()
            .collection('messages')
            .doc(data.emailAddress)
            .set(latestMessage)
        }
      })
  })
