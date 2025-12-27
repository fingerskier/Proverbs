# Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client                                  │
│                    (Web Browser)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express.js Server                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Middleware                            │   │
│  │  • express.json()      • express.static()                │   │
│  │  • express-session     • passport                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                       Routes                              │   │
│  │  • /          (public)    • /auth/*    (authentication)  │   │
│  │  • /admin/*   (admin)     • /api/*     (JSON API)        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ pg (node-postgres)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    users     │  │   proverbs   │  │   sessions   │          │
│  │              │  │              │  │              │          │
│  │ • id         │  │ • id         │  │ • sid        │          │
│  │ • google_id  │  │ • chapter    │  │ • sess       │          │
│  │ • email      │  │ • verse      │  │ • expire     │          │
│  │ • is_admin   │  │ • text       │  │              │          │
│  │ • ...        │  │ • vector     │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                           │                                      │
│                    pgvector extension                            │
│                    (similarity search)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ OAuth 2.0
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Google OAuth                                │
│                   (Authentication)                               │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
Proverbs/
├── src/
│   ├── server.js           # Application entry point
│   ├── config/
│   │   └── passport.js     # OAuth configuration
│   ├── db/
│   │   ├── index.js        # Connection pool
│   │   ├── migrate.js      # Schema migrations
│   │   └── seed.js         # Sample data
│   ├── middleware/
│   │   └── auth.js         # Auth guards
│   └── routes/
│       ├── index.js        # Public routes
│       ├── auth.js         # Auth routes
│       ├── admin.js        # Admin routes
│       └── api.js          # API routes
├── public/
│   └── css/
│       └── style.css       # Styles
├── .env.example
├── package.json
├── README.md
├── AGENT.md
└── ARCH.md
```

## Request Flow

### Public Page Request
```
Browser → GET /chapter/3
    → Express Router (routes/index.js)
    → Database Query (SELECT proverbs WHERE chapter=3)
    → HTML Generation (generateChapterPage)
    → Response (HTML)
```

### Authentication Flow
```
Browser → GET /auth/google
    → Passport Google Strategy
    → Redirect to Google
    → User Authenticates
    → Google redirects to /auth/google/callback
    → Passport validates token
    → Create/Update user in database
    → Establish session
    → Redirect to /
```

### Admin Request
```
Browser → GET /admin/proverbs (with session cookie)
    → Session Middleware (load session from PostgreSQL)
    → Passport Middleware (deserialize user)
    → isAdmin Middleware (check is_admin flag)
    → Admin Route Handler
    → Database Query
    → HTML Generation
    → Response
```

### API Request with Vector Search
```
Browser → POST /api/search/similar
    Body: { vector: [...1536 floats...] }
    → Express JSON Parser
    → Route Handler (routes/api.js)
    → pgvector Query (ORDER BY vector <=> $1)
    → Response (JSON with similar proverbs)
```

## Data Models

### User
```javascript
{
  id: number,           // Primary key (auto-increment)
  google_id: string,    // Google OAuth identifier
  email: string,        // User email (unique)
  display_name: string, // Display name from Google
  avatar_url: string,   // Profile picture URL
  is_admin: boolean,    // Admin privilege flag
  created_at: Date,     // Creation timestamp
  updated_at: Date      // Last update timestamp
}
```

### Proverb
```javascript
{
  id: number,           // Primary key (auto-increment)
  chapter: number,      // Chapter number (1-31)
  verse: number,        // Verse number within chapter
  text: string,         // Proverb text content
  vector: float[1536],  // Embedding vector (nullable)
  created_at: Date,     // Creation timestamp
  updated_at: Date      // Last update timestamp
}
```

## Authentication & Authorization

### Authentication
- Uses Passport.js with Google OAuth 2.0 strategy
- Session stored in PostgreSQL via connect-pg-simple
- Session cookie: `connect.sid`
- Session expiry: 24 hours

### Authorization Levels
1. **Public**: No authentication required
   - View proverbs
   - Text search
   - Vector similarity search

2. **Authenticated**: Must be logged in
   - View user profile
   - Access to `/api/me`

3. **Admin**: Must have `is_admin = true`
   - User management
   - Proverb CRUD operations
   - Vector updates

## Database Design

### Schema Design Decisions

1. **Separate users table**: Allows for role management and user tracking independent of OAuth provider
2. **Composite unique constraint on (chapter, verse)**: Ensures data integrity for proverbs
3. **Vector column nullable**: Allows proverbs to exist without embeddings
4. **IVFFlat index**: Optimized for approximate nearest neighbor search on vectors

### Indexes
- `proverbs_vector_idx`: IVFFlat index for cosine similarity search
- `proverbs_chapter_idx`: B-tree index for chapter lookups
- `sessions_expire_idx`: B-tree index for session cleanup

### pgvector Configuration
```sql
-- Vector dimension: 1536 (OpenAI text-embedding-ada-002 compatible)
-- Index type: IVFFlat with 100 lists
-- Distance metric: Cosine similarity (vector_cosine_ops)
```

## Frontend Architecture

### Server-Side Rendering
HTML is generated server-side in route handlers. Each major page has a generator function:

| Function | Location | Purpose |
|----------|----------|---------|
| `generateHomePage` | routes/index.js | Home page with chapter grid |
| `generateChapterPage` | routes/index.js | Individual chapter view |
| `generateAdminDashboard` | routes/admin.js | Admin dashboard |
| `generateUsersPage` | routes/admin.js | User management |
| `generateProverbsPage` | routes/admin.js | Proverb management |
| `generateProverbForm` | routes/admin.js | Add/Edit proverb form |

### CSS Organization
Single stylesheet (`public/css/style.css`) using:
- CSS custom properties for theming
- Mobile-first responsive design
- Component-based organization

### No JavaScript Framework
The frontend uses vanilla HTML/CSS with minimal inline JavaScript for:
- Form validation
- Delete confirmations

## Security Architecture

### Authentication Security
- OAuth 2.0 (no password storage)
- Secure session cookies in production
- Session regeneration on login

### Authorization Security
- Server-side authorization checks
- Middleware guards on protected routes
- Self-demotion prevention for admins

### Data Security
- Parameterized SQL queries (SQL injection prevention)
- No direct user input rendering (XSS prevention)
- HTTPS enforced in production

## Scalability Considerations

### Current Design
- Single-server architecture
- Connection pooling for database
- Session storage in PostgreSQL

### Future Scaling Options
1. **Horizontal scaling**: Add load balancer, use Redis for sessions
2. **Database scaling**: Read replicas for queries
3. **Caching**: Add Redis cache for frequently accessed proverbs
4. **CDN**: Serve static assets from CDN

## Vector Search Architecture

### Embedding Pipeline (External)
```
Proverb Text → Embedding API (OpenAI) → 1536-dim Vector → Database
```

### Similarity Search
```sql
SELECT id, chapter, verse, text,
       1 - (vector <=> $1::vector) as similarity
FROM proverbs
WHERE vector IS NOT NULL
ORDER BY vector <=> $1::vector
LIMIT 10
```

### Index Strategy
- IVFFlat chosen for balance of speed and accuracy
- 100 lists appropriate for datasets up to ~100K vectors
- Cosine similarity for semantic search

## Error Handling

### Strategy
- Log errors to console
- Return user-friendly error pages/messages
- Don't expose internal details

### Error Types
| Type | Response |
|------|----------|
| Database error | 500 with generic message |
| Not found | 404 with message |
| Unauthorized | Redirect to login |
| Forbidden | 403 with access denied page |
| Validation error | 400 with specific message |

## Configuration

### Environment-Based Config
| Variable | Development | Production |
|----------|-------------|------------|
| NODE_ENV | development | production |
| Secure cookies | false | true |
| SSL database | false | true |
| Debug logging | verbose | minimal |
