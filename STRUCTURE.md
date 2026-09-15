# React JS + Firebase Enterprise Architecture

This document outlines a highly scalable, production-ready folder structure for a **React JS + Firebase** application. 

It is designed with strict architectural rules: **TanStack Query for advanced caching**, **Path Aliasing (`@/`)**, **Environment variables for security**, **No hardcoded strings**, **Universal theming**, and **Global UI states**.

## 📂 Directory Overview

```text
/                     # Project Root
├── .env              # 🔐 ENVIRONMENT VARIABLES (Firebase keys, secret tokens)
├── tsconfig.json     # Configured for Path Aliasing (e.g., paths: { "@/*": ["src/*"] })
└── src/
    ├── firebase/                 # 🔥 FIREBASE CONFIGURATION & SERVICES
    │   ├── config.ts             # Firebase initialization (reads from .env)
    │   ├── auth.ts               # Firebase Authentication wrappers
    │   └── firestoreService.ts   # GENERIC FIRESTORE FUNCTIONS (addDoc, getDocById)
    │
    ├── constants/                # 🛑 NO MAGIC STRINGS IN COMPONENTS
    │   ├── collections.ts        # Firebase collection names (e.g., USERS = 'users')
    │   ├── messages.ts           # App text, success/error messages
    │   └── routes.ts             # 🚏 ROUTE NAMES (e.g., DASHBOARD = '/dashboard')
    │
    ├── theme/                    # 🎨 UNIVERSAL THEMING
    │   ├── colors.ts             # Centralized color palettes
    │   └── ThemeProvider.tsx     # Context to provide theme variables to the app
    │
    ├── providers/                # 🌐 GLOBAL UI PROVIDERS
    │   ├── QueryProvider.tsx     # TanStack Query Client Provider
    │   ├── ToastProvider.tsx     # Global Toast/Alert context
    │   └── LoaderProvider.tsx    # Global Full-Screen Loader context
    │
    ├── components/               # 🟢 SHARED UI COMPONENTS (Dumb/Presentational)
    │   ├── ui/                   # Generic UI (Button, Input, Modal, Dropdown)
    │   ├── layout/               # Shared layout pieces (Navbar, Sidebar)
    │   └── global/               # GlobalLoader.tsx, GlobalToast.tsx
    │
    ├── features/                 # 🔵 FEATURE MODULES (Organized by domain)
    │   ├── auth/                 # e.g., Authentication feature
    │   └── documents/            # e.g., Document management feature
    │       ├── components/       # Feature-specific components
    │       ├── queries.ts        # TanStack `useQuery` hooks for this feature
    │       └── mutations.ts      # TanStack `useMutation` hooks for this feature
    │
    ├── hooks/                    # 🪝 GLOBAL CUSTOM HOOKS
    │   ├── useToast.ts           # Hook to trigger global toasts
    │   └── useLoader.ts          # Hook to show/hide global loader
    │
    ├── pages/                    # 🔴 ROUTE COMPONENTS (Smart components)
    │   ├── Login/                # Renders the login feature
    │   └── Dashboard/            # Renders the main dashboard
    │
    ├── routes/                   # 🚏 REACT ROUTER DOM CONFIGURATION
    │   ├── AppRoutes.tsx         # Maps routes.ts constants to Pages
    │   └── ProtectedRoute.tsx    # Checks Auth before rendering
    │
    └── utils/                    # 🛠️ PURE FUNCTIONS
        └── formatters.ts         # Date formatting, string capitalization
```

## 🏗️ Core Architectural Rules

### 1. TanStack Query (Server State & Caching)
Never use `useEffect` or `useState` to fetch Firebase data. Instead, wrap the generic `firestoreService` functions inside **TanStack Query** (`useQuery` and `useMutation`).
- **Why?** It automatically handles caching, background refetching, loading/error states, and prevents duplicate network requests.
- **Where?** Queries and mutations are stored inside their respective `features/` folder (e.g., `features/documents/queries.ts`).

### 2. Path Aliasing (`@/`)
Never use messy relative paths like `../../../../components/ui/Button`.
- The project is configured (via `tsconfig.json` or `vite.config.ts`) to map `@/` to the `src/` directory.
- **Example:** `import Button from '@/components/ui/Button';`

### 3. Environment Variables (`.env`)
No private API keys or Firebase configuration blocks are hardcoded in the source code.
- All keys are stored in a `.env` file at the root of the project (e.g., `VITE_FIREBASE_API_KEY=xxx`).
- The `src/firebase/config.ts` file exclusively reads from these environment variables.

### 4. Zero Hardcoded Strings (Centralized Routes & Constants)
Never write static text, collection names, or route paths directly inside a component. 
- **Routes:** All URL paths are strictly defined in `src/constants/routes.ts`. When navigating, use `navigate(ROUTES.DASHBOARD)`.
- **Collections:** All database collections are defined in `src/constants/collections.ts`.

### 5. Universal Theme Support
All colors, paddings, and font sizes must come from the `src/theme/` directory. This guarantees that adding Dark Mode in the future will require zero UI component changes.

### 6. Generic Firebase Service Layer
All database traffic funnels through a single `firestoreService.ts` file using generic wrappers (e.g., `getDocumentById`). UI components never call Firebase SDK directly.

### 7. Global UI States (Toast & Loader)
Child components trigger global UI elements via custom hooks (`showLoader()`, `showToast()`). The actual visual components are rendered exactly once at the root level of the app.

### 8. Strict Component Reusability & Optimization
- **Dumb vs. Smart:** Keep components in `src/components/ui` strictly "dumb" (they only receive props, they don't fetch data). All complex logic and data fetching happens in `pages/` or `features/`.
- **Advanced Optimizations Required:** 
  - **`React.memo()`:** Wrap heavy, frequently rendered "dumb" UI components in `memo()` so they only re-render if their props actually change.
  - **`useMemo()`:** Use for expensive calculations (e.g., sorting massive arrays or filtering large datasets on the client side) so the math isn't re-run on every single render.
  - **`useCallback()`:** Always wrap functions passed down as props to child components (like `onClick` handlers) in `useCallback` to prevent breaking `React.memo` optimizations.
  - **Debouncing:** Any search input or text filter must use a debounced hook (e.g., `useDebounce`) to delay API/Firebase calls until the user stops typing for ~500ms, drastically reducing backend reads and saving money.
  - **Throttling:** Use for continuous rapid events (like window resizing, scrolling, or heavy mouse tracking) to guarantee the function only fires once every X milliseconds.

### 9. Built-in Firebase Pagination
All list-fetching hooks (via TanStack Query) must support cursor-based pagination from day one.
- The generic `firestoreService.ts` accepts a `lastVisible` cursor (using Firebase's `startAfter()` query constraint).
- TanStack Query's `useInfiniteQuery` is used in the `features/` folders to seamlessly manage "Load More" functionality or infinite scrolling without re-fetching previous pages.
