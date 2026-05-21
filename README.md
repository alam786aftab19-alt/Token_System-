# Smart Queue - Live Token Management System

A complete modern full-stack Token Management Web Application featuring real-time synchronization, dark-mode glassmorphism styling, secure JWT authentication, and automatic daily queue resets.

---

## 🚀 Tech Stack

- **Frontend:** HTML5, CSS3 (Glassmorphism Dark Theme), Vanilla JavaScript
- **Backend:** Node.js, Express.js
- **Database:** Supabase (PostgreSQL)
- **Real-Time Sync:** Socket.io (WebSockets)
- **Authentication:** JSON Web Tokens (JWT) & `bcryptjs`
- **Email Service:** EmailJS API integration

---

## 📁 Project Structure

```
Token_System-/
│
├── frontend/
│   ├── index.html          # Landing / welcome portal
│   ├── login.html          # Secure login form
│   ├── signup.html         # User sign up form
│   ├── dashboard.html      # Real-time token queue screen
│   ├── verify.html         # Email verification check
│   ├── css/
│   │   └── style.css       # Premium glassmorphic design sheets
│   └── js/
│       ├── api.js          # Fetch API request wrappers & Toast utility
│       ├── auth.js         # Signup, login, verification controllers
│       └── dashboard.js    # Socket.io sync, search filter, admin actions
│
├── backend/
│   ├── server.js           # Express & WebSockets initialization
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── tokenRoutes.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── tokenController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── verifyMiddleware.js
│   ├── config/
│   │   └── supabaseClient.js
│   ├── utils/
│   │   ├── emailService.js
│   │   └── tokenGenerator.js
│   ├── .env                # Configured environment keys
│   └── package.json
│
└── README.md               # Setup & operation manual
```

---

## 🛠️ Step-by-Step Setup Instructions

### 1. Database Setup (Supabase)

1. Go to [Supabase](https://supabase.com) and create a new project.
2. In the project dashboard, navigate to the **SQL Editor** in the left sidebar.
3. Paste the following SQL script to create tables, indexes, and triggers, then click **Run**:

```sql
-- 1. Create users table
CREATE TABLE IF NOT EXISTS token_system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    verification_token TEXT,
    verification_expires TIMESTAMPTZ,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create tokens table
CREATE TABLE IF NOT EXISTS token_system_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_number INTEGER NOT NULL,
    user_id UUID REFERENCES token_system_users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create token_history table
CREATE TABLE IF NOT EXISTS token_system_token_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID REFERENCES token_system_tokens(id) ON DELETE CASCADE,
    token_number INTEGER NOT NULL,
    user_id UUID REFERENCES token_system_users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_token_system_tokens_created_at ON token_system_tokens (created_at);
CREATE INDEX IF NOT EXISTS idx_token_system_tokens_status_user ON token_system_tokens (user_id, status);
CREATE INDEX IF NOT EXISTS idx_token_system_users_email ON token_system_users (email);

-- 5. Trigger function to auto-update the 'updated_at' column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_token_system_tokens_modtime
    BEFORE UPDATE ON token_system_tokens
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- 6. Disable Row Level Security (RLS) policies check for testing, 
-- or enable RLS and configure standard SELECT/INSERT rules.
ALTER TABLE token_system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_system_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_system_token_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read users" ON token_system_users FOR SELECT USING (true);
CREATE POLICY "Allow system modification users" ON token_system_users FOR ALL USING (true);

CREATE POLICY "Allow public read tokens" ON token_system_tokens FOR SELECT USING (true);
CREATE POLICY "Allow system modification tokens" ON token_system_tokens FOR ALL USING (true);

CREATE POLICY "Allow public read history" ON token_system_token_history FOR SELECT USING (true);
CREATE POLICY "Allow system modification history" ON token_system_token_history FOR ALL USING (true);
```

4. Go to **Project Settings -> API** in Supabase. Copy the **Project URL** and the **service_role** secret API key (or `anon public` key if you want to run it via simple policies). You will place these into the backend `.env` file.

---

### 2. Email Verification Setup (EmailJS)

1. Go to [EmailJS](https://www.emailjs.com/) and register or sign in.
2. In the EmailJS Dashboard, navigate to **Email Services** and click **Add New Service**. Connect an email provider (e.g. Gmail) and copy the **Service ID**.
3. Go to **Email Templates** and click **Create New Template**. Structure the template with:
   - To Email: `{{to_email}}`
   - To Name: `{{to_name}}`
   - Message/Verification link: `<a href="{{verification_link}}">Click here to verify your email address</a>` or paste `{{verification_link}}`
   - Copy the **Template ID**.
4. Navigate to **Account** -> **API Keys**.
   - Copy your **Public Key**.
   - Navigate to **Private Key** tab and copy your **Private Key**.
5. Paste these credentials into your `.env` file in the backend.

> **💡 Developer Mode Note:**
> If you leave the EmailJS environment variables empty, the system will run in **Developer Mode**. The verification link will be printed directly in the backend Node.js terminal window when a user registers, allowing you to instantly copy and test it!

---

### 3. Backend Environment Config (.env)

Open the `backend/.env` file and input your keys:
```env
PORT=5000
FRONTEND_URL=http://localhost:5000

SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_KEY=your-supabase-service-role-key-here

JWT_SECRET=super_secret_token_key_129847192847

EMAILJS_SERVICE_ID=your-emailjs-service-id
EMAILJS_TEMPLATE_ID=your-emailjs-template-id
EMAILJS_PUBLIC_KEY=your-emailjs-public-key
EMAILJS_PRIVATE_KEY=your-emailjs-private-key
```

---

### 4. Running the Application

1. Open a terminal in the project directory.
2. Navigate to the backend folder:
   ```powershell
   cd backend
   ```
3. (Optional) If packages are not installed, run:
   ```powershell
   npm install
   ```
4. Start the server:
   ```powershell
   npm start
   ```
5. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

---

## 🌟 Key Application Features Explained

### Admin Status Auto-Assign
To make testing quick, the **very first user** that signs up in the database is automatically granted **Admin** status (`is_admin = true`). Any subsequent user who registers will be created as a standard **User**.

- Log in as the first user to access the **🔑 Admin Control Panel** on the dashboard.
- Log in as subsequent users on different browser tabs (or in incognito windows) to generate standard tokens and watch them sync live!

### Self-Resetting Queue
Token numbers are computed based on the calendar day. A query fetches the maximum token number generated *today*. If it's a new day, the count automatically starts at `1`. There is no need for external database schedulers or cron configurations.

### Real-Time Updates
When a token is generated or when the admin clicks **Call Next Token**, the controller triggers Socket.io to emit a `queue-updated` broadcast. All connected clients listen to this event and instantly update their dashboard views without requiring a page reload.
