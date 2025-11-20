# Sierra Club Peak Conditions Assistant

An internal web application for Sierra Club outing leaders in Southern California to check current conditions for approximately 250 peaks before planning trips.

## 🎯 Project Status

**Phase 1 Complete** ✅

This project is being built in phases according to the detailed specification in `sierra-conditions-spec.md`.

### What's Working Now

- ✅ Next.js 15 with TypeScript and App Router
- ✅ PostgreSQL database with Prisma ORM
- ✅ NextAuth authentication (email magic link + optional Google OAuth)
- ✅ Role-based access control (Leader/Admin)
- ✅ Complete API routes for peaks, conditions, notes, and sources
- ✅ Peaks list page with region grouping
- ✅ Individual peak conditions pages
- ✅ Manual notes system for leaders to share observations
- ✅ Basic admin dashboard structure

### Coming Next

- 🚧 Phase 2: Enhanced manual notes UI
- 🚧 Phase 3: NOAA weather integration
- 🚧 Phase 4: Firecrawl integration for web scraping (land manager & road status)
- 🚧 Phase 5: Full admin interface for managing peaks and sources
- 🚧 Phase 6: Optional enhancements (notifications, hints, etc.)

## 🚀 Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Email service for authentication

### Basic Setup

```bash
# Install dependencies
npm install

# Set up environment variables (see SETUP.md)
cp .env.example .env
# Edit .env with your values

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

Visit `http://localhost:3000` and sign in to get started!

## 📚 Documentation

- **[SETUP.md](./SETUP.md)** - Complete setup and deployment guide
- **[sierra-conditions-spec.md](./sierra-conditions-spec.md)** - Full technical specification and architecture

## 🏗️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (recommended)

## 📝 Key Features

### For Leaders
- Browse all peaks organized by region
- View aggregated conditions per peak (weather, land status, road status)
- Add and view trip reports and field observations
- Simple, accessible interface with large text and high contrast

### For Admins
- Full CRUD operations on peaks catalog
- Configure data sources (land manager URLs, road status URLs)
- Manage user roles (via Prisma Studio for now)
- View data refresh status

## 🔐 Security

- Authentication required for all peak data
- Role-based access control (Leader vs Admin)
- API routes protected with NextAuth session validation
- Soft deletes for peaks (preserves data integrity)

## 📊 Database Schema

The application uses a comprehensive schema with:
- Users (with roles)
- Peaks (with GPS coordinates)
- Peak Sources (configured URLs for data scraping)
- Weather Snapshots
- Land Status Snapshots
- Road Status Snapshots
- Manual Notes

See `prisma/schema.prisma` for the complete schema.

## 🧪 Development

```bash
# Development server
npm run dev

# Type checking
npm run build

# Linting
npm run lint

# Database tools
npm run db:push    # Push schema changes
npm run db:studio  # Open Prisma Studio GUI
```

## 📦 Deployment

Designed for Vercel deployment:

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy!

For cron jobs (weather/status refresh), use Vercel Cron or an external service.

## 🤝 Contributing

This is an internal tool for the Sierra Club. Contact the maintainer for access and contribution guidelines.

## 📄 License

Private project for Sierra Club use.

---

**Built for Sierra Club Southern California Outing Leaders**
