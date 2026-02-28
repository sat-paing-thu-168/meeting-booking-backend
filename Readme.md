# Meeting Room Booking System - Backend API

A RESTful API for managing meeting room bookings with role-based access control (Admin, Owner, User). Built with Node.js, Express, and PostgreSQL.

## 🚀 Live Demo

- **API Base URL**: `https://meeting-booking-backend-production.up.railway.app/api`
- **Health Check**: `https://meeting-booking-backend-production.up.railway.app/health`

## ✨ Features

- **JWT Authentication** - Secure token-based authentication
- **Role-Based Access Control** - Admin, Owner, and User roles with distinct permissions
- **Booking Management** - Create, view, delete bookings with intelligent overlap detection
- **User Management** - Full CRUD operations for users (Admin only)
- **Soft Delete** - Users can be soft-deleted and restored
- **Hard Delete** - Permanent deletion with cascade to bookings
- **Usage Analytics** - Booking summaries and statistics for Owners/Admins
- **Pagination** - All list endpoints support pagination
- **Filtering & Sorting** - Flexible query parameters for data retrieval

## 🛠️ Tech Stack

| Technology     | Purpose                       |
| -------------- | ----------------------------- |
| Node.js        | Runtime environment           |
| Express.js     | Web framework                 |
| PostgreSQL     | Database                      |
| pg             | PostgreSQL client             |
| JSON Web Token | Authentication                |
| bcryptjs       | Password hashing              |
| dotenv         | Environment variables         |
| cors           | Cross-origin resource sharing |

## ⚙️ Installation

### Prerequisites

- Node.js v22+
- PostgreSQL v12+
- npm or yarn

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/sat-paing-thu-168/meeting-booking-backend
cd backend

# 2. Install dependencies
npm install

# 3. Environment setup
.env
# Edit .env with your database credentials

# 4. Create database
psql -U postgres -c "CREATE DATABASE meeting_room_booking;"

# 5. Start the server
npm run dev  # Development
```

# ⚙️ Environment Variables

### Server

PORT=3000

### Database

- DB_USER=
- DB_PASSWORD=
- DB_HOST=
- DB_PORT=
- DB_DATABASE=

### JWT

JWT_SECRET=your-super-secret-jwt-key

### Bcrypt Salt Rounds

BCRYPT_SALE_ROUNDS = salt-round-count

# Database Schema

```
-- users
CREATE TABLE users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name TEXT NOT NULL,
role TEXT NOT NULL CHECK (role IN ('admin','owner','user')),
email TEXT UNIQUE,
password_hash TEXT,
is_deleted BOOLEAN DEFAULT false,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- bookings
CREATE TABLE bookings (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id) ON DELETE SET NULL,
start_time TIMESTAMP WITH TIME ZONE NOT NULL,
end_time TIMESTAMP WITH TIME ZONE NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
-- Indexes for queries:
CREATE INDEX idx_bookings_start_end ON bookings (start_time, end_time);
CREATE INDEX idx_bookings_user ON bookings (user_id);
```
