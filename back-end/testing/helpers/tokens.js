const jwt = require('jsonwebtoken');
const config = require('../../config');

// Sign a token exactly the way the app would, so the middleware accepts it.
function makeToken(payload, opts = {}) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h', ...opts });
}

const tokens = {
    admin: () => makeToken({ user_id: 1, user_email: 'admin@yme.gov.gr', user_role: 'admin' }),
    company: (role = 'neaodos') =>
        makeToken({ user_id: 2, user_email: `admin@${role}.example`, user_role: role }),
    demo: () => makeToken({ user_email: config.demo.email, user_role: 'demo' }),
    expired: (role = 'demo') =>
        makeToken({ user_email: 'x@x.example', user_role: role }, { expiresIn: -10 }),
    // A token whose payload claims admin but is signed with the wrong key.
    forged: () =>
        jwt.sign({ user_role: 'admin' }, 'not-the-real-secret', { expiresIn: '1h' }),
};

module.exports = { makeToken, tokens };
