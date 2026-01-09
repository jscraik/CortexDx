import {
  Activity,
  BarChart2,
  Command,
  FileText,
  Search,
  Sliders,
} from "lucide-react";
import { useEffect, useState } from "react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = [
    { id: "health", label: "Go to Health", icon: Activity, type: "navigation" },
    { id: "logs", label: "Go to Logs", icon: FileText, type: "navigation" },
    { id: "traces", label: "Go to Traces", icon: Search, type: "navigation" },
    {
      id: "metrics",
      label: "Go to Metrics",
      icon: BarChart2,
      type: "navigation",
    },
    {
      id: "controls",
      label: "Go to Controls",
      icon: Sliders,
      type: "navigation",
    },
    { id: "refresh", label: "Refresh Data", icon: Command, type: "action" },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + filteredCommands.length) % filteredCommands.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          if (cmd.type === "navigation") {
            onNavigate(cmd.id);
          } else {
            console.log("Action:", cmd.id);
          }
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onNavigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-cortex-surface rounded-xl border border-cortex-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 py-3 border-b border-cortex-border">
          <Search className="w-5 h-5 text-cortex-muted mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-none outline-none text-cortex-text placeholder:text-cortex-muted text-lg font-medium"
          />
          <div className="flex items-center gap-1">
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-cortex-border bg-cortex-bg px-1.5 font-mono text-[10px] font-medium text-cortex-muted opacity-100">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2 custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-cortex-muted">
              No results found.
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {filteredCommands.map((cmd, index) => {
                const Icon = cmd.icon;
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      if (cmd.type === "navigation") {
                        onNavigate(cmd.id);
                      }
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${
                        isSelected
                          ? "bg-cortex-accent text-white"
                          : "text-cortex-text hover:bg-cortex-bg"
                      }
                    `}
                  >
                    <Icon
                      className={`w-4 h-4 ${isSelected ? "text-white" : "text-cortex-muted"}`}
                    />
                    {cmd.label}
                    {isSelected && (
                      <span className="ml-auto text-xs text-white/70">
                        Enter
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-cortex-bg border-t border-cortex-border text-xs text-cortex-muted flex justify-between items-center">
          <span>ProTip: Use arrows to navigate</span>
          <div className="flex gap-2">
            <span>CortexDx</span>
          </div>
        </div>
      </div>
    </div>
  );
}
