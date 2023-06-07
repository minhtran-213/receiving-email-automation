import * as admin from 'firebase-admin'
import * as clientSecretJson from './client_secret.json'
import * as config from '../config/config'
import * as logger from 'firebase-functions/logger'

import { google } from 'googleapis'

admin.initializeApp()

const oauth2Client = new google.auth.OAuth2(
  clientSecretJson.web.client_id,
  clientSecretJson.web.client_secret,
  `${config.GCF_BASE_URL}/oauth2Callback`
)
logger.debug(`Base url: ${config.GCF_BASE_URL}`)
export const client = oauth2Client
const datastore = admin.firestore()

export const getEmailAddress = async () => {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const response = await gmail.users.getProfile({
    userId: 'me',
  })

  return response.data.emailAddress
}

export const fetchToken = async (email: string) => {
  const documentRef = datastore.collection('oauth2Token').doc(email)
  const snapshot = await documentRef.get()
  const token = snapshot.data()

  if (!token) {
    throw new Error(config.UNKNOWN_USER_MESSAGE)
  }

  if (!token.expiry_date || token.expiry_date < Date.now() + 60000) {
    oauth2Client.setCredentials({
      refresh_token:
        oauth2Client.credentials.refresh_token || token.refresh_token,
      access_token: oauth2Client.credentials.access_token,
    })

    try {
      await oauth2Client.refreshAccessToken()
      await saveToken(email)
    } catch (err) {
      logger.warn('fetchToken: Something went wrong\n', err)
      throw err
    }
  } else {
    oauth2Client.setCredentials(token)
  }
}

export const saveToken = async (email: string | undefined | null) => {
  const documentRef = datastore.collection('oauth2Token').doc(email as string)
  await documentRef.set(oauth2Client.credentials)
}
