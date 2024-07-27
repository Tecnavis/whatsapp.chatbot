import { Router } from "express";
import {ChatBotStart} from '../../controllers/ChatBotStart.js'
const router = Router()

router.get('/qr',ChatBotStart)

export default router