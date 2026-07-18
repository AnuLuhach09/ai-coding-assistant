# 🚀 CodeCoach AI – AI-Powered Coding Interview Preparation Platform

CodeCoach AI is a full-stack AI-powered coding interview preparation platform that helps users improve their programming skills through an interactive coding environment, AI-generated hints, code analysis, and interview-focused practice.

The platform combines a modern React frontend with a scalable Node.js backend to provide an intelligent coding assistant experience.

---

## 📌 Features

### 👨‍💻 Coding Workspace
- Interactive online code editor
- Syntax highlighting
- Real-time coding experience
- Clean and responsive UI

### 🤖 AI Coding Assistant
- AI-generated coding hints
- Code explanation
- Bug detection
- Optimization suggestions
- Interview-oriented guidance

### 📂 Project Management
- Upload coding files
- Organize projects
- Save coding sessions
- Manage coding history

### 🔐 Authentication
- Secure user registration
- Login system
- JWT Authentication
- Password encryption

### 📊 Performance Tracking
- Coding history
- Progress monitoring
- Practice management

### ⚡ Modern UI
- Responsive Design
- Smooth animations
- Dark theme support
- Mobile-friendly interface

---

# 🛠️ Tech Stack

## Frontend

- React
- React Router
- React Query
- Zustand
- Tailwind CSS
- Monaco Code Editor
- Framer Motion
- Axios

## Backend

- Node.js
- Express.js
- Prisma ORM
- JWT Authentication
- Redis
- ChromaDB
- OpenAI API
- Multer
- Winston Logger

## Database

- Prisma ORM
- SQL Database (configured through Prisma)

---

# 📁 Project Structure

```
CodeCoachAI
│
├── frontend
│   ├── src
│   ├── public
│   └── package.json
│
├── backend
│   ├── controllers
│   ├── routes
│   ├── middleware
│   ├── prisma
│   ├── services
│   ├── uploads
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

# ⚙️ Installation

## 1. Clone Repository

```bash
git clone https://github.com/yourusername/CodeCoachAI.git

cd CodeCoachAI
```

---

## 2. Install Frontend

```bash
cd frontend

npm install
```

---

## 3. Install Backend

```bash
cd ../backend

npm install
```

---

## 4. Configure Environment Variables

Create a `.env` file inside the backend directory.

Example:

```env
PORT=5000

DATABASE_URL=

JWT_SECRET=

OPENAI_API_KEY=

REDIS_URL=
```

---

## 5. Start Backend

```bash
cd backend

npm run dev
```

---

## 6. Start Frontend

```bash
cd frontend

npm run dev
```

---

# 🐳 Docker

Run the complete application using Docker.

```bash
docker-compose up --build
```

---

# 📸 Application Screenshots

## 🔐 Login Page

Secure authentication system with email/password login and JWT-based session management.

![Login Page](./screenshots/login.png)

---

## 📊 Dashboard

The dashboard provides an overview of user projects, AI chat sessions, token usage, and code quality metrics.

![Dashboard](./screenshots/dashboard.png)

---

## 👤 Profile Preferences

Users can personalize their profile, select their preferred programming language, and switch between light and dark themes.

![Profile Preferences](./screenshots/profile.png)

---

## ⚙️ AI Configuration Settings

Configure AI provider, select language models, adjust temperature, set maximum output tokens, and enable token streaming.

![Configuration Settings](./screenshots/settings.png)

---

## 📂 Clone GitHub Repository

Clone any public GitHub repository directly into CodeCoach AI for instant code analysis and AI-powered auditing.

![Clone Repository](./screenshots/clone-repository.png)



---

# 🔐 Security Features

- JWT Authentication
- Password Hashing
- Rate Limiting
- Helmet Security
- CORS Protection
- Secure API Design

---

# 🚀 Future Improvements

- Voice-based AI Interviewer
- Live Coding Contests
- AI Mock Interviews
- Resume Analyzer
- Company-wise Coding Sheets
- Leaderboard
- Multi-language Code Execution
- Video Interview Support

---

# 📚 Learning Outcomes

This project helped in understanding:

- Full Stack Development
- REST API Design
- Authentication & Authorization
- State Management
- Database Design
- AI API Integration
- Docker Deployment
- Secure Backend Development
- Modern React Development

---

# 👨‍💻 Author

**Anu Luhach**

B.Tech Computer Science Engineering

Passionate about Full Stack Development, Artificial Intelligence, and Software Engineering.

GitHub: https://github.com/yourusername

LinkedIn: https://linkedin.com/in/yourprofile

---

# ⭐ Support

If you found this project useful, consider giving it a ⭐ on GitHub.

It motivates future development and improvements.

---

# 📄 License

This project is intended for educational and learning purposes.
