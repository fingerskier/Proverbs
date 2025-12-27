# Agent Instructions

Instructions for AI agents working on the Proverbs codebase.

## Project Overview

Proverbs is an Express.js application for browsing biblical proverbs with vector-based semantic search capabilities. It features a public interface for browsing and an admin interface for management.

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL with pgvector extension
- **Auth**: Passport.js with Google OAuth 2.0
- **Frontend**: Vanilla HTML/CSS (server-rendered)
- **Sessions**: PostgreSQL-backed via connect-pg-simple

## Key Files

| File | Purpose |
|------|---------|
| `src/server.js` | Application entry point, middleware setup |
| `src/db/index.js` | Database connection pool |
| `src/db/migrate.js` | Database schema migrations |
| `src/config/passport.js` | Google OAuth configuration |
| `src/middleware/auth.js` | Authentication middleware |
| `src/routes/index.js` | Public routes with HTML generation |
| `src/routes/auth.js` | Authentication routes |
| `src/routes/admin.js` | Admin routes with HTML generation |
| `src/routes/api.js` | JSON API endpoints |

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start with nodemon (auto-reload)
npm start            # Production start
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed sample proverbs
```

## Database

### Connection
Database connection uses `DATABASE_URL` environment variable. The pool is configured in `src/db/index.js`.

### Tables
- `users`: User accounts with `is_admin` boolean flag
- `proverbs`: Chapter, verse, text, and vector(1536) for embeddings
- `sessions`: Express session storage

### pgvector
The application uses pgvector for similarity search:
- Vectors are 1536 dimensions (OpenAI ada-002 compatible)
- Index uses IVFFlat with cosine similarity
- Query with `vector <=> $1::vector` for similarity

## Authentication Flow

1. User clicks "Login with Google"
2. Redirected to `/auth/google`
3. Passport initiates Google OAuth flow
4. Callback at `/auth/google/callback`
5. User created/updated in database
6. Session established

## Admin Authorization

Admin status is determined by `is_admin` boolean in users table. The `isAdmin` middleware in `src/middleware/auth.js` protects admin routes.

## HTML Generation

This project uses server-side HTML generation (no template engine). HTML is generated in route handler functions:
- `generateHomePage()` in `src/routes/index.js`
- `generateChapterPage()` in `src/routes/index.js`
- `generateAdminDashboard()` in `src/routes/admin.js`
- etc.

## Adding New Features

### Adding a new route
1. Create route file in `src/routes/`
2. Import and use in `src/server.js`
3. Add middleware as needed (`isAuthenticated`, `isAdmin`)

### Adding a new API endpoint
1. Add to `src/routes/api.js`
2. Use `db.query()` for database operations
3. Return JSON with `res.json()`

### Modifying the database schema
1. Update `src/db/migrate.js`
2. Run `npm run db:migrate`
3. Update relevant route handlers

## Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `GOOGLE_CLIENT_SECRET`: OAuth client secret

Optional:
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `GOOGLE_CALLBACK_URL`: OAuth callback URL

## Error Handling

- Database errors are logged and return 500 status
- Auth failures redirect to login page
- Admin access denied returns 403 with HTML page

## Testing

Currently no automated tests. When adding tests:
- Use Jest or Mocha
- Mock database connections
- Test routes with supertest

## Security Considerations

- All admin routes require `is_admin` check
- Sessions use secure cookies in production
- Google OAuth handles password security
- SQL queries use parameterized statements
- User input is not directly rendered (XSS protection)

## Common Tasks

### Make a user admin
```sql
UPDATE users SET is_admin = true WHERE email = 'user@example.com';
```

### Add vector to proverb
```bash
curl -X PUT http://localhost:3000/api/proverbs/1/vector \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"vector": [...]}'
```

### Query similar proverbs
```bash
curl -X POST http://localhost:3000/api/search/similar \
  -H "Content-Type: application/json" \
  -d '{"vector": [...]}'
```
