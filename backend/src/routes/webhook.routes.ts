import { Router } from 'express'
import { handleVerify, handleReceive } from '../webhooks/webhookController.js'

export const webhookRouter = Router()

webhookRouter.get('/webhook', handleVerify)
webhookRouter.post('/webhook', handleReceive)
