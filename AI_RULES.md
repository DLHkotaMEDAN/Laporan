# AI_RULES.md

## 🧱 Tech Stack

* Frontend: Next.js (React)
* Styling: Tailwind CSS
* Backend: Supabase (PostgreSQL, Auth, Storage)
* API: Next.js API Routes / REST API
* Database: PostgreSQL (via Supabase)
* Authentication: Supabase Auth
* Deployment: Vercel
* Version Control: Git + GitHub

---

## 📁 Project Structure Rules

* Keep a clean folder structure:

  * `/components` → UI components
  * `/pages` or `/app` → routing
  * `/lib` → utilities / helpers
  * `/services` → API / Supabase logic
* Avoid placing all logic in one file
* Separate UI, logic, and data layer

---

## 🎨 Frontend Rules

* Use functional components only
* Use React hooks (useState, useEffect, etc.)
* Use Tailwind CSS (no inline CSS)
* Keep components reusable and modular
* Avoid large components (>300 lines)

---

## ⚙️ Backend Rules

* Use Supabase client for all DB operations
* Avoid direct raw SQL unless necessary
* Use async/await consistently
* Handle all errors using try/catch
* Validate input before processing

---

## 🗄️ Database Rules

* Use snake_case for table & column names
* Always define primary keys (id)
* Use proper relations (foreign keys)
* Avoid duplicate data (normalize tables)

---

## 🔐 Authentication Rules

* Use Supabase Auth only
* Do not create custom auth system
* Protect private routes
* Never expose tokens or secrets

---

## 🌐 API Rules

* Follow RESTful conventions
* Use clear endpoint naming
* Return JSON responses only
* Include proper status codes (200, 400, 500)
* Handle errors gracefully

---

## 🔒 Security Rules

* Store secrets in `.env`
* Never commit `.env` to GitHub
* Sanitize all user inputs
* Prevent XSS and SQL Injection

---

## 🚀 Deployment Rules

* Ensure environment variables are set in Vercel
* Test build before deployment
* Separate dev and production configs

---

## 📦 Library Usage Rules

* Use Tailwind CSS for styling
* Use Supabase JS SDK for backend
* Use native fetch or Axios for API calls
* Avoid unnecessary external libraries
* Prefer built-in Next.js features

---

## 🧪 Code Quality Rules

* Use meaningful variable names
* Write clean and readable code
* Add comments for complex logic
* Avoid duplicated code (DRY principle)

---

## 🔁 Git Rules

* Commit frequently with clear messages
* Use meaningful commit messages
* Do not commit sensitive data
* Keep main branch stable

---

## 📝 Final Guidelines

* Prioritize simplicity and maintainability
* Optimize for performance when needed
* Follow best practices of Next.js and Supabase
* Keep code scalable for future development
