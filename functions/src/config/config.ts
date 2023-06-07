import * as config from './config.json'

const GCF_REGION = config.GCF_REGION
const GLCOUD_PROJECT = config.GCLOUD_PROJECT
export const TOPIC_ID = config.TOPIC_ID

export const GCF_BASE_URL = `https://${GCF_REGION}-${GLCOUD_PROJECT}.cloudfunctions.net`
export const TOPIC_NAME = `projects/${GLCOUD_PROJECT}/topics/${TOPIC_ID}`
export const UNKNOWN_USER_MESSAGE = 'Uninitialized email address'
