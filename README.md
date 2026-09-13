# Med-Sked

Med-Sked is the team's medication management capstone system for patients and caregivers. The application supports medication tracking, scheduled dosing, adherence monitoring, caregiver relationships, notifications, analytics, and patient care workflows in a single full-stack project.

## 1. Technology Stack

### Frontend
- React Native
- Expo
- Expo Go (for physical mobile testing)
- React Native Web

### Backend
- Node.js
- Express.js
- Mongoose

### Database
- MongoDB Atlas

### Authentication and security
- JWT
- bcryptjs
- CORS
- Express.js middleware-based route protection

### Development and team workflow
- Git
- GitHub
- Postman

## 2. Project Structure

```text
Med-Sked/
├── backend/
├── frontend/
├── .gitignore
├── README.md
├── package-lock.json
└── package.json
```

### Backend responsibilities
The backend lives in `backend/` and is responsible for:
- authentication and user accounts
- medication CRUD
- schedule CRUD
- dose generation and tracking
- caregiver relationships and permissions
- notifications
- analytics endpoints
- MongoDB access through Mongoose models and services

### Frontend responsibilities
The frontend lives in `frontend/` and is responsible for:
- patient and caregiver screens
- medication and schedule forms
- dose history and adherence views
- relationship management
- notifications and monitoring flows
- Expo-based mobile and web UI

## 3. Prerequisites

Before cloning or running the project, each developer should have:
- Git
- Node.js
- npm
- Expo development environment for React Native
- Expo Go installed on an Android or iOS phone for physical-device testing
- MongoDB Atlas access for the team's shared database
- Postman if they want to test the backend API manually

The project currently uses the Expo version declared in `frontend/package.json` and the Node.js environment required by that toolchain. This repository does not declare a custom Node.js version override, so the team should use a current LTS Node.js version that is compatible with the active Expo and React Native stack.

## 4. Clone the GitHub Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Med-Sked
```

Each team member should clone the repository onto their own computer and work from their local copy.

## 5. Install Backend Dependencies

```bash
cd Med-Sked/backend
npm install
```

If PowerShell blocks npm, use:

```powershell
cd Med-Sked/backend
npm.cmd install
```

This installs dependencies from `backend/package.json`.

## 6. Install Frontend Dependencies

```bash
cd Med-Sked/frontend
npm install
```

If PowerShell blocks npm, use:

```powershell
cd Med-Sked/frontend
npm.cmd install
```

This installs dependencies from `frontend/package.json`.

## 7. MongoDB Atlas Setup

The project uses MongoDB Atlas as the shared database service. Developers do not need to install MongoDB locally unless they specifically want a local database for testing outside the team setup.

Each developer will need the team's approved Atlas connection string and JWT secret.

Create the backend environment file locally:

```bash
cd Med-Sked/backend
copy .env.example .env
```

Then update `backend/.env` with the team values:

```env
PORT=5000
MONGODB_URI=YOUR_TEAM_MONGODB_ATLAS_URI
JWT_SECRET=YOUR_TEAM_JWT_SECRET
```

Important notes:
- These values are private and must never be committed to GitHub.
- Do not share your `.env` file in commits or pull requests.
- Each developer may need to add their current public IP address to the MongoDB Atlas IP Access List.
- The correct value is the developer's internet/public IP, not their local `192.168.x.x` address.
- The local `192.168.x.x` address is only relevant for local device communication when using Expo Go on a phone.

Do not permanently allow `0.0.0.0/0` in Atlas unless the team explicitly approves it for a temporary test setup.

## 8. Frontend Environment Setup

The frontend reads its API URL from `frontend/services/config.js` and the environment variable `EXPO_PUBLIC_API_URL`.

Create the local frontend environment file:

```bash
cd Med-Sked/frontend
copy .env.example .env.local
```

Then update `frontend/.env.local` with a local API endpoint:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:5000
```

### A. Physical phone using Expo Go
When testing on a phone, both the phone and the computer must be on the same local network.

Use the computer's LAN IP, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.25:5000
```

Do not use `localhost` or `127.0.0.1` for a physical phone.

### B. Web browser
When running the frontend in a browser, it still talks to the backend over the same configured API URL. The backend must be running at the same time.

## 9. Run the Backend

Open a terminal and start the backend:

```bash
cd Med-Sked/backend
node server.js
```

The backend should start on port 5000:

```text
http://localhost:5000
```

Keep this terminal open while the app is running.

## 10. Run the Frontend

Open a second terminal and start Expo:

```bash
cd Med-Sked/frontend
npx expo start
```

### For physical device testing
1. Install and open Expo Go on the phone.
2. Make sure the phone and computer are on the same Wi-Fi network.
3. Run `npx expo start` in the frontend terminal.
4. Scan the QR code with Expo Go.
5. The app should open on the device.
6. Keep the backend terminal running.

### For web testing
Once the Expo terminal is running:

- Press `w` in the Expo terminal.
- The app should open in the browser.

### Recommended terminal layout
Terminal 1:
```bash
cd Med-Sked/backend
node server.js
```

Terminal 2:
```bash
cd Med-Sked/frontend
npx expo start
```

Then either:
- scan the QR code for Expo Go, or
- press `w` for a web browser

## 11. Windows / PowerShell Notes

Because the project is commonly developed on Windows, use the following if npm is blocked by PowerShell:

```powershell
npm.cmd install
```

This is the Windows-safe equivalent for commands such as `npm install`.

Do not change Windows security policies unless the team decides it is absolutely necessary.

## 12. Basic Testing Checklist

### Backend
- [ ] Backend starts successfully
- [ ] MongoDB Atlas connection succeeds
- [ ] No fatal server errors

### Frontend
- [ ] Expo starts successfully
- [ ] QR code appears for Expo Go
- [ ] Web app opens with `w`
- [ ] App loads without crashes

### Authentication
- [ ] Register works
- [ ] Login works

### Patient features
- [ ] Dashboard loads
- [ ] Medication CRUD works
- [ ] Schedule CRUD works
- [ ] Dose records work
- [ ] Notifications work
- [ ] Analytics works

### Caregiver features
- [ ] Caregiver login works
- [ ] Patient connection works
- [ ] Patient monitoring works
- [ ] Permission restrictions work

## 13. Postman API Testing

Team members can test the backend directly with Postman.

Steps:
1. Start the backend.
2. Use the base URL:
   ```text
   http://localhost:5000
   ```
3. Add the required JWT token for protected endpoints.
4. Use test accounts created during development.
5. Do not put real secrets, passwords, or tokens in GitHub.

The repository currently contains the backend API structure and route files, but does not include a committed Postman collection in the project root.

## 14. Common Network Problems

### `Network request failed`
Possible causes:
- backend is not running
- `EXPO_PUBLIC_API_URL` is incorrect
- phone and computer are not on the same network
- Windows Firewall is blocking port 5000
- backend is not listening on the LAN interface that the phone can reach

### MongoDB connection error
Possible causes:
- incorrect `MONGODB_URI`
- developer IP is not allowed in Atlas
- database credentials are invalid

### Web works but phone does not
This usually means the frontend is pointing to `localhost` or an invalid LAN IP instead of the computer's LAN address.

### Expo starts but app cannot connect
Check `frontend/.env.local` and restart Expo after updating environment values.

## 15. GitHub Team Workflow

The repository is the shared source of truth for the team.

Recommended workflow:

```bash
git pull
git checkout -b feature/example
git add .
git commit -m "Describe change"
git push -u origin feature/example
```

General rules:
- Each member has their own local copy.
- `.env` and `.env.local` stay local.
- Do not commit secrets.
- Pull before starting work.
- Create a feature branch for changes.
- Commit clearly named changes.
- Open a pull request for review.
- Do not overwrite other members' work without checking first.

## 16. Environment File Security

Do not commit:
- `backend/.env`
- `frontend/.env.local`

Do commit:
- `backend/.env.example`
- `frontend/.env.example`

The `.env.example` files contain placeholders only and are safe to share with the team.

## 17. Project Status / Important Notes

This is an active capstone project. Team members should avoid changing the existing architecture or authorization model without coordinating with the group.

The project currently uses a separate frontend and backend inside the same repository. The database is MongoDB Atlas, and the backend is responsible for the data and API layer while the frontend provides the mobile/web experience.

## 18. Final Notes

This README is intended to help a new team member clone the project, install dependencies, configure local environment files, run the backend and frontend, and begin basic validation without exposing private credentials.
