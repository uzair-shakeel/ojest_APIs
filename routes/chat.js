const express = require('express');
const router = express.Router();
const { createChat, getUserChats, getChatMessages } = require('../controllers/chat');

// Middleware to verify Clerk user
const verifyUser = (req, res, next) => {
    const userId = req.headers['x-clerk-user-id']; // Adjust based on Clerk's header
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.userId = userId;
    next();
};

// Routes
router.post('/create', verifyUser, createChat);
router.get('/my-chats', verifyUser, getUserChats);
router.get('/:chatId/messages', verifyUser, getChatMessages);

module.exports = router;