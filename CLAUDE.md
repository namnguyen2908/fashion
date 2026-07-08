# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (api/)
- Develop: `cd api && npm run dev`
- Start: `cd api && npm start`

### Frontend (client/)
- Develop: `cd client && npm run dev`
- Build: `cd client && npm run build`
- Lint: `cd client && npm run lint`
- Preview: `cd client && npm run preview`

## Architecture

The project is a full-stack application split into `api/` (backend) and `client/` (frontend).

### Backend (`api/`)
- **Framework**: Node.js with Express.
- **Structure**: Follows a controller-route pattern.
    - `config/`: Database (`pg`), Redis, and Cloudinary configurations.
    - `controllers/`: Business logic and request handling.
    - `routes/`: Endpoint definitions mapping to controllers.
    - `middlewares/`: Authentication (`verifyToken`), role verification, and file upload handling.
    - `utils/`: Helper functions (e.g., slugification, cache management).
- **Persistence**: PostgreSQL for primary data; Redis for caching and versioning.
- **Authentication**: JWT-based authentication stored in cookies.
- **File Storage**: Cloudinary for images and banners.

### Frontend (`client/`)
- **Framework**: React 19 with Vite.
- **Styling**: Tailwind CSS 4.
- **Routing**: React Router DOM.
- **API Communication**: Axios for requests to the backend.
