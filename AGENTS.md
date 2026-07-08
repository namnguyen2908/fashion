# AI Agent Guidelines - Project Fashion

This document is a MANDATORY read for any AI agent before performing any coding task in this repository. Failure to adhere to these guidelines will be considered an architectural violation.

## 1. Current Backend Architecture
- **Framework**: Node.js with Express.
- **Pattern**: Controller-Route.
    - `routes/`: Define endpoints and map them to controllers.
    - `controllers/`: Contain business logic and request/response handling.
    - `middlewares/`: Handle cross-cutting concerns (authentication, validation, file uploads).
    - `config/`: Database, Redis, and Cloudinary configurations.
    - `utils/`: General-purpose helper functions.
- **Persistence**: PostgreSQL (Primary data), Redis (Caching/Versioning).
- **Storage**: Cloudinary (Images, Banners).

## 2. Module Ownership
Features must be encapsulated within their corresponding controller and route:
- `auth`: User authentication and identity management.
- `product`: Core product catalog and details.
- `productVariants`: Product variations (size, color, etc.).
- `productImages`: Product image management.
- `category`: Product categorization.
- `cart`: Shopping cart logic.
- `banner`: Home page and marketing banner management.

## 3. Import Boundary
- **Controllers $\rightarrow$ Utils**: Allowed.
- **Controllers $\rightarrow$ Other Controllers**: **FORBIDDEN**. Shared business logic must be extracted to `utils/` or a dedicated service layer if applicable.
- **Routes $\rightarrow$ Controllers**: Allowed (Primary mapping).
- **Middlewares $\rightarrow$ Utils**: Allowed.
- **Frontend $\rightarrow$ Backend**: Strictly via `client/src/services/api.jsx` using Axios.

## 4. Architectural Drift Prevention Rules
- **Pattern Adherence**: Never write business logic directly inside `routes/`. All logic must reside in `controllers/`.
- **Naming Consistency**: Use the `.controller.js` suffix for controllers and `.js` for routes.
- **No Global State**: Avoid modifying global variables; use config files, databases, or caches.

## 5. Function/Service Reuse Rules
- **Search Before Creation**: Before implementing any utility or logic, search `api/utils/` and existing controllers for similar functionality.
- **Generalization**: If a function is needed by two or more controllers, it MUST be moved to `api/utils/`.
- **DRY Principle**: Do not duplicate business logic across controllers.

## 6. Rules for Missing Functions
If a required function/service is missing:
- **DO NOT** implement it immediately.
- **Propose Location**: Explicitly propose the exact file and directory where the new function should be placed.
- **Justification**: Explain why existing tools cannot be used.
- **Confirmation**: Wait for user confirmation of the location and approach before implementation.

## 7. Mandatory Workflow
Every AI agent must follow this sequence for every task:
1. **Analyze**: Explore the codebase, identify all affected files, and understand the current implementation.
2. **Plan**: Create a detailed step-by-step implementation plan.
3. **Ask/Confirm**: Present the plan and any proposed new functions/locations to the user. Wait for approval.
4. **Implement**: Write code strictly according to the approved plan.
5. **Verify**: Run tests or check behavior as specified in `CLAUDE.md`.
