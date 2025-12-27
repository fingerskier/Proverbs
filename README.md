# Proverbs

Vector embedded wisdom - A full-stack application for browsing and searching biblical proverbs with vector similarity capabilities.

## Features

- **Public Interface**: Browse proverbs by chapter, search by text
- **Admin Interface**: Manage users, proverbs, and vector embeddings
- **Vector Search**: Semantic similarity search using pgvector (1536-dimensional embeddings)
- **Google OAuth**: Secure authentication via Google
- **PostgreSQL**: Robust data storage with pgvector extension

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with pgvector extension
- **Authentication**: Passport.js with Google OAuth 2.0
- **Frontend**: Vanilla HTML/CSS (no framework)
- **Sessions**: PostgreSQL-backed sessions via connect-pg-simple

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- Google Cloud Console project with OAuth 2.0 credentials

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Proverbs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL with pgvector**
   ```sql
   CREATE DATABASE proverbs;
   \c proverbs
   CREATE EXTENSION vector;
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   - `DATABASE_URL`: PostgreSQL connection string
   - `SESSION_SECRET`: Random secret for sessions
   - `GOOGLE_CLIENT_ID`: From Google Cloud Console
   - `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
   - `GOOGLE_CALLBACK_URL`: OAuth callback URL

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Seed sample data (optional)**
   ```bash
   npm run db:seed
   ```

7. **Start the server**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

## Database Schema

### Users Table
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| google_id | VARCHAR(255) | Google OAuth ID |
| email | VARCHAR(255) | User email |
| display_name | VARCHAR(255) | Display name |
| avatar_url | TEXT | Profile picture URL |
| is_admin | BOOLEAN | Admin flag |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### Proverbs Table
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| chapter | INTEGER | Chapter number (1-31) |
| verse | INTEGER | Verse number |
| text | TEXT | Proverb text |
| vector | vector(1536) | Embedding vector |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Home page with chapter grid |
| GET | `/chapter/:num` | View chapter verses |
| GET | `/api/search?q=` | Text search proverbs |
| POST | `/api/search/similar` | Vector similarity search |
| GET | `/api/proverbs` | List all proverbs |
| GET | `/api/proverbs/:id` | Get single proverb |
| GET | `/api/me` | Get current user info |

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/login` | Login page |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | OAuth callback |
| GET | `/auth/logout` | Logout |

### Admin Endpoints (requires admin role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin` | Admin dashboard |
| GET | `/admin/users` | User management |
| POST | `/admin/users/:id/toggle-admin` | Toggle admin status |
| GET | `/admin/proverbs` | Proverbs management |
| GET | `/admin/proverbs/new` | New proverb form |
| POST | `/admin/proverbs` | Create proverb |
| GET | `/admin/proverbs/:id/edit` | Edit proverb form |
| POST | `/admin/proverbs/:id` | Update proverb |
| POST | `/admin/proverbs/:id/delete` | Delete proverb |
| PUT | `/api/proverbs/:id/vector` | Update proverb vector |
| POST | `/api/proverbs/vectors` | Bulk update vectors |

## Making a User Admin

Connect to PostgreSQL and run:
```sql
UPDATE users SET is_admin = true WHERE email = 'your-email@gmail.com';
```

## Vector Embeddings

The application supports 1536-dimensional vectors (compatible with OpenAI text-embedding-ada-002). To populate vectors:

1. Generate embeddings using your preferred embedding API
2. Use the admin API to update vectors:
   ```bash
   curl -X PUT http://localhost:3000/api/proverbs/1/vector \
     -H "Content-Type: application/json" \
     -d '{"vector": [0.1, 0.2, ...]}'
   ```

## Development

```bash
# Start with nodemon for auto-reload
npm run dev

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

## Project Structure

```
Proverbs/
├── src/
│   ├── server.js           # Express app entry point
│   ├── config/
│   │   └── passport.js     # Passport.js configuration
│   ├── db/
│   │   ├── index.js        # Database connection
│   │   ├── migrate.js      # Database migrations
│   │   └── seed.js         # Seed data
│   ├── middleware/
│   │   └── auth.js         # Auth middleware
│   └── routes/
│       ├── index.js        # Public routes
│       ├── auth.js         # Auth routes
│       ├── admin.js        # Admin routes
│       └── api.js          # API routes
├── public/
│   └── css/
│       └── style.css       # Styles
├── .env.example            # Environment template
├── package.json            # Dependencies
├── README.md               # This file
├── AGENT.md                # AI agent instructions
└── ARCH.md                 # Architecture documentation
```

## License

ISC
