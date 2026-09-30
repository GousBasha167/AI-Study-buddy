# AI StudyBuddy

An AI-powered educational application built with **Node.js, Express, MongoDB, and Gemini AI** with an interactive web frontend.

## Features
- JWT authentication stored in **HTTP-only cookies** (access + refresh tokens)
- Role-Based Access Control (student / admin)
- Upload study materials (`.txt`, `.md`, `.pdf`)
- AI-powered: summarize, flashcards, quiz, and personalized study plans via Google Gemini
- Interactive frontend dashboard for students and admins

---

## Project Structure

```
AI-StudyBuddy/
+-- backend/                         # Backend Express API
¦   +-- src/
¦   ¦   +-- controllers/             # authController, materialController, adminController
¦   ¦   +-- middleware/              # auth, upload (multer)
¦   ¦   +-- models/                  # User, Material (Mongoose schemas)
¦   ¦   +-- routes/                  # auth, materials, admin
¦   ¦   +-- utils/                   # db, gemini, tokens
¦   +-- uploads/                     # File upload storage (auto-created)
¦   +-- .env                         # Local environment variables (DO NOT COMMIT)
¦   +-- .env.example                 # Example template for backend env
¦   +-- index.js                     # Express backend entry point
¦   +-- package.json                 # Backend dependencies & scripts
+-- frontend/                        # Static HTML/CSS/JS frontend
¦   +-- css/                         # Stylesheets
¦   +-- js/                          # Client-side scripts (API connectors)
¦   +-- admin.html                   # Admin portal
¦   +-- dashboard.html               # Student dashboard
¦   +-- index.html                   # Login page
¦   +-- material.html                # Material detail & AI tools
¦   +-- materials.html               # Materials list & upload
¦   +-- register.html                # Registration page
¦   +-- server.js                    # Local static server (port 3000)
¦   +-- package.json                 # Frontend scripts
+-- .gitignore                       # Prevents committing node_modules, .env, uploads
+-- package.json                     # Root orchestrator scripts
+-- README.md                        # Documentation
```

---

## Getting Started

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd AI-StudyBuddy
```

### 2. Install dependencies
Install dependencies for both backend and frontend:
```bash
npm run install:all
```
*(Or install them individually by running `cd backend && npm install` and `cd ../frontend && npm install`)*

### 3. Configure Environment Variables
Copy `.env.example` in the `backend/` folder to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```
Update `backend/.env` with your actual credentials:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
GEMINI_API_KEY=your_gemini_api_key
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### 4. Run the Application

You can run the servers using the root convenience commands:

- **Start Backend** (API on `http://localhost:5000`):
  ```bash
  npm run backend
  ```
  *(or `npm start`)*

- **Start Frontend** (Web UI on `http://localhost:3000`):
  ```bash
  npm run frontend
  ```

Open [http://localhost:3000](http://localhost:3000) in your browser to access AI StudyBuddy.

---

## API Reference

### Auth Routes — `/api/auth`

| Method | Endpoint    | Body                          | Description          |
|--------|-------------|-------------------------------|----------------------|
| POST   | /register   | `name, email, password, role` | Register new user    |
| POST   | /login      | `email, password`             | Login                |
| POST   | /refresh    | —                             | Refresh tokens       |
| POST   | /logout     | —                             | Clear cookies        |

> Tokens are stored in **HTTP-only cookies** (`accessToken` expires in 15m, `refreshToken` in 7d).

---

### Material Routes — `/api/materials` *(requires login)*

| Method | Endpoint              | Body / Notes                         | Description             |
|--------|-----------------------|--------------------------------------|-------------------------|
| POST   | /upload               | Form-data: `file` + optional `title` | Upload study material   |
| GET    | /                     | —                                    | List your materials     |
| GET    | /:id                  | —                                    | Get one material        |
| DELETE | /:id                  | —                                    | Delete material         |
| POST   | /:id/summarize        | —                                    | AI summarize            |
| POST   | /:id/flashcards       | `{ count: 5 }`                       | Generate flashcards     |
| POST   | /:id/quiz             | `{ count: 5 }`                       | Generate MCQ quiz       |
| POST   | /:id/study-plan       | `{ goal, hoursPerDay, days }`        | Personalized study plan |

---

### Admin Routes — `/api/admin` *(admin role only)*

| Method | Endpoint      | Description                   |
|--------|---------------|-------------------------------|
| GET    | /users        | List all users                |
| DELETE | /users/:id    | Delete user + their materials |
| GET    | /stats        | Total users & materials count |

---

## Security Notes
- Never commit `.env` or sensitive API keys to Git. The `.gitignore` file is pre-configured to ignore all `.env` files.
- The `node_modules` folders are also ignored to ensure your repository stays lightweight and pushes quickly without hitting GitHub file size limits.
