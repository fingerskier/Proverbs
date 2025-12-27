const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

function configurePassport(passport) {
  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0] || null);
    } catch (err) {
      done(err, null);
    }
  });

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      let result = await db.query(
        'SELECT * FROM users WHERE google_id = $1',
        [profile.id]
      );

      if (result.rows.length > 0) {
        // User exists, update their info
        result = await db.query(
          `UPDATE users
           SET display_name = $1, avatar_url = $2, updated_at = NOW()
           WHERE google_id = $3
           RETURNING *`,
          [
            profile.displayName,
            profile.photos?.[0]?.value || null,
            profile.id
          ]
        );
        return done(null, result.rows[0]);
      }

      // Create new user
      result = await db.query(
        `INSERT INTO users (google_id, email, display_name, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          profile.id,
          profile.emails?.[0]?.value || '',
          profile.displayName,
          profile.photos?.[0]?.value || null
        ]
      );

      return done(null, result.rows[0]);
    } catch (err) {
      return done(err, null);
    }
  }));
}

module.exports = configurePassport;
