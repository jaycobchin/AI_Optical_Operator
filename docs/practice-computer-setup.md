# Set up Optical Operator on a practice computer

These instructions run the v0.2 pilot on one computer. Staff use its browser to open the application. Installing it does not connect to the POS automatically; the current data workflow uses reviewed CSV/XLSX imports.

The application is still a local MVP. Use synthetic or de-identified records for the initial trial. Production backup/restore and deployment hardening remain unfinished; the existing `db:backup` command points to a script that is not yet implemented. A multi-computer deployment needs a separate server, HTTPS, access and backup configuration.

The clean-install dependency audit also reports three moderate findings involving `csv-parse`, `exceljs` and its `uuid` dependency. These remain unresolved and need review before production use; the proposed automatic fixes include major version changes. The launcher update does not change these dependencies.

## 1. Install Node.js

Install **Node.js 24 LTS** for the practice computer's operating system from https://nodejs.org/en/download. Use the official installer and include npm. Internet access is needed to install dependencies.

Open a new terminal after installation. On Windows, use **Command Prompt** for the commands below; on Mac, use **Terminal**.

```text
node --version
npm --version
```

The Node.js version should begin with `v24.` or be a newer supported version.

## 2. Extract the application

Copy `AI_Optical_Operator_v0.2_setup.zip` to the practice computer and extract it into a local folder that your user can write to, such as a folder under Documents. Do not run it from inside the ZIP. Avoid a shared/network or cloud-synchronised folder for the application's database.

The package contains application source and setup instructions. It excludes the development database, account sessions, environment secrets and installed dependencies. Dependencies must be installed on the target computer.

Open a terminal in the extracted `AI_Optical_Operator` folder containing `package.json`.

Windows Command Prompt example (replace the path with your actual extracted folder):

```bat
cd /d "%USERPROFILE%\Documents\AI_Optical_Operator"
```

Mac Terminal example:

```bash
cd "$HOME/Documents/AI_Optical_Operator"
```

## 3. Run setup for your computer

Double-click the setup file for your operating system. It creates `.env` for a fresh local practice workspace, installs dependencies and builds the app. If `.env` already exists, it preserves your settings. It does not delete your database or existing accounts.

| Computer | Run once to install | Run each time to start |
| --- | --- | --- |
| Windows | `Setup-Windows.cmd` | `Start-Windows.cmd` |
| Mac | `Setup-Mac.command` | `Start-Mac.command` |

Wait for **Setup complete**. The internet connection is needed during installation. Then continue to step 5. If a Mac archive extractor removes executable permissions, open Terminal in the extracted folder and run `bash Setup-Mac.command`; later use `bash Start-Mac.command` to start. If a managed computer blocks scripts, ask its IT administrator to approve the package.

The following manual commands are an alternative to the setup files:

Run each command and wait for it to finish successfully before continuing:

```text
npm ci
npm run build
```

No separate database server is needed. The application creates a local SQLite database on startup.

## 4. Manual configuration (already handled by the setup files)

Skip this step if you ran the setup file successfully. If reusing an existing installation, review its preserved `.env` rather than overwriting it.

Copy `.env.example` to `.env` in the same folder as `package.json`.

Windows Command Prompt:

```bat
copy .env.example .env
notepad .env
```

Mac Terminal:

```bash
cp .env.example .env
nano .env
```

Replace the contents with:

```dotenv
PORT=3001
HOST=127.0.0.1
DATABASE_PATH=./data/practice.sqlite
SEED_DEMO=false
ALLOW_SIGNUP=true
APP_ORIGIN=http://127.0.0.1:3001
COOKIE_SECURE=false
AI_PROVIDER=template
```

Save as exactly `.env`, not `.env.txt`. In nano, press Control+O, Enter, then Control+X.

These settings bind the app to this computer only. `COOKIE_SECURE=false` matches this local HTTP setup; a future HTTPS deployment needs secure cookies and its own configuration. The new database path and disabled seeding keep this workspace separate from the supplied demo accounts.

## 5. Start and register

Double-click `Start-Windows.cmd` or `Start-Mac.command`, according to your computer. Alternatively, run:

```text
npm start
```

Keep that terminal window open. In Chrome or Edge, open:

**http://127.0.0.1:3001**

Select **Create a practice**, enter the practice name, your name, email and a password of at least 12 characters, then create the account. This creates the practice owner account in the local database; it does not use the demo login.

After creating the account:

1. Stop the app with Control+C in its terminal.
2. Change `ALLOW_SIGNUP=true` to `ALLOW_SIGNUP=false` in `.env`.
3. Save the file and open your Start file again, or run `npm start`.
4. Sign in with the account you just created.

Disabling registration does not remove the existing account.

## 6. Try the workflow

Open **Data → Download sample CSV** to obtain synthetic records. Upload the CSV, review the suggested column mapping, run validation, and approve the valid rows. The sample intentionally includes a bad date to exercise validation.

Open **Opportunities** to review the imported records, generate and edit a draft, then approve and queue it. Use **Campaigns** to simulate delivery and record outcomes. This version does not send actual patient messages.

For later authorised POS imports, export patients first, followed by transactions, appointments, visits or orders with matching patient IDs. The exact export and mapping steps depend on the POS vendor and version. Installing this package does not enable Plato or any other live connector.

## Day-to-day startup

Double-click `Start-Windows.cmd` or `Start-Mac.command` and open the bookmarked browser address. You can also open the application folder in a terminal and run `npm start`. The app stops when its process is stopped or the computer shuts down; this package does not install an automatic startup service.

Closing a browser tab does not stop the server. To shut it down, use Control+C in its terminal. Records persist in `data/practice.sqlite`; do not delete the data folder when updating the application.

The address `127.0.0.1` always means the computer running that browser. It will not connect another practice computer to this installation. Arrange a separate deployment configuration before expanding access to other devices.

## Common setup issues

- **`npm` or `node` is not recognised:** reopen the terminal after installing Node.js and check `node --version`.
- **Cannot find `package.json`:** change into the extracted application folder, rather than its parent or the ZIP.
- **The demo screen appears:** check that `.env` is correctly named, `SEED_DEMO=false`, and the app was restarted using `npm start`.
- **No “Create a practice” option:** temporarily set `ALLOW_SIGNUP=true` and restart for initial registration.
- **Browser cannot connect:** check that `npm start` is still running without errors and that you are opening port 3001 on the same computer.
- **Port 3001 is already in use:** use a free port such as 3002, update both `PORT` and `APP_ORIGIN` in `.env`, restart, and open the matching browser address. Do not stop an unfamiliar process that may belong to the POS.

The Mac setup and start files were tested from a freshly extracted package in a folder containing spaces. Installation, the production build, frontend serving and fresh registration settings passed. Separate setup tests verify that rerunning configuration preserves an existing `.env` and database. The Windows launchers are included but have not been executed on a Windows computer yet.
