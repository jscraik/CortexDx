import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ReportConfig } from "./report-manager.js";

export interface ReportConfigOptions {
    configPath?: string;
    useEnvironment?: boolean;
    useConfigFile?: boolean;
}

const DEFAULT_CONFIG_LOCATIONS = [
    ".cortexdx/report-config.json",
    join(homedir(), ".cortexdx", "report-config.json"),
    "/etc/cortexdx/report-config.json",
];

export class ReportConfigManager {
    private config: ReportConfig | null = null;
    private configPath: string | null = null;

    /**
     * Load configuration from environment variables, config file, or defaults
     * Priority: Environment > Config File > Defaults
     */
    async loadConfig(options?: ReportConfigOptions): Promise<ReportConfig> {
        const useEnv = options?.useEnvironment !== false;
        const useFile = options?.useConfigFile !== false;

        // Start with defaults
        let config: ReportConfig = {
            storageRoot: "./reports",
            baseUrl: "http://localhost:5001/reports",
            organizationStrategy: "date",
            retentionDays: 30,
            enableCompression: false,
            formats: ["json", "markdown", "html"],
        };

        // Load from config file if available
        if (useFile) {
            const fileConfig = await this.loadFromFile(options?.configPath);
            if (fileConfig) {
                config = { ...config, ...fileConfig };
            }
        }

        // Override with environment variables
        if (useEnv) {
            const envConfig = this.loadFromEnvironment();
            config = { ...config, ...envConfig };
        }

        // Validate and resolve paths
        config = this.validateAndResolveConfig(config);

        this.config = config;
        return config;
    }

    /**
     * Load configuration from environment variables
     */
    private loadFromEnvironment(): Partial<ReportConfig> {
        const config: Partial<ReportConfig> = {};

        if (process.env.CORTEXDX_REPORT_DIR) {
            config.storageRoot = process.env.CORTEXDX_REPORT_DIR;
        }

        if (process.env.CORTEXDX_REPORT_URL) {
            config.baseUrl = process.env.CORTEXDX_REPORT_URL;
        }

        if (process.env.CORTEXDX_REPORT_STRATEGY) {
            const strategy = process.env.CORTEXDX_REPORT_STRATEGY;
            if (strategy === "date" || strategy === "session" || strategy === "type") {
                config.organizationStrategy = strategy;
            }
        }

        if (process.env.CORTEXDX_REPORT_RETENTION_DAYS) {
            const days = Number.parseInt(process.env.CORTEXDX_REPORT_RETENTION_DAYS, 10);
            if (!Number.isNaN(days) && days > 0) {
                config.retentionDays = days;
            }
        }

        if (process.env.CORTEXDX_REPORT_COMPRESSION) {
            config.enableCompression = process.env.CORTEXDX_REPORT_COMPRESSION === "true";
        }

        if (process.env.CORTEXDX_REPORT_FORMATS) {
            const formats = process.env.CORTEXDX_REPORT_FORMATS.split(",")
                .map(f => f.trim().toLowerCase())
                .filter(f => f === "json" || f === "markdown" || f === "html");

            if (formats.length > 0) {
                config.formats = formats as ("json" | "markdown" | "html")[];
            }
        }

        return config;
    }

    /**
     * Load configuration from file
     */
    private async loadFromFile(configPath?: string): Promise<Partial<ReportConfig> | null> {
        // Try specified path first
        if (configPath) {
            if (existsSync(configPath)) {
                this.configPath = configPath;
                return await this.readConfigFile(configPath);
            }
            throw new Error(`Config file not found: ${configPath}`);
        }

        // Try default locations
        for (const location of DEFAULT_CONFIG_LOCATIONS) {
            if (existsSync(location)) {
                this.configPath = location;
                return await this.readConfigFile(location);
            }
        }

        return null;
    }

    /**
     * Read and parse config file
     */
    private async readConfigFile(path: string): Promise<Partial<ReportConfig>> {
        try {
            const content = await readFile(path, "utf-8");
            const parsed = JSON.parse(content) as Partial<ReportConfig>;
            return parsed;
        } catch (error) {
            throw new Error(`Failed to parse config file ${path}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Validate and resolve configuration paths
     */
    private validateAndResolveConfig(config: ReportConfig): ReportConfig {
        // Resolve storage root to absolute path
        config.storageRoot = resolve(config.storageRoot);

        // Validate base URL
        try {
            new URL(config.baseUrl);
        } catch {
            throw new Error(`Invalid base URL: ${config.baseUrl}`);
        }

        // Validate organization strategy
        if (!["date", "session", "type"].includes(config.organizationStrategy)) {
            throw new Error(`Invalid organization strategy: ${config.organizationStrategy}`);
        }

        // Validate retention days
        if (config.retentionDays < 1) {
            throw new Error(`Invalid retention days: ${config.retentionDays}`);
        }

        // Validate formats
        if (config.formats.length === 0) {
            throw new Error("At least one report format must be specified");
        }

        for (const format of config.formats) {
            if (!["json", "markdown", "html"].includes(format)) {
                throw new Error(`Invalid report format: ${format}`);
            }
        }

        return config;
    }

    /**
     * Save configuration to file
     */
    async saveConfig(config: ReportConfig, path?: string): Promise<void> {
        const targetPath = path ?? this.configPath ?? DEFAULT_CONFIG_LOCATIONS[0];

        // Ensure directory exists
        await mkdir(dirname(targetPath), { recursive: true });

        // Write config file
        const content = JSON.stringify(config, null, 2);
        await writeFile(targetPath, content, "utf-8");

        this.configPath = targetPath;
        this.config = config;
    }

    /**
     * Get current configuration
     */
    getConfig(): ReportConfig | null {
        return this.config;
    }

    /**
     * Get config file path
     */
    getConfigPath(): string | null {
        return this.configPath;
    }

    /**
     * Update specific configuration values
     */
    async updateConfig(updates: Partial<ReportConfig>): Promise<ReportConfig> {
        if (!this.config) {
            throw new Error("Configuration not loaded. Call loadConfig() first.");
        }

        const newConfig = { ...this.config, ...updates };
        const validated = this.validateAndResolveConfig(newConfig);

        if (this.configPath) {
            await this.saveConfig(validated, this.configPath);
        }

        this.config = validated;
        return validated;
    }

    /**
     * Validate storage location
     */
    async validateStorageLocation(location: string): Promise<{
        valid: boolean;
        error?: string;
        resolvedPath?: string;
    }> {
        try {
            const resolvedPath = resolve(location);

            // Try to create directory
            await mkdir(resolvedPath, { recursive: true });

            // Check if writable
            const testFile = join(resolvedPath, ".write-test");
            await writeFile(testFile, "test", "utf-8");
            await readFile(testFile, "utf-8");

            // Clean up test file
            const { unlink } = await import("node:fs/promises");
            await unlink(testFile);

            return {
                valid: true,
                resolvedPath,
            };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Get default storage location based on platform
     */
    static getDefaultStorageLocation(): string {
        // Use XDG_DATA_HOME on Linux, ~/Library on macOS, %LOCALAPPDATA% on Windows
        const platform = process.platform;

        if (platform === "linux") {
            const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
            return join(xdgDataHome, "cortexdx", "reports");
        } if (platform === "darwin") {
            return join(homedir(), "Library", "Application Support", "cortexdx", "reports");
        } if (platform === "win32") {
            const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
            return join(localAppData, "cortexdx", "reports");
        }

        // Fallback
        return join(homedir(), ".cortexdx", "reports");
    }

    /**
     * Create a default configuration file
     */
    static async createDefaultConfig(path?: string): Promise<string> {
        const targetPath = path ?? DEFAULT_CONFIG_LOCATIONS[0];

        const defaultConfig: ReportConfig = {
            storageRoot: ReportConfigManager.getDefaultStorageLocation(),
            baseUrl: "http://localhost:5001/reports",
            organizationStrategy: "date",
            retentionDays: 30,
            enableCompression: false,
            formats: ["json", "markdown", "html"],
        };

        await mkdir(dirname(targetPath), { recursive: true });
        await writeFile(targetPath, JSON.stringify(defaultConfig, null, 2), "utf-8");

        return targetPath;
    }
}
