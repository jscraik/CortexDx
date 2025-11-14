# CortexDx LaunchAgent Setup

These scripts install CortexDx's MCP server as a macOS LaunchAgent. The generated plist uses the label `com.brainwav.cortexdx`, so it can live alongside the `.Cortex-OS` profiles (which use `com.brainwav.cortexdx-local-memory`) without conflicts. Once installed, the service starts automatically on login and restarts if it crashes.

## Files

- `com.brainwav.cortexdx.plist` – plist template rendered by the installer
- `install-service.sh` – renders the plist with your paths and loads it into launchd
- `uninstall-service.sh` – unloads the LaunchAgent and removes the plist  
- `manage-service.sh` – helper for start/stop/status/log tailing

## Quick Setup

### 1. Install the Service

```bash
set -a && source config/port.env   # keep port assignments consistent (optional)
./install-service.sh
```

This will:

- Render the plist with your `pnpm`/Node paths and install it to `~/Library/LaunchAgents/`
- Create `/var/log/cortexdx.log` + `/var/log/cortexdx.error.log`
- Bootstrap the LaunchAgent via `launchctl` and enable auto-start on login

### 2. Verify Installation

```bash
./manage-service.sh status
```

You should see:

- ✅ Service is running
- ✅ Server is responding on http://127.0.0.1:5001

## Service Management

### Start/Stop/Restart

```bash
# Start the service
./manage-service.sh start

# Stop the service
./manage-service.sh stop

# Restart the service
./manage-service.sh restart
```

### Check Status

```bash
./manage-service.sh status
```

### View Logs

```bash
# Live tail of logs
./manage-service.sh logs

# View error logs
tail -f /var/log/cortexdx.error.log
```

### Uninstall Service

```bash
./manage-service.sh uninstall
# or
./uninstall-service.sh
```

## Manual launchctl Commands

If you prefer to use launchctl directly:

```bash
PLIST=~/Library/LaunchAgents/com.brainwav.cortexdx.plist
TARGET="gui/$UID/com.brainwav.cortexdx"

# Start / reload the LaunchAgent
launchctl bootout "$TARGET" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$PLIST"
launchctl enable "$TARGET"
launchctl kickstart -k "$TARGET"

# Stop the LaunchAgent
launchctl bootout "$TARGET"

# Inspect status
launchctl print "$TARGET"
```

## Service Configuration

The service is configured to:

- **Port**: 5001 (matches cloudflared tunnel)
- **Host**: 127.0.0.1 (localhost only)
- **Auto-start**: On login
- **Auto-restart**: If crashed
- **User**: current login (detected dynamically)
- **Logs**: `/var/log/cortexdx.log` and `/var/log/cortexdx.error.log`

## Troubleshooting

### Service Won't Start

1. Check the error logs:

   ```bash
   tail -f /var/log/cortexdx.error.log
   ```

2. Verify pnpm is installed and in PATH:

   ```bash
   which pnpm
   ```

3. Check project directory exists:

   ```bash
   ls -la /Volumes/ExternalSSD/dev/CortexDx/packages/cortexdx
   ```

### Port Already in Use

If port 5001 is already in use:

1. Find what's using it:

   ```bash
   lsof -i :5001
   ```

2. Stop the conflicting service or reinstall with a different port: `PORT=5002 ./install-service.sh`

### Permission Issues

If you get permission errors:

1. Check file ownership:

   ```bash
   ls -la ~/Library/LaunchAgents/com.brainwav.cortexdx.plist
   ```

2. Fix permissions:

   ```bash
   chmod 644 ~/Library/LaunchAgents/com.brainwav.cortexdx.plist
   ```

## Updating the Service

When you update the CortexDx code:

1. The service will automatically use the latest code (no reinstall needed)
2. If you need to restart: `./manage-service.sh restart`
3. If you change the plist configuration, reinstall: `./manage-service.sh uninstall && ./manage-service.sh install`

## Security Notes

- The service runs under your user account (not root)
- It only binds to localhost (127.0.0.1), not external interfaces
- Logs are created with your user permissions
- The service will have the same file system access as your user account

## Integration with Cloudflared

This service is designed to work with your cloudflared tunnel:

- Service runs on port 5001 (matches tunnel configuration)
- Starts automatically on boot (before tunnel connects)
- Provides reliable backend for the tunnel

The tunnel should point to `http://127.0.0.1:5001` and will automatically connect when both services are running.

### Cloudflare Tunnel LaunchAgent

To keep the MCP tunnel alive after reboots (and to collect health logs), install the bundled LaunchAgent:

```bash
chmod +x install-cloudflared.sh manage-cloudflared.sh
CORTEXDX_CLOUDFLARED_CONFIG=~/.cloudflared/config.yml ./install-cloudflared.sh
```

Key details:

- Label: `com.brainwav.cortexdx-cloudflared`
- Runs `scripts/cloudflared/run-cloudflared.sh`, which
  - rotates logs in `~/Library/Logs/cortexdx-cloudflared`
  - polls `https://cortexdx-mcp.brainwav.io/health` every 60s and records reachability
  - restarts automatically via `launchd` if the tunnel exits
- Manage with `./manage-cloudflared.sh {start|stop|restart|status|logs}`

Set `CORTEXDX_CLOUDFLARED_HEALTH_URLS` or `CORTEXDX_CLOUDFLARED_HEALTH_INTERVAL` before installing if you need custom targets/intervals.
