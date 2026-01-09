/**
 * Internationalization setup
 * Conforms to Apps SDK localization guidelines
 */

export const messages = {
  "en-US": {
    // Dashboard
    "dashboard.title": "CortexDx Control Panel",
    "dashboard.subtitle": "System monitoring and control",

    // Health
    "health.status.healthy": "Healthy",
    "health.status.degraded": "Degraded",
    "health.status.unhealthy": "Unhealthy",
    "health.uptime": "Uptime",
    "health.version": "Version",
    "health.protocol": "Protocol",
    "health.components": "Components",

    // Metrics
    "metrics.title": "System Metrics",
    "metrics.cpu": "CPU Usage",
    "metrics.memory": "Memory",
    "metrics.network": "Network",
    "metrics.latency": "Latency",
    "metrics.autoRefresh": "Auto-refresh",

    // Logs
    "logs.title": "System Logs",
    "logs.search": "Search logs...",
    "logs.level": "Level",
    "logs.component": "Component",
    "logs.timeRange": "Time Range",
    "logs.autoScroll": "Auto-scroll",

    // Traces
    "traces.title": "Distributed Traces",
    "traces.search": "Search traces...",
    "traces.duration": "Duration",
    "traces.status": "Status",

    // Controls
    "controls.title": "Workflow Controls",
    "controls.activeRuns": "Active Runs",
    "controls.startWorkflow": "Start Workflow",
    "controls.pauseAll": "Pause All",
    "controls.resumeAll": "Resume All",
    "controls.drainQueue": "Drain Queue",

    // Actions
    "action.refresh": "Refresh",
    "action.viewDetails": "View Details",
    "action.viewDashboard": "View Dashboard",
    "action.close": "Close",
    "action.retry": "Retry",
    "action.export": "Export",

    // States
    "state.loading": "Loading...",
    "state.error": "Error",
    "state.empty": "No data available",
    "state.noResults": "No results found",

    // Time
    "time.seconds": "{count, plural, one {# second} other {# seconds}}",
    "time.minutes": "{count, plural, one {# minute} other {# minutes}}",
    "time.hours": "{count, plural, one {# hour} other {# hours}}",
    "time.ago": "{time} ago",
  },
  "es-ES": {
    // Dashboard
    "dashboard.title": "Panel de Control CortexDx",
    "dashboard.subtitle": "Monitoreo y control del sistema",

    // Health
    "health.status.healthy": "Saludable",
    "health.status.degraded": "Degradado",
    "health.status.unhealthy": "No saludable",
    "health.uptime": "Tiempo activo",
    "health.version": "Versión",
    "health.protocol": "Protocolo",
    "health.components": "Componentes",

    // Metrics
    "metrics.title": "Métricas del Sistema",
    "metrics.cpu": "Uso de CPU",
    "metrics.memory": "Memoria",
    "metrics.network": "Red",
    "metrics.latency": "Latencia",
    "metrics.autoRefresh": "Actualización automática",

    // Logs
    "logs.title": "Registros del Sistema",
    "logs.search": "Buscar registros...",
    "logs.level": "Nivel",
    "logs.component": "Componente",
    "logs.timeRange": "Rango de tiempo",
    "logs.autoScroll": "Desplazamiento automático",

    // Traces
    "traces.title": "Trazas Distribuidas",
    "traces.search": "Buscar trazas...",
    "traces.duration": "Duración",
    "traces.status": "Estado",

    // Controls
    "controls.title": "Controles de Flujo",
    "controls.activeRuns": "Ejecuciones Activas",
    "controls.startWorkflow": "Iniciar Flujo",
    "controls.pauseAll": "Pausar Todo",
    "controls.resumeAll": "Reanudar Todo",
    "controls.drainQueue": "Vaciar Cola",

    // Actions
    "action.refresh": "Actualizar",
    "action.viewDetails": "Ver Detalles",
    "action.viewDashboard": "Ver Panel",
    "action.close": "Cerrar",
    "action.retry": "Reintentar",
    "action.export": "Exportar",

    // States
    "state.loading": "Cargando...",
    "state.error": "Error",
    "state.empty": "No hay datos disponibles",
    "state.noResults": "No se encontraron resultados",

    // Time
    "time.seconds": "{count, plural, one {# segundo} other {# segundos}}",
    "time.minutes": "{count, plural, one {# minuto} other {# minutos}}",
    "time.hours": "{count, plural, one {# hora} other {# horas}}",
    "time.ago": "hace {time}",
  },
};

export type MessageKey = keyof (typeof messages)["en-US"];
