const db = require('../dbService.js'); // Database service
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const dbService = db.getDbServiceInstance();

const authenticate = async (req, res) => {
    const { user_email, user_password } = req.body;
    if (!user_email || !user_password) {
        return res.status(400).json({ error: 'Please enter both email and password' });
    }

    try {
        const user = await dbService.getUser(user_email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const isMatch = await bcrypt.compare(user_password, user.user_password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        const payload = {
            user_id: user.user_id,
            user_email: user.user_email,
            user_role: user.user_role,
        };
        const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
        return res.status(200).json({ message: 'Authentication successful', token });
    } catch (err) {
        console.error('Error during authentication:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const logout = (req, res) => {
    const token = req.headers['x-observatory-auth'];

    if (!token) {
        return res.status(400).json({ error: 'Token not found' });
    }

    try {
        jwt.verify(token, config.jwtSecret);
        return res.status(200).json({ message: 'Logout Successful' });
    } catch (error) {
        return res.status(400).json({ error: 'Invalid Token' });
    }
};

const whoami = (req, res) => {
    const token = req.headers['x-observatory-auth'];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Token missing' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        return res.status(200).json({
            user_email: decoded.user_email,
            user_role: decoded.user_role,
        });
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

module.exports = { authenticate, logout, whoami };
