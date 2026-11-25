# Gridia - LoRaWAN Device Migration from Tektelic to TTS

This project migrates LoRaWAN devices from the Tektelic platform to The Things Stack (TTS), using the ABP (Activation By Personalization) activation method.

## Description

The script automates the migration of LoRaWAN devices from Tektelic to TTS, performing the following operations:

1. Retrieves the list of devices from a specific application in Tektelic
2. Validates that devices have all the necessary information for migration
3. Creates and configures devices in TTS across three components:
   - **IS (Identity Server)**: Device registration
   - **NS (Network Server)**: Network and session configuration
   - **AS (Application Server)**: Application and key configuration

## Migration Flow

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/migration-runbook-dark.svg" />
  <img src="docs/diagrams/migration-runbook-light.svg" alt="Migration runbook: inventory (devices:list, devices:compare), migration via npm run migrate (build plan, summary + y/N confirmation, IS → NS → AS) and Tektelic cleanup (devices:delete)" />
</picture>

## Prerequisites

- Node.js (version 20 or higher)
- npm or bun
- Access to the Tektelic API
- Access to The Things Stack API
- Authentication credentials for both platforms

## Installation

1. Clone or download the repository
2. Install dependencies:

```bash
npm install
```

Or if you use Bun:

```bash
bun install
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

### Tektelic Variables

- `TEKTELIC_BASE_URL`: Base URL of the Tektelic API (e.g., `https://api.tektelic.com`)
- `TEKTELIC_BEARER_TOKEN`: Bearer authentication token for the Tektelic API
- `TEKTELIC_CUSTOMER_ID`: Customer ID in Tektelic (must match the `customerId` of the bearer token), used to list all customer devices
- `TEKTELIC_APP_ID`: Application ID in Tektelic from which devices will be migrated

### The Things Stack (TTS) Variables

- `TTS_HOST`: TTS host (e.g., `eu1.cloud.thethings.network` or `localhost:1885`)
- `TTS_BASE_URL`: Base URL of the TTS API (e.g., `https://eu1.cloud.thethings.network` or `http://localhost:1885`)
- `TTS_BEARER_TOKEN`: Bearer authentication token for the TTS API
- `TTS_APP_ID`: Application ID in TTS where migrated devices will be created

### Example `.env` file

```env
# Tektelic Configuration
TEKTELIC_BASE_URL=https://api.tektelic.com
TEKTELIC_BEARER_TOKEN=your_tektelic_token
TEKTELIC_CUSTOMER_ID=your_tektelic_customer_id
TEKTELIC_APP_ID=your_tektelic_app_id

# The Things Stack Configuration
TTS_HOST=eu1.cloud.thethings.network
TTS_BASE_URL=https://eu1.cloud.thethings.network
TTS_BEARER_TOKEN=your_tts_token
TTS_APP_ID=your_tts_app_id
```

## Configuring Devices to Migrate

The script supports two modes of operation for selecting devices to migrate:

### Mode 1: Migrate Specific Devices

To migrate only specific devices, edit the `DEVICES_FOR_MIGRATION` array in `src/scripts/migrate.js` and add the Device EUIs:

```javascript
// Only devices with EUIs listed here will be migrated
const DEVICES_FOR_MIGRATION = [
	'8C83FC05007296E7',  // Device EUI 1
	'8C83FC05007296E8',  // Device EUI 2
	// Add more Device EUIs as needed
];
```

### Mode 2: Migrate All Devices

To migrate all devices from the Tektelic application, leave the array empty:

```javascript
// Empty array = migrate all devices from Tektelic
const DEVICES_FOR_MIGRATION = [];
```

**Important**: In both modes, the script will validate that each device has all required ABP fields (`name`, `deviceEUI`, `devAddress`, `appSKey`, `nwkSKey`) before attempting migration. Devices missing any required fields will be skipped with a warning.

## Usage

Once environment variables and devices to migrate are configured, run:

```bash
npm run migrate
```

Or if you use Bun:

```bash
bun run migrate
```

Before touching TTS, the script prints a **migration summary** and asks for confirmation:

- Source Tektelic application and how many devices it has
- Target TTS instance, application and LoRaWAN settings (version, PHY, frequency plan)
- How many devices will be migrated, skipped (missing fields) or were not found (EUIs listed in `DEVICES_FOR_MIGRATION` that are not in the Tektelic application), with a preview of each list

Only `y` or `yes` starts the migration. Any other answer (or no interactive input) cancels it without making changes. When it finishes, it logs how many devices were migrated and how many failed.

## Migration Process

The script performs the following steps:

1. **Device retrieval**: Queries the Tektelic API to get all devices from the specified application (all pages)
2. **Device selection**: 
   - If `DEVICES_FOR_MIGRATION` is empty: selects all devices from Tektelic
   - If `DEVICES_FOR_MIGRATION` has entries: selects only devices matching the listed EUIs
3. **Validation**: Verifies that each selected device has the following required fields:
   - `name`: Device name
   - `deviceEUI`: Device EUI
   - `devAddress`: Device address
   - `appSKey`: Application session key
   - `nwkSKey`: Network session key
   - Devices missing any required fields are skipped with a warning log
4. **Summary and confirmation**: Prints what will be migrated, skipped or not found, and waits for `y`/`yes`
5. **Migration to TTS**: For each valid device, performs the following operations in order:
   - Creates the device in the Identity Server (IS)
   - Configures the device in the Network Server (NS) with:
     - LoRaWAN version: 1.0.2
     - PHY version: 1.0.2-b
     - Frequency plan: AU_915_928_FSB_1
     - Device address and network key (`nwkSKey`)
   - Configures the device in the Application Server (AS) with the application key (`appSKey`)

## Logging

The project uses `pino` for logging with a readable format. Logs include:
- Information about found devices
- Warnings about devices that cannot be migrated (missing fields)
- Errors during the migration process
- Confirmation of successfully migrated devices

## Error Handling

- If a device already exists in TTS (409 status code), the script continues with the next device
- If required information is missing from a device, a warning is logged and it is skipped
- API errors are logged with HTTP status and response details

## Important Notes

- **Device Selection**: You can migrate specific devices by listing their EUIs in `DEVICES_FOR_MIGRATION`, or migrate all devices by leaving the array empty
- **Device Names**: Device names are automatically converted to lowercase in TTS
- **Frequency Plan**: The script is configured for the AU_915_928_FSB_1 region. If you need another region, modify `DEVICE_PROFILE.frequencyPlanId` in `src/clients/tts.js`
- **ABP Requirement**: Ensure devices in Tektelic are configured with ABP (Activation By Personalization) before migrating them
- **Read-Only on Tektelic**: The script does not delete or modify devices in Tektelic, it only creates them in TTS
- **Validation**: All devices are validated before migration. Devices missing required ABP fields will be skipped
- **Idempotency**: If a device already exists in TTS (409 status), the script will skip it and continue with the next device

## Project Structure

```
.
├── src/
│   ├── config.js                        # Loads .env and exposes settings and data file paths
│   ├── clients/
│   │   ├── tektelic.js                  # Tektelic API client
│   │   └── tts.js                       # The Things Stack API client
│   ├── lib/
│   │   ├── csv.js                       # CSV read/write helpers
│   │   └── logger.js                    # Logging configuration
│   └── scripts/                         # One entry point per task (see npm scripts)
│       ├── migrate.js                   # npm run migrate
│       ├── list-tektelic-devices.js     # npm run devices:list
│       ├── find-devices.js              # npm run devices:find
│       ├── compare-devices.js           # npm run devices:compare
│       ├── delete-tektelic-devices.js   # npm run devices:delete
│       └── inspect-tektelic-device.js   # npm run devices:inspect
├── data/                                # Local CSV inputs/outputs (git-ignored, may contain keys)
├── docs/diagrams/                       # Migration flow diagram (SVG + Archify source JSON)
├── package.json
└── README.md
```

| npm script | What it does | Touches |
|---|---|---|
| `npm run migrate` | Migrates devices from the Tektelic application to TTS | Reads Tektelic, **writes TTS** |
| `npm run devices:list` | Exports all customer devices to `data/tektelic_devices.csv` | Reads Tektelic |
| `npm run devices:find` | Searches devices by application, name, model, vendor and state (see [Find Devices](#find-devices)) | Reads Tektelic |
| `npm run devices:compare` | Compares Tektelic vs Gridia CSVs into `data/devices_comparison.csv` | Local files only |
| `npm run devices:delete` | Deletes the devices listed in `data/tektelic_delete_devices.csv` | **Deletes in Tektelic** |
| `npm run devices:inspect` | Prints the raw payload of the first device of the Tektelic application | Reads Tektelic |

## Dependencies

- `axios`: HTTP client for making API requests
- `dotenv`: Loads environment variables from `.env` file
- `pino`: High-performance structured logger
- `pino-pretty`: Readable formatter for pino

## Troubleshooting

### Error: "No devices found for application"
- Verify that `TEKTELIC_APP_ID` is correct
- Ensure the Tektelic token has permissions to access the application

### Error: "Device cannot be migrated because it is missing fields"
- Verify that devices in Tektelic have all ABP information configured (`name`, `deviceEUI`, `devAddress`, `appSKey`, `nwkSKey`)
- If using specific Device EUIs, ensure they exist in the Tektelic application
- Check the logs to see which specific fields are missing for each device

### TTS authentication error
- Verify that `TTS_BEARER_TOKEN` is valid and has write permissions
- Confirm that `TTS_APP_ID` exists in your TTS instance

## Find Devices

`npm run devices:find` searches Tektelic devices and exports the matches with all their fields. It is **read-only**: it never writes to Tektelic or TTS.

Each device is enriched with its model's `manufacturer` (vendor) and `modelType`, looked up from the customer's device models. All text filters ignore case, because vendor and model names are not consistent in Tektelic (for example `Baylan` / `BAYLAN`).

### Options

| Option | Meaning |
|---|---|
| `--app <id\|name>` | Search only this application (ID or exact name). Without it, all devices of `TEKTELIC_CUSTOMER_ID` are searched |
| `--name <pattern>` | Device name. With `*` it is a wildcard matched against the whole name (`BAYLAN-ST*`); without `*` it matches if the name contains the text (`st20`) |
| `--model <model>` | Exact model name (`ST`, `"Baylan ST"`) |
| `--vendor <vendor>` | Exact manufacturer (`baylan`) |
| `--match <all\|any>` | How **different** filters combine: `all` = AND (default), `any` = OR |
| `--active` / `--inactive` | Keep only active / inactive devices. Always applied as AND, regardless of `--match` |
| `--out <name>` | Output base name: `data/<name>.csv` and `data/<name>.json` (default `devices_find_<timestamp>`) |
| `--with-keys` | Include `appKey`, `appSKey` and `nwkSKey` (omitted by default) |
| `--help` | Show the built-in help |

`--name`, `--model` and `--vendor` can be repeated; repeated values of the same flag are OR-ed (`--model ST --model "Baylan ST"` means ST or Baylan ST).

Note the `--` after the script name: npm needs it to pass the options to the script.

### Examples

All devices of the customer (no filters):

```bash
npm run devices:find
```

All devices of one application, by name or ID (an unknown application prints the available ones):

```bash
npm run devices:find -- --app "My Application"
npm run devices:find -- --app <application-id>
```

Name starting with a prefix (wildcard):

```bash
npm run devices:find -- --name "BAYLAN-ST*"
```

Name containing a text:

```bash
npm run devices:find -- --name st20
```

One or several models:

```bash
npm run devices:find -- --model ST
npm run devices:find -- --model ST --model "Baylan ST"
```

One vendor (matches `Baylan` and `BAYLAN`):

```bash
npm run devices:find -- --vendor baylan
```

Only active or only inactive devices:

```bash
npm run devices:find -- --vendor baylan --active
npm run devices:find -- --app "My Application" --inactive
```

Several filters that must **all** match (AND, the default): AK411P / AK-411PE models from Baylan that are inactive:

```bash
npm run devices:find -- --model AK411P --model AK-411PE --vendor baylan --inactive
```

Several filters where **any** may match (OR): name starts with `BAYLAN-ST` or model is `ST` / `Baylan ST`:

```bash
npm run devices:find -- --name "BAYLAN-ST*" --model ST --model "Baylan ST" --match any --out baylan_st_devices
```

Scope, filters and state combined: active Baylan devices of one application:

```bash
npm run devices:find -- --app "My Application" --vendor baylan --active
```

Full export including device keys, with a fixed file name:

```bash
npm run devices:find -- --with-keys --out all_devices_with_keys
```

### Output

The console shows the scope, the applied filters, the number of matches, counts by vendor/model, application and state, and a table with the first 50 devices.

The files in `data/` contain one row per device with every field returned by Tektelic (nested IDs flattened to their UUID), plus:

| Column | Content |
|---|---|
| `manufacturer`, `modelType` | Vendor and type of the device model |
| `createdTimeISO`, `lastActivityTimeISO` | Timestamps in ISO 8601, UTC (empty when the device never sent data) |
| `match_name`, `match_model`, `match_vendor` | Which filter each device matched (only for the filters used); useful with `--match any` |

`data/` is git-ignored. Files created with `--with-keys` contain device keys: do not share them.

## Device Comparison

To generate a comparison report between Tektelic and Gridia devices, you need two CSV files:

### 1. Generate `gridia_devices.csv`

Run the following query against the Gridia database and export the result as `data/gridia_devices.csv`:

```sql
select
  d.id,
  d.amazonId,
  deviceId,
  p.name as project,
  o.name as organization
from device d
join `project` p on d.projectId = p.id
join organization o on p.organizationId = o.id;
```

### 2. Generate `tektelic_devices.csv`

Run the following script to fetch all devices from the Tektelic API:

```bash
npm run devices:list
```

### 3. Run the comparison

```bash
npm run devices:compare
```

This generates `data/devices_comparison.csv` with the following columns:

| Column | Source |
|---|---|
| `tektelicDevName` | Tektelic `deviceName` |
| `tektelicDevEUI` | Tektelic `deviceEUI` |
| `gridiaDevEUI` | Gridia `amazonId` |
| `gridiaDevId` | Gridia `deviceId` |
| `gridiaProject` | Gridia `project` |
| `gridiaOrganization` | Gridia `organization` |

Devices that only exist in one platform will have the other platform's columns empty.

## Delete Tektelic Devices

To bulk-delete devices from the Tektelic platform, use the `src/scripts/delete-tektelic-devices.js` script.

### Input

The script reads `data/tektelic_delete_devices.csv`. The required column is:

| Column | Description |
|---|---|
| `tektelicDeviceId` | Tektelic internal device ID (UUID) used to identify the device to delete |

Example CSV:

```csv
tektelicDeviceId,tektelicDevName,tektelicDevEUI
d82efa50-ae1f-11ed-9dc8-6f708dbf6c1a,1595252,42594C0B01595252
```

### Run

```bash
npm run devices:delete
```

The script logs progress every 50 devices and a final summary with deleted/failed counts.

## License

ISC
