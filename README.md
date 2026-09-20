# Univo Infotech - SaaS Admin Console

A modern, high-performance, and fully responsive Admin Portal built with **React JSX + Tailwind CSS + Firebase**.

---

## 🚀 Quick Start

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5174` in your browser.

3. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 🔐 Authentication & Access

* **Master Admin Login:**
  * **Email:** `admin@univoinfotech.com` or `univoinfotech@gmail.com`
  * **Password:** `admin123`
* Also supports standard **Firebase Authentication** users created in `univoinfotech-25d66`.

---

## 📁 Key Modules & Architecture

* **Master Dashboard (`/`):**
  * Live calculations of Total Platform Revenue (Subscriptions + WhatsApp Packs)
  * Operating Expenses & Net Margins (accounting for ~2.36% Razorpay gateway fee)
  * Real-time registered libraries status count
  * Recent transactions & recent library signups
* **Library Clients (`/clients`):**
  * Live status from root `/subscriptions/{tenantId}`
  * Search by Library name, owner name, city, phone, email
  * Filter by Active, Expired
  * Detailed inspector modal
* **Expenses & Finances (`/finances`):**
  * Tracks Univo internal operational costs in `univoDb`
  * Category breakdown (Marketing, Hosting, Salaries, Office, Tools)
  * Modal for recording new expenses with instant validation
* **Plans & Pricing (`/plans`):**
  * SaaS Subscription Plans CRUD (Pricing, Duration, Allowed modules, Student capacity)
  * WhatsApp Message Recharge Packs CRUD (Messages quota, Pricing)
* **User Queries & Support (`/queries`):**
  * Feedback tickets, bug reports, and support inquiries from library owners
  * Status workflow: `Open` ➔ `In Progress` ➔ `Resolved`
* **Reports & Ledger (`/reports`):**
  * Financial ledger with filters: All Time, Today, This Month, Custom Date Range
  * Stream filter (Subscriptions, WhatsApp, Expenses)
  * **One-click CSV Export**
* **Field Marketing & GPS Client Visits (`/marketing`):**
  * Logs visits to **Study Libraries, Fitness Gyms, Coaching Centers, and Enterprises**
  * **Device Native GPS Location Capture:** Captures Latitude, Longitude, and Accuracy with a direct Google Maps link
  * Meeting logs: Discussion notes, Demo given checkbox, Lead status (Interested, Follow-up, Deal Closed), and scheduled callback date
* **Staff Duty & Attendance (`/attendance`):**
  * 1-Click Daily Punch-In / Punch-Out with GPS location verification
  * Working hours and shift duration tracking
* **Staff & Granular Role Permissions (`/staff`):**
  * Create Staff IDs & Passwords
  * Preset roles (Field Marketing Executive, Operations Manager, Support)
  * **Custom Permissions Matrix:** Toggle individual `view`, `create`, `edit`, and `delete` rights per module

