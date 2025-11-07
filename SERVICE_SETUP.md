# Insula MCP Service Setup

This directory contains scripts to set up the Insula MCP server as a macOS system service using launchd. The service will automatically start on boot and stop on shutdown.

## Files

- `com.brainwav.insula-mcp.plist` - launchd service configuration
- `install-service.sh` - Install the service
- `uninstall-service.sh` - Remove the service  
- `manage-service.sh` - Manage the service (start/stop/status/logs)

## Quick Setup

### 1. Install the Service

```bash
./install-service.sh
```

This will:

- Install the service configuration to `~/Library/LaunchAgents/`
- Create log files in `/var/log/`
- Start the service automatically
- Configure it to start on boot

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
tail -f /var/log/insula-mcp.error.log
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
# Load/start service
launchctl load ~/Library/LaunchAgents/com.brainwav.insula-mcp.plist

# Unload/stop service
launchctl unload ~/Library/LaunchAgents/com.brainwav.insula-mcp.plist

# Check if running
launchctl list | grep com.brainwav.insula-mcp
```

## Service Configuration

The service is configured to:

- **Port**: 5001 (matches cloudflared tunnel)
- **Host**: 127.0.0.1 (localhost only)
- **Auto-start**: On boot
- **Auto-restart**: If crashed
- **User**: jamiecraik (your user account)
- **Logs**: `/var/log/insula-mcp.log` and `/var/log/insula-mcp.error.log`

## Troubleshooting

### Service Won't Start

1. Check the error logs:

   ```bash
   tail -f /var/log/insula-mcp.error.log
   ```

2. Verify pnpm is installed and in PATH:

   ```bash
   which pnpm
   ```

3. Check project directory exists:

   ```bash
   ls -la /Volumes/ExternalSSD/dev/insula-mcp/packages/insula-mcp
   ```

### Port Already in Use

If port 5001 is already in use:

1. Find what's using it:

   ```bash
   lsof -i :5001
   ```

2. Stop the conflicting service or change the port in the plist file

### Permission Issues

If you get permission errors:

1. Check file ownership:

   ```bash
   ls -la ~/Library/LaunchAgents/com.brainwav.insula-mcp.plist
   ```

2. Fix permissions:

   ```bash
   chmod 644 ~/Library/LaunchAgents/com.brainwav.insula-mcp.plist
   ```

## Updating the Service

When you update the Insula MCP code:

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
