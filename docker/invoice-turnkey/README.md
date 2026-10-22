# Running MOF e-Invoice Turnkey 3.2.x on Docker

This directory explains how to run the Ministry of Finance (MOF) e-Invoice **Turnkey** program in a Docker container, next to the `@rytass/invoice-turnkey-base-nestjs-module` NestJS module. It is written for an engineer who has never set up Turnkey before. Follow the sections in order:

1. Overview
2. Platform prerequisites (IP whitelist, certificates, track allocation)
3. Build the image
4. Database
5. First-time configuration
6. Persistence and layout
7. Running with the NestJS modules
8. B2B exchange prerequisites
9. Verification samples
10. Operations and troubleshooting
11. Backup
12. Upgrading Turnkey
13. Production cut-over

## What this directory contains and what it does not

Contained here (written by us):

- `Dockerfile`: builds the image from the official installer.
- `turnkey-entrypoint.sh`: container entrypoint. Creates the default config, keeps config and work directories on the volume, and turns `docker stop` into a graceful shutdown.
- `compose.example.yaml`: example stack with PostgreSQL, Turnkey and the NestJS app.
- `.dockerignore` and `.gitignore`: keep the installer, secrets and local compose files out of the build context and out of git.
- `samples/`: a `send.sh` test tool and de-identified MIG 4.1 XML templates for test-zone verification.

Not contained (you must obtain it yourself):

- The Turnkey installer `EINVTurnkey_setup_3.2.2.tar.gz`. It is licensed by MOF. Get it from the official channel and do not commit it.
- The official manuals and PDFs. This document only cites their titles and page numbers.
- The database schema SQL. Use the `DBSchema/PostgreSQL` script that ships with the Turnkey package (see section 4).
- The MIG 4.1 XSD files. They are optional for `send.sh`.

Status: validated against the **test platform** (validation zone) with the storage invoice flows (issue, void, annul, allowance) and with a B2B exchange round trip between two test-zone companies. Production has not been validated from this repository yet (see section 13).

## 1. Overview

```
+------------------------+                        +------------------------+
|  app (NestJS)          |   /data (shared        |  turnkey               |
|  TurnkeyBaseModule     |<-- named volume) ----->|  Turnkey 3.2.2         |
+-----------+------------+                        +-----------+------------+
            |                                                 |
            | app DB: read-write                              | einvturnkey DB:
            | einvturnkey DB: read-only                       | read-write (owner)
            v                                                 v
+---------------------------------------------------------------------------+
|  db (PostgreSQL 16)                                                       |
|    app database       module tables (turnkey_*)                           |
|    einvturnkey        Turnkey tables; app role has column-level SELECT    |
+---------------------------------------------------------------------------+

turnkey  --- HTTPS Web API (443) and SFTP (2222) ---> MOF e-Invoice platform
             The platform accepts only the source IP you registered.
```

Key points:

- The app and Turnkey share one volume, `/data`. The app writes MIG 4.1 XML into `UpCast/<category>/<message>/SRC/`. Turnkey signs, packs and uploads it, and writes the platform replies back to `/data`.
- Turnkey reports results into its own PostgreSQL database. The app reads that database through a dedicated read-only role. It never writes to Turnkey's tables.
- Turnkey makes the outbound calls to the platform. The egress IP of the Turnkey container is the IP that must be registered with the platform.

## 2. Platform prerequisites

Do these before you expect any message to be accepted. Each step is blocked by the previous one, and some take several business days.

### 2.1 Register the fixed egress IP

- Apply for Turnkey transmission on the MOF platform and give the **fixed outbound IP** of the host or cluster that runs the Turnkey container. For GKE, this is the static IP of Cloud NAT used by the node pool that runs Turnkey.
- The IP must be a non-mainland-China address (platform requirement). Review takes about 3 business days.
- Test zone and production zone are applied for separately.
- If the IP is not yet active, the TLS handshake to the Web API fails (`SSLHandshakeException`). The text-mode connection test then reports "connection failed" or "check update failed".
- SFTP uses port 2222; the Web API uses HTTPS. Allow both outbound from the Turnkey container.
- Manual reference: `營業人Turnkey傳輸線上申請說明.pdf` (Turnkey transmission online application guide).

### 2.2 Register a master certificate

- You need an industrial/commercial certificate (工商憑證) **IC card, main card (正卡)**, plus a card reader and the card PIN.
- In the platform, under the business taxpayer menu: Basic information, then the business certificate registration, then the master-certificate registration. This must exist before software certificates can be registered.
- Manual references: the platform manual "營業人導入與操作說明" (pp. 23–24 for registration; pp. 31–33 for the master certificate).

### 2.3 Create a software certificate and register it

Turnkey uses a **software certificate** (PFX). IC cards are not suited to the container, and the installer does not ship the PKCS#11 reader library.

1. In Turnkey, `Tools → Create software certificate` (`工具 → 製作軟體憑證`):
   1. Generate the key. The key password is 8 alphanumeric characters.
   2. Generate the CSR and upload it to the platform to get the CER (issued by the certificate authority).
   3. Combine the key and the CER into a PFX.
2. The CER format matters. The platform requires **Base-64 (PEM) X.509**. Some certificate authorities deliver DER (binary). Convert with:

   ```bash
   openssl x509 -inform DER -in issued.cer -outform PEM -out issued-pem.cer
   ```

   Check that the certificate matches the key before uploading (compare the modulus hashes):

   ```bash
   openssl x509 -in issued-pem.cer -noout -modulus | openssl sha256
   openssl rsa  -in key.pem        -noout -modulus | openssl sha256   # use your own key file
   ```

3. Register the CER in the platform: business certificate registration, then the software certificate registration. Select the CER, press "register software certificate", check the contents, then confirm. Save a screenshot or note the certificate serial.
   - If the certificate is not registered, the platform rejects uploads with `E0310` (or `E0301` "certificate validation failed"). The rejection happens before the track check, so track problems stay hidden until the certificate is registered.
   - One software certificate can be used in both the test zone and the production zone, but it must be registered in each zone.
   - Manual references: "營業人導入與操作說明" (pp. 36–37, software certificate registration); `電子發票Turnkey使用說明書.pdf` (p. 93, Turnkey side of the same step).
   - The manual does not say whether the IC card must be inserted for the software certificate step. Keep the master card and reader ready.

### 2.4 Allocate invoice tracks

- In the platform, run the "electronic invoice track number allocation (business)" function (`電子發票專用字軌號碼取號(營業人)`). First query the current period; allocate only if nothing is allocated.
- The allocation is per period (期配). You set the quantity once; the platform then allocates each following period. Use the general-tax invoice category (`07`), which is the category used in the samples.
- The test zone is capped at 50 books per allocation. Test invoices must use numbers that were really allocated to you.
- Manual references: "營業人導入與操作說明" (pp. 73–79, track allocation); "電子發票專用字軌號碼取號使用說明書" (pp. 6–10, allocation screens).
- Turnkey can also receive the allocation as an `E0501` message, which the ReceiveFile schedule downloads to `ReceiveFile/BAK/E0501`. Do not assume every allocation arrives this way. Check the platform, and register the number range in the module (invoice track registration).

### 2.5 Pre-launch self-test

The MOF "Turnkey pre-launch self-test" (上線前自行檢測) is required before production. Step 2 of that document requires registration and master-certificate registration on both platforms, and track allocation in the test zone. See `Turnkey 上線前自行檢測作業` (Ver 4.7.1), STEP 2, p. 12.

Manual index used in this document:

- `電子發票Turnkey使用說明書.pdf`: Turnkey manual. Ver 4.1 p. 93 (software certificate, Turnkey side); pp. 19–20 (B2B status lifecycle); pp. 298–330 (error code list); MIG 4.1 p. 134 (annul rules).
- `營業人導入與操作說明` (platform manual): pp. 23–24, 31–37, 73–79. The PDF file name is not recorded here, so search the platform download page for this title.
- `電子發票專用字軌號碼取號使用說明書`: pp. 6–10.
- `Turnkey 上線前自行檢測作業` (Ver 4.7.1): STEP 2, p. 12.
- `營業人Turnkey傳輸線上申請說明.pdf`: IP and transmission application. Page numbers were not recorded.
- Page numbers are the PDF viewer page numbers.

## 3. Build the image

### 3.1 Put the installer next to the Dockerfile

Download the official installer and place it in this directory, with the file name the Dockerfile expects:

```
docker/invoice-turnkey/
  Dockerfile
  EINVTurnkey_setup_3.2.2.tar.gz     <- you place this; it is gitignored
  turnkey-entrypoint.sh
  ...
```

The build context is this directory. `.dockerignore` excludes everything except the installer and the entrypoint, so secrets and compose files never reach the Docker daemon.

### 3.2 Build

```bash
cd docker/invoice-turnkey
docker build --platform linux/amd64 \
  --build-arg TURNKEY_TARBALL=EINVTurnkey_setup_3.2.2.tar.gz \
  -t einv-turnkey:3.2.2 .
```

Notes:

- The base image is `eclipse-temurin:17-jre-jammy` (OpenJDK 17). Validated with Temurin 17 and PostgreSQL 16.
- The installer ships an empty `jre/` directory. The start scripts use the system Java only when `JAVA_HOME` is set and a `./javahome` marker file exists. The Dockerfile sets both.
- The installer includes a JavaFX jar for Linux x64. Text mode and background schedules do not start a GUI toolkit, so no GTK or X11 packages are needed.
- Build and run for `linux/amd64`. On Apple Silicon, Docker Desktop runs the image under emulation; this works for validation, but use native amd64 hosts for production.
- The image contains the installer. Do not push it to a public registry.

## 4. Database

Turnkey needs a relational database. This setup uses PostgreSQL 16 (validated).

### 4.1 Create the database and run the schema

1. Create the database owner and database (the compose example does this through `POSTGRES_USER` and `POSTGRES_DB`).
2. Create the Turnkey tables from the schema script that ships with the Turnkey package, under the `DBSchema/PostgreSQL` folder of the installer. Example:

   ```bash
   docker compose exec -T db psql -U turnkey -d einvturnkey < /path/to/DBSchema/PostgreSQL/PostgreSQL.sql
   ```

   The script creates a default Turnkey administrator account. Change its password in the text-mode menu and do not keep the default. Do not copy the script into this repository.

   `-T` is correct here because the input is redirected. Only the interactive Turnkey menu needs a TTY (section 5.1).

### 4.2 Store the database password in encrypted form

Turnkey does not store the database password in plain text. Its configuration holds an encrypted string that starts with `{CHTAE7}`.

- Enter the password in the text-mode menu (`Transmission settings → Basic settings → Database connection settings`, type PostgreSQL, enter the host `db`, port `5432`, the database name, the user and the password; you are asked for the password twice). Save, then `Create database`.
- Afterwards the encrypted string is in `/data/config/einvUserConfig.xml`. Keep a copy in your secret store. You need it for the recovery in section 10.8.
- Creating the encrypted string with `Tools → Password encryption` is possible in principle, but it has not been validated. Use the menu entry above.

### 4.3 Give the app a read-only role

The app reads Turnkey's results (message status and error codes) from the Turnkey database. Create a dedicated role with column-level `SELECT` only. The exact `GRANT` statements, and why they are column-level, are in the base module README:

- `packages/invoice-turnkey-base-nestjs-module/README.md`, section "Turnkey database access"

Never grant `SELECT` on the password columns of Turnkey's configuration tables. The module never uses `SELECT *`.

## 5. First-time configuration

### 5.1 Text mode needs a TTY

The text-mode menu logs in through `java.io.Console`, so it **needs a TTY**:

```bash
docker compose exec turnkey turnkey-entrypoint cmd   # no -T, so a TTY is allocated
```

Using `-T`, or piping input into it, makes the menu exit immediately.

The default credentials of the text-mode login are documented in the official Turnkey manual. Change them after the first login. Do not write them in this repository.

Also:

- You can open text mode while the background schedules are running, to read settings. After changing any setting, restart the container so the schedules read the new configuration: `docker compose restart turnkey`.
- Do not enable `System environment settings → Startup password`. `run_start.sh` then waits for keyboard input with no TTY, and the verification key files are written into the install directory and lost on rebuild.
- When the platform connection is open and text mode asks whether to update (`Y/N`), answer **N**. Upgrade by replacing the installer (section 12), not from the menu.
- Quit text mode through the menu: press `q` until you reach the top menu, then choose `5` (exit). If the input stream ends (EOF) without this, `TurnkeyCmd` loops forever writing logs, and the JVM can grow to about 480 MB.

### 5.2 Configuration order

Do the steps in this order. Each one depends on the previous.

1. `Transmission settings → Basic settings → Database connection settings`: as in section 4.2. Then `Create database`.
2. `System environment settings → System settings`: set the execution environment to test or production. Use test for the test zone.
3. `Evidence (storage) directory settings`, plus the directories you need for B2B exchange, download flow and invoice number messages. Save each one. Saving creates the directories under `/data`.
4. `Tools → Create software certificate`: generate key, CSR, upload the CSR to the platform, register the CER (section 2.3), combine into a PFX. Output goes to `/data/cert/PFX/`.
5. `Basic settings → Certificate management → Add`: certificate code **4 characters** (for example `0001`; an 8-character code fails with "field length"), the certificate password (the same as the key password), type `PFX`, and the path to the PFX under `/data`.
6. `Basic settings → Transmission account management → Add`: the Turnkey transmission account and its password, as issued by the platform.
7. `Basic settings → Sender management → Add`: sender tax ID, certificate, transmission account, and the redirect code (繞送代碼) issued by the platform. Saving fails with "sender certificate cannot be empty" unless step 5 is done.
8. `Transmission settings → Schedule settings → Add schedule`: see section 5.3. The schedule weekdays must include at least one day; pick "all".
9. `Basic settings → Environment check`: run the database, transmission account, SFTP, Web API and data directory checks in turn. All must pass before you rely on the setup.

### 5.3 Schedules: four tasks are required

Add four schedule entries. A missing entry leaves the flow incomplete with no error at the platform.

| Menu task (English gloss)  | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `A:發票上傳` (Upload)      | Packs and uploads files from `UpCast`                      |
| `A:發票下載` (ReceiveFile) | Downloads platform replies and messages to `ReceiveFile`   |
| `D:下載拆封` (Unpack)      | Unpacks downloaded files; writes results to the Turnkey DB |
| `D:下載轉檔` (DownCast)    | Converts downloaded messages to XML in `RecvTarget`        |

Each entry: type `PERIOD`, interval `00:01`, weekdays "all". Before adding the ReceiveFile entry, save the download flow directory setting, or the schedule fails with `null task config`.

Warnings:

- **Upload and ReceiveFile alone are not enough.** Without Unpack, downloaded replies (for example `A0102`, `A0301`) stay in `/data/Unpack/SRC/` and are never converted. `ProcessResult` and `SummaryResult` are only written to `turnkey_message_log` during Unpack. Without it, the module's submissions stay in `WRITTEN` forever.
- Without DownCast, nothing reaches `RecvTarget`, so the module never sees exchange replies.
- Restart the container after changing schedules: `docker compose restart turnkey`.

For reference, the menu keystrokes recorded on 3.2.2 to add the Unpack and DownCast entries were `1 1 1 2 1 1 4 8 q 6 00:01 8`. Menu numbers shift as entries are added, so read the screen instead of replaying keystrokes.

### 5.4 Non-interactive database setup (optional)

You can skip the menu for the database step when automating. Verified:

1. Create the schema (section 4.1).
2. In `/data/config/einvUserConfig.xml`, set `db-type` to `postgresql`, `jdbc-driver` to `org.postgresql.Driver`, `jdbc-url`, `db-user`, and `db-password` (the `{CHTAE7}` string from section 4.2). Set `db-config-ok` to `true`.
3. Restart the container.

Copying the `{CHTAE7}` string from a configuration that was set up once in the menu is the reliable way to get it.

### 5.5 Restrictions inside the container

- All paths must be under `/data`. This applies to the PFX output, the certificate path, and every directory setting. Paths elsewhere are lost when the container is recreated.
- Only **software certificates (PFX)** are supported. The installer does not include the PKCS#11 reader library, and the container is not suited to IC card readers.
- Changes to the configuration go through the menu, never by editing the Turnkey database tables directly. The table formats are not a public interface.

## 6. Persistence and layout

### 6.1 The volume

Only `/data` is a volume. The entrypoint links the install directory's config to it on every start.

```
/data/
  config/einvUserConfig.xml   real config; the install dir holds a symlink to it
  cert/PFX/                   software certificate: key, CSR, PFX
  log/                        logs with the file-log prefix turnkey (for example turnkey-SYS.log)
  UpCast/                     upload work area; SRC/ is where the app writes XML
  Pack/ SendFile/ ...         work directories (def-path is /data)
  ReceiveFile/                platform replies and downloaded messages (BAK/)
  Unpack/                     unpacked downloads, SummaryResult and ProcessResult
  RecvTarget/<message>/       converted inbound XML, read by the module
  sidecar/tmp/                module writer staging directory (same file system as UpCast)
  sidecar/inbound/            archive of processed RecvTarget files (module)
```

Mount `/data` as one volume. Do **not** mount the Turnkey install directory, which holds the program and the symlink.

The entrypoint sets `def-path` to `/data` and the log prefix to `/data/log/turnkey` on the first start. Do not change these by hand.

### 6.2 Same file system for the writer

The module writes each XML first into `sidecar/tmp`, flushes it, and then renames it into `UpCast/.../SRC/`. A rename is atomic only on one file system. Keep `/data` on one volume, or at least keep `sidecar/tmp` and `UpCast` on the same mount.

The writer never creates `SRC` directories. Turnkey creates them when it runs. If the directory is missing, `dataPath` does not point at Turnkey's data volume; the submission stays `PENDING` with an error in the log.

### 6.3 Permissions and UID

Turnkey runs as root, so the directories it creates are root-owned, and the app must still create files and rename into them:

- `sidecar/tmp` and `sidecar/inbound`: the app creates and moves files here.
- `UpCast/.../SRC`: the app writes and renames XML here. Turnkey creates these directories.
- `RecvTarget/<message>`: the app moves processed files out (archive).

The compose example runs the app as `1000:1000` through `APP_UID` and `APP_GID`. **This alone does not make `/data` writable by the app.** Before relying on it, confirm that the app's user can create and rename files in those directories, for example by running a write test as that user in the app container.

Options, none of which is validated in this repository yet:

- Give the app and Turnkey a shared group, and make Turnkey create group-writable directories (for example by setting `umask 0002` in the entrypoint before `run_start.sh`). Check that existing directories also get the group bit.
- Run the app as root. Simplest, least secure.
- On Kubernetes, set `fsGroup` on the pod securityContext and use a volume that supports it (see section 7.4).

Writer files are created with mode `0664`.

## 7. Running with the NestJS modules

### 7.1 The compose example

`compose.example.yaml` runs three services:

- `db`: PostgreSQL 16. `restart: unless-stopped`. The DB superuser password comes from a Docker secret.
- `turnkey`: built from this directory. `restart: unless-stopped`, `stop_grace_period: 60s`, and the `turnkey-data` volume on `/data`.
- `app`: your NestJS image, with the same `turnkey-data` volume on `/data`, `DATABASE_URL`, `TURNKEY_DATABASE_URL` (the read-only role from section 4.3), and `TURNKEY_SECRET_KEY`.

Usage:

```bash
cd docker/invoice-turnkey
cp compose.example.yaml compose.yaml
mkdir -p secrets && printf '%s' 'CHANGE-ME' > secrets/db_password.txt
# .env (gitignored) must define: APP_IMAGE, APP_DB_PASSWORD, TURNKEY_SIDECAR_PASSWORD, TURNKEY_SECRET_KEY
docker compose up -d db turnkey
docker compose exec turnkey turnkey-entrypoint cmd    # first-time setup, section 5
docker compose restart turnkey                         # start schedules
docker compose up -d app
```

The compose project name is `einv-turnkey`, so the volume is `einv-turnkey_turnkey-data`. Adjust backup commands (section 11) to your project name.

### 7.2 Passwords and environment variables

- The DB superuser password is a Docker secret (`secrets/db_password.txt`). The Turnkey DB password you type in the menu must match it.
- The app's passwords and `TURNKEY_SECRET_KEY` come from `.env` or your secret manager through `${VAR:?}` interpolation. The compose file fails to start if one is missing.
- URL-encode special characters in the passwords used in `DATABASE_URL` and `TURNKEY_DATABASE_URL`.
- `docker inspect` shows environment variables. For production, use Docker secrets or Kubernetes secrets instead.

### 7.3 Workers run on one instance

The module's background workers (writer, poller, inbound watcher, hourly maintenance) run only on the instance that holds a PostgreSQL session advisory lock. Run one app instance with workers enabled. Any additional instance (for example an API-only replica) must set `workers.enabled: false`. See the base module README, section "Background workers".

### 7.4 Kubernetes

- Turnkey and the app must share `/data`. Put them in the **same Pod** with a shared volume, or use a **ReadWriteMany** volume that both Pods mount.
- Run exactly one Turnkey container per `/data` volume. This is how the setup was validated; running two against one volume has not been tested.
- Use the fixed egress IP (section 2.1) for the node pool that runs the Turnkey Pod.
- Use `fsGroup` for write access (section 6.3).

## 8. B2B exchange prerequisites

B2B exchange (A0101 to B0202) depends on the buyer. Read this section before testing B2B.

- **The buyer must set up receiving on the platform.** Without it, the platform cannot route the message to the buyer.
  - Turnkey looks up the buyer's redirect code (`Tools → Query redirect code`). If the buyer has no receiving method, Turnkey's Pack stage stops locally with `queryToBan [receive failed: receiving method not set]`. The file moves to `Pack/B2BEXCHANGE/ERR/` and is **not sent**. The invoice number is not used up.
  - If you set the redirect code by hand in `Transmission settings → Recipient settings`, Pack passes, but the Web API call is rejected with `E0145: receiving method not set`. Turnkey writes no `ProcessResult` in that case. The file moves to `SendFile/B2BEXCHANGE/ERR/`.
  - A manual recipient setting does not bypass the buyer's platform setting. Remove any manual setting and let Turnkey look it up.
  - Turnkey caches the looked-up recipient in `Transmission settings → Recipient settings` (marked "Insert by Turnkey"). When the buyer later changes the receiving method, for example from the platform web to its own Turnkey, the cached entry is stale and the platform rejects the send with `E0146` (receiving method changed). Delete that buyer's entry in `1 → 3` and retry the submission. The XML is unchanged, so a retry is enough.
- **The seller address is required.** A0101 and B0101 must carry `Seller.Address`, as must the storage messages F0401 and G0401 (MIG 4.0). Without it, Turnkey rejects the file locally with `[7001] "Seller.Address" is invalid` and nothing is sent. The module refuses any invoice or allowance for a company without `address` (`SELLER_ADDRESS_REQUIRED`) before a number is taken.
- Create the exchange directories through the menu: `1 → 2 → 3 → 5` creates `UpCast/B2BEXCHANGE/` with the `A0101` to `B0202` folders (version 4.1).
- Message flow:
  - Issue: seller sends A0101; buyer replies A0102 (confirm) or A0301 (reject).
  - Void: seller sends A0201; buyer replies A0202.
  - Reject acknowledgement: seller sends A0302 after A0301.
  - Allowance: seller sends B0101; buyer replies B0102.
  - Allowance void: seller sends B0201; buyer replies B0202.
  - The status only moves forward. The lifecycle is described in the Turnkey manual, pp. 19–20.
- Buyer replies come back over SFTP (ReceiveFile), are unpacked (Unpack) and converted (DownCast) into `RecvTarget/<message>/*.xml`. The module's inbound watcher reads them there.
- Field notes from the test zone:
  - In `A0302`, `RejectDate` and `RejectTime` must be copied exactly from the `A0301` message.
  - In `A0202` and `B0202`, `CancelDate` and `CancelTime` are the buyer's confirmation time, not the seller's void time. Match by `CancelInvoiceNumber`.
  - Buyer web confirmations: a void of an invoice is confirmed under `確認作廢發票` (confirm invoice void). An allowance void is confirmed under `確認作廢折讓通知` (confirm allowance-void notice). Open the document first, then press send ("寄送"). Sending without opening it fails with "the seller has not read this allowance". The message is misleading: the buyer has not read it.
  - The buyer's certificate must be registered on the platform. If it is not, the buyer's web page shows "certificate validation failed" and the seller receives nothing.
  - If the buyer's signing window is not completed, the platform does not send the confirmation.
  - When a buyer confirmation for `B0202` does not arrive, check these three things in order: the buyer opened the document, the buyer's certificate is registered, and the buyer finished the signing step.
- Test-zone timing: a platform reply arrives about one minute after the send; the seller's Turnkey downloads the buyer's reply about one minute after the buyer's send.

## 9. Verification samples

`samples/` contains a test tool and de-identified MIG 4.1 XML templates. Use them in the test zone to confirm the setup before you wire up the app.

- `samples/send.sh`: fills a template, optionally validates it against XSD, copies it into `UpCast/<category>/<message>/SRC/` in the container, waits for the platform `ProcessResult`, and prints the decoded code and description.
  - Usage: `NO=ZZ12345601 DATE=20260101 TIME=10:00:00 RAND=1234 ./send.sh F0401-B2B.xml ZZ12345601`
  - Placeholders are `__KEY__`, filled from environment variables of the same name. The script stops if a placeholder is left unfilled.
  - Use `WAIT_ONLY=1` to only wait for an existing reply, without sending again.
  - The compose file defaults to `../compose.yaml`. Override it with `COMPOSE_FILE=../compose.example.yaml` if needed.
  - Read the Turnkey log with `grep -a`. The log accumulates binary content, and a plain `grep` only reports "binary file matches".
  - Before resending a file with the same name, rename the old file in `UpCast/.../ERR/` (or the `ERR` directory it moved to). Otherwise `send.sh` finds the old error file and reports a failure that did not happen this time.
- XSD validation is optional. Put your own MIG 4.1 XSD files in a directory and set `XSD_DIR`. This repository does not include the XSD files.
- Templates (one per message type, in `samples/`):
  - Storage invoices: `F0401` (B2C paper print, B2C carrier, B2C donation, B2C free-tax, B2C mixed-rate, B2C multi-item, B2B, B2B mixed-rate, B2B multi-item, B2B zero-rate); `F0501` (void); `F0701` (annul, B2C only, then reissue with the same number); `G0401` (allowance); `G0501` (allowance void).
  - `G0701` (annul allowance) is in the folder for reference only. Turnkey 3.2.2 does not support it, and the platform does not allow annulling B2C allowances (E0230).
  - Blank numbers: `E0402` (report unused numbers of a period; one track per file; `YearMonth` is the two-month period, for example `11510` for September to October 2026).
  - B2B exchange: `A0101`, `A0201`, `A0302`, `B0101`, `B0201`.

Observed in the test zone (for orientation, not as a guarantee):

- The platform's real-time `ProcessResult` checks very little. It accepted several payloads that the rules say are wrong: totals that do not add up, invalid tax-ID check digits, nonexistent charity codes, malformed carrier codes, allowances above the invoice amount, voids of nonexistent invoices, out-of-order dates, and reuse of numbers already declared blank.
- It rejects only a few cases in real time: duplicate messages (`E0201`), future dates (`E1002`), certificate problems (`E0301`, `E0310`), and buyer receiving setup for exchange (`E0145`).
- Turnkey's local checks in the UpCast stage catch some payloads before they reach the platform (log line `validateSourceFileByProg … [7001]`). The file moves to `UpCast/.../ERR/`, and the number is not used up. Known cases: a B2B invoice with `PrintMark` N, a zero-rate invoice without `CustomsClearanceMark`.
- The next-day `SummaryResult` did not catch the same payloads either.
- Conclusion: **the issuing system must do these checks itself.** See section 10.3.

## 10. Operations and troubleshooting

### 10.1 Container lifecycle

- `start` (default): runs the schedules. If the database is not configured yet (`db-config-ok` is not `true`), the entrypoint stays idle and does not start the schedules, so you can `exec` in and configure it.
- `docker stop`: the entrypoint traps SIGTERM and runs `run_stop.sh`, which exits in about 5 seconds with code 0. Bash as PID 1 does not forward SIGTERM by itself, which is why the entrypoint does this. `stop_grace_period: 60s` leaves a buffer.
- Unexpected exit of the schedule process: the entrypoint exits with a non-zero code, and `restart: unless-stopped` restarts it.
- `EINVUPGRADE/` in the install directory is deleted at every start. Automatic in-container upgrade is not supported. Upgrade by rebuilding the image (section 12).

### 10.2 Common failures

| Symptom                                                              | Cause                                                                             | Action                                                                                                                                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turnkey restarts in a loop                                           | The database is down, or `db` has no `restart` policy                             | Set `restart: unless-stopped` on `db` too. Without it, Docker Desktop restarts leave the DB down.                                                                          |
| `SSLHandshakeException`, "connection failed"                         | IP not registered yet, or the request leaves through a different IP               | Check the registered IP and the egress path (section 2.1). Allow outbound 443 and 2222.                                                                                    |
| `E0301` / `E0310`                                                    | Software certificate not registered in this zone                                  | Register the CER in that zone (section 2.3).                                                                                                                               |
| Sender save fails with "sender certificate cannot be empty"          | Sender saved before the certificate exists                                        | Complete certificate steps 4 and 5 first.                                                                                                                                  |
| Certificate code rejected, "field length"                            | Code must be 4 characters                                                         | Use a 4-character code such as `0001`.                                                                                                                                     |
| Schedule fails with `null task config`                               | The download flow directory was not saved                                         | Save `Download flow directory settings` first, then add the schedule.                                                                                                      |
| Submissions stay `WRITTEN`                                           | Unpack or DownCast schedule missing, or the reply is an error                     | See 10.4.                                                                                                                                                                  |
| `E1002` future date                                                  | Invoice date is later than the platform date                                      | Fix the invoice date.                                                                                                                                                      |
| `E0201` on a resend                                                  | The platform already has this message                                             | Do not resend. The first copy is kept and never overwritten. Check the first `ProcessResult`.                                                                              |
| `[7001] CustomsClearanceMark can not be null`                        | Zero-rate invoice without the clearance mark                                      | Fill the field. Turnkey blocks it locally; nothing was sent.                                                                                                               |
| B2B invoice blocked locally with `[7001]`                            | `PrintMark` is N on a B2B invoice, which has no carrier fields, so it must be Y   | Set `PrintMark` to Y for B2B.                                                                                                                                              |
| `[7001] "Seller.Address" is invalid` on F0401, G0401, A0101 or B0101 | The company has no address                                                        | Set the company `address`, then issue again under a new number. A retry resends the same XML and fails again. Abandon the failed number and report it blank at period end. |
| `E0146` on an exchange send                                          | The buyer changed its receiving method; Turnkey's cached recipient entry is stale | Delete the buyer's entry in `1 → 3` (Recipient settings), then retry the submission (section 8).                                                                           |

### 10.3 Checks the issuing system must do

The platform does not check these in real time, and the next-day summary does not flag them either. Implement them in the app, before the XML is written:

| Check             | Rule                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Line totals       | Line amounts add up to `SalesAmount`. B2C line amounts are tax-inclusive list prices.                                                          |
| Tax and totals    | Tax = sales x rate, rounded to an integer. `TotalAmount` = sales + tax.                                                                        |
| Buyer tax ID      | Weighted sum divisible by 5. If the 7th digit is 7, weighted sum + 1 must be divisible by 5 instead (rule in effect since 2023).               |
| Carrier           | Mobile barcode is `/` plus 7 characters. Carrier fields are empty for B2B.                                                                     |
| Donation code     | Must exist in the charity list downloaded from the platform.                                                                                   |
| Allowances        | Cumulative allowances must not exceed the invoice. Allowance `Amount` is untaxed; `Amount` and `Tax` are integers (50 tax-inclusive = 48 + 2). |
| Numbers and dates | Number inside the allocated track range; dates move forward with numbers; no future-dated invoices.                                            |
| Blank numbers     | A number declared blank in `E0402` is never issued again.                                                                                      |
| Zero-rate         | Clearance mark and a zero-rate reason code (71 to 79) are required.                                                                            |

Annulment (`F0701`) is only for system errors that require reissuing under the same number. Wrong entries are voided and reissued under a new number. Returns and price reductions use allowances. Using annulment for other purposes can violate the business tax act (articles 48 and 51); the Turnkey manual cites MIG 4.1 p. 134 for this rule.

### 10.4 Submissions stuck in WRITTEN

Work through these in order:

1. Confirm that all four schedules exist (section 5.3). Without Unpack and DownCast, no result is ever written.
2. Find the file in Turnkey: `UpCast`, `Pack`, `SendFile` and their `ERR/` folders.
3. Search the log with `grep -a`, for example `grep -a 'moveSourceToError' /data/log/turnkey-SYS.log`, and read the `ERROR` lines above it.
4. Look up the message in Turnkey's `turnkey_message_log` by the submission's Turnkey UUID (`turnkeyUuid`), selecting only the needed non-secret columns. The app's read-only role only has the columns the module uses; query other columns with a Turnkey administrator account. The `ProcessResult` files are under `/data/ReceiveFile/` (`BAK/` after processing) and hold the platform's code.
5. If the module emits `submission.stalled` (default after 120 minutes with no result), do not resend. The platform may still accept it later, and resending can issue the same invoice twice. Voids and annulments of that document are refused until it resolves. Check the file by hand.
6. Once you know the outcome, close the submission with the module's manual resolve API (REST `POST /companies/{taxId}/submissions/{id}/resolve`, GraphQL `resolveTurnkeySubmission`): `ACCEPTED` if the platform has the document, `FAILED` if it never reached the platform. A `FAILED` submission can then be retried (REST `POST .../submissions/{id}/retry`, or `retry()` in `@rytass/invoice-adapter-turnkey`). Do not edit the module's tables by hand.

### 10.5 SummaryResult and ProcessResult

- `ProcessResult` is a Base64-encoded PKCS#7 signature file. Decode and verify it with:

  ```bash
  base64 -d < file.ProcessResult | openssl cms -verify -noverify -inform DER
  ```

- `SummaryResult` is generated per send date (not invoice date), at about 01:00 the next day. It lists `Good` and `Failed` messages with numbers and invoice dates, **without error codes**. To find the reason for a failure, look up the same message's `ProcessResult` in `turnkey_message_log`.
- Use `SummaryResult` for reconciliation: compare the list of messages the app sent that day with the `Good` list. The module emits `reconciliation.completed` after 01:30 Taipei time.

### 10.6 Logs

- Logs are under `/data/log/` with the prefix `turnkey`, for example `turnkey-SYS.log`. The log accumulates binary content. Always use `grep -a`.
- `docker compose logs -f turnkey` shows the entrypoint messages. Read the Turnkey file log under `/data/log/`.

### 10.7 Things that must not happen

- Do not run two Turnkey containers on one `/data` volume.
- Do not change the Turnkey tables directly to fix a setting. Use the menu.
- Do not resend a message that has an `E0201` or a `WRITTEN` status without checking the platform first.
- Do not enable the startup password in the container (section 5.1).

### 10.8 Database full: PostgreSQL PANIC

When the Docker VM or the database volume runs out of disk, PostgreSQL panics. Turnkey then cannot reach the database and does two things: it sets `db-config-ok` to `false` in the config, and it **clears `db-password`**. The entrypoint goes to standby and the schedules stop.

Recovery:

1. Free disk space and bring PostgreSQL back up. Check it passes `pg_isready`.
2. Restore the encrypted `{CHTAE7}...` password string from your secret store into `db-password` in `/data/config/einvUserConfig.xml`.
3. Set `db-config-ok` to `true`.
4. Restart the container: `docker compose restart turnkey`.

This is why the encrypted password string must be backed up (section 11).

## 11. Backup

Back up these items. Store them encrypted; none of them belongs in git.

- The `/data` volume, which contains:
  - `config/einvUserConfig.xml`: includes the encrypted DB password string, which you need after a database-full event (10.8).
  - `cert/PFX/`: the software certificate, including the private key. Keep the key password separately.
  - `log/` (optional), `UpCast/`, `Pack/`, `SendFile/`, `ReceiveFile/`, `Unpack/`, `RecvTarget/` and `sidecar/` (in flight work).
- The Turnkey database (`einvturnkey`): message logs, configuration and the default admin account. Use a logical dump such as `pg_dump`. Treat it as sensitive.
- The app database, including the module's `turnkey_*` tables.
- `TURNKEY_SECRET_KEY` (the module's `secretEncryptionKey`). Without it, values encrypted with it, such as the QR AES key, cannot be decrypted.
- The Turnkey installer and the image tag you ran, so you can roll back (section 12).

Test a restore in the test zone at least once before you depend on the backup.

## 12. Upgrading Turnkey

Turnkey is upgraded by replacing the installer and rebuilding the image:

1. Download the new installer from the official channel. Place it next to the Dockerfile, with a new name, for example `EINVTurnkey_setup_<version>.tar.gz`.
2. Set `--build-arg TURNKEY_TARBALL=...` (or the compose `build.args`) to the new name.
3. Build a new image tag, for example `einv-turnkey:<version>`. Keep the old tag for rollback.
4. Test the new version in the test zone first: database connection, environment check, a few invoices of each type, and the four schedules.
5. Stop the old container, then start the new one on the same volume.
6. Check the release notes for database schema changes before starting. Apply them through the official procedure; do not edit the tables by hand.

The entrypoint removes `EINVUPGRADE/` on every start, so the in-container update path does not run. When text mode asks to update, answer **N**.

## 13. Production cut-over

Production is a separate environment. Do not switch the test stack to production in place.

1. Register the master certificate and the software certificate on the **production** platform (the production URL, not the test one). The same software certificate can be used, but it must be registered in each zone.
2. Apply for the production IP whitelist. Use the same fixed egress IP as the test zone, or agree on a new one before cut-over.
3. Allocate production tracks through the platform's production allocation function. Register the production track range in the module. Never reuse test-zone numbers in production.
4. Use a **separate stack** for production: separate `/data` volume, database, secrets and app deployment. Set `System settings → Execution environment` to production in that stack only.
5. Complete the pre-launch self-test (section 2.5) and wait for approval before issuing production invoices.
6. The NestJS module does not distinguish environments. It follows what Turnkey and the platform endpoints are configured to do. Confirm the production stack points at production Turnkey, the production database and production tracks, and that test-zone tracks are not in the production track table.
7. Smoke test: issue one invoice, confirm `ProcessResult` `00000`, confirm the next-day `SummaryResult` lists it as `Good`, and confirm the daily reconciliation completes.
8. Keep the backups (section 11) for the production volume and database on their own schedule.
