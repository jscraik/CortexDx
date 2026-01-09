/**
 * Unified Flame Graph Generator
 *
 * Generates flame graphs in multiple formats (SVG, HTML, JSON) with
 * interactive features and metadata support for both Clinic.js and py-spy.
 */

export interface FlameGraphNode {
  name: string;
  value: number;
  children?: FlameGraphNode[];
  file?: string;
  line?: number;
  selfTime?: number;
  totalTime?: number;
}

export interface FlameGraphMetadata {
  totalSamples: number;
  duration: number;
  timestamp: Date;
  source: "clinic.js" | "py-spy" | "custom";
  tool?: "doctor" | "flame" | "bubbleprof" | "pyspy";
  pid?: number;
  command?: string;
  sampleRate?: number;
}

export interface FlameGraphData {
  root: FlameGraphNode;
  metadata: FlameGraphMetadata;
}

export interface FlameGraphOptions {
  format: "svg" | "html" | "json";
  interactive?: boolean;
  width?: number;
  height?: number;
  colorScheme?: "hot" | "cold" | "aqua" | "green" | "red";
  title?: string;
  subtitle?: string;
}

/**
 * Unified Flame Graph Generator
 */
export class FlameGraphGenerator {
  /**
   * Generate a flame graph from data
   */
  async generate(
    data: FlameGraphData,
    options: FlameGraphOptions,
  ): Promise<string> {
    switch (options.format) {
      case "svg":
        return this.generateSVG(data, options);
      case "html":
        return this.generateHTML(data, options);
      case "json":
        return this.generateJSON(data, options);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Generate SVG flame graph
   */
  private generateSVG(
    data: FlameGraphData,
    options: FlameGraphOptions,
  ): string {
    const width = options.width ?? 1200;
    const height = options.height ?? 800;
    const frameHeight = 16;
    const fontSize = 12;
    const colorScheme = options.colorScheme ?? "hot";

    const title = options.title ?? "Flame Graph";
    const subtitle =
      options.subtitle ??
      `${data.metadata.totalSamples} samples, ${data.metadata.duration}ms`;

    // Calculate layout
    const frames = this.layoutFrames(data.root, width, height - 100, 0);

    // Generate SVG
    let svg = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg version="1.1" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
`;

    // Add styles
    svg += this.generateSVGStyles(options.interactive ?? false);

    // Add title
    svg += `  <text x="${width / 2}" y="24" text-anchor="middle" font-size="17" font-family="Verdana" fill="rgb(0,0,0)">${title}</text>\n`;
    svg += `  <text x="${width / 2}" y="44" text-anchor="middle" font-size="12" font-family="Verdana" fill="rgb(0,0,0)">${subtitle}</text>\n`;

    // Add metadata
    svg += `  <text x="10" y="${height - 10}" font-size="10" font-family="Verdana" fill="rgb(128,128,128)">Source: ${data.metadata.source}</text>\n`;
    svg += `  <text x="${width - 200}" y="${height - 10}" font-size="10" font-family="Verdana" fill="rgb(128,128,128)">Generated: ${data.metadata.timestamp.toISOString()}</text>\n`;

    // Add frames
    for (const frame of frames) {
      const color = this.getColor(frame.depth, colorScheme);
      const textColor = this.getTextColor(color);

      svg += `  <g class="frame">\n`;
      svg += `    <rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frameHeight}" fill="${color}" stroke="white" stroke-width="0.5"/>\n`;

      // Add text if frame is wide enough
      if (frame.width > 30) {
        const text = this.truncateText(frame.name, frame.width, fontSize);
        svg += `    <text x="${frame.x + 3}" y="${frame.y + frameHeight - 4}" font-size="${fontSize}" font-family="Verdana" fill="${textColor}">${text}</text>\n`;
      }

      // Add interactive elements if enabled
      if (options.interactive) {
        svg += `    <title>${frame.name}\n${frame.value} samples (${((frame.value / data.metadata.totalSamples) * 100).toFixed(2)}%)</title>\n`;
      }

      svg += "  </g>\n";
    }

    svg += "</svg>";

    return svg;
  }

  /**
   * Generate HTML flame graph with interactive features
   */
  private generateHTML(
    data: FlameGraphData,
    options: FlameGraphOptions,
  ): string {
    const svg = this.generateSVG(data, { ...options, interactive: true });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options.title ?? "Flame Graph"}</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: Verdana, sans-serif;
      background: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .controls {
      margin-bottom: 20px;
      padding: 10px;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .controls button {
      margin-right: 10px;
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
    }
    .controls button:hover {
      background: #f0f0f0;
    }
    .info {
      margin-top: 20px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 4px;
      font-size: 14px;
    }
    .info h3 {
      margin-top: 0;
    }
    .metadata {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .metadata-item {
      padding: 8px;
      background: white;
      border-radius: 4px;
    }
    .metadata-label {
      font-weight: bold;
      color: #666;
      font-size: 12px;
    }
    .metadata-value {
      margin-top: 4px;
      color: #333;
    }
    svg {
      display: block;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="controls">
      <button onclick="resetZoom()">Reset Zoom</button>
      <button onclick="searchFrame()">Search</button>
      <button onclick="downloadSVG()">Download SVG</button>
      <button onclick="downloadJSON()">Download JSON</button>
    </div>
    
    <div id="flamegraph">
      ${svg}
    </div>
    
    <div class="info">
      <h3>Flame Graph Information</h3>
      <div class="metadata">
        <div class="metadata-item">
          <div class="metadata-label">Total Samples</div>
          <div class="metadata-value">${data.metadata.totalSamples.toLocaleString()}</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Duration</div>
          <div class="metadata-value">${data.metadata.duration}ms</div>
        </div>
        <div class="metadata-item">
          <div class="metadata-label">Source</div>
          <div class="metadata-value">${data.metadata.source}</div>
        </div>
        ${data.metadata.tool ? `<div class="metadata-item"><div class="metadata-label">Tool</div><div class="metadata-value">${data.metadata.tool}</div></div>` : ""}
        ${data.metadata.pid ? `<div class="metadata-item"><div class="metadata-label">PID</div><div class="metadata-value">${data.metadata.pid}</div></div>` : ""}
        ${data.metadata.command ? `<div class="metadata-item"><div class="metadata-label">Command</div><div class="metadata-value">${data.metadata.command}</div></div>` : ""}
        <div class="metadata-item">
          <div class="metadata-label">Generated</div>
          <div class="metadata-value">${data.metadata.timestamp.toLocaleString()}</div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const flameGraphData = ${JSON.stringify(data)};
    
    function resetZoom() {
      // Reset SVG viewBox to original
      const svg = document.querySelector('svg');
      svg.removeAttribute('viewBox');
    }
    
    function searchFrame() {
      const query = prompt('Search for function name:');
      if (!query) return;
      
      const frames = document.querySelectorAll('.frame');
      let found = 0;
      
      frames.forEach(frame => {
        const text = frame.querySelector('text');
        if (text && text.textContent.toLowerCase().includes(query.toLowerCase())) {
          frame.style.opacity = '1';
          found++;
        } else {
          frame.style.opacity = '0.3';
        }
      });
      
      alert(\`Found \${found} matching frames\`);
    }
    
    function downloadSVG() {
      const svg = document.querySelector('svg').outerHTML;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flamegraph.svg';
      a.click();
      URL.revokeObjectURL(url);
    }
    
    function downloadJSON() {
      const json = JSON.stringify(flameGraphData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flamegraph.json';
      a.click();
      URL.revokeObjectURL(url);
    }
    
    // Add click handlers for interactive zoom
    document.querySelectorAll('.frame').forEach(frame => {
      frame.style.cursor = 'pointer';
      frame.addEventListener('click', function() {
        const rect = this.querySelector('rect');
        const x = parseFloat(rect.getAttribute('x'));
        const y = parseFloat(rect.getAttribute('y'));
        const width = parseFloat(rect.getAttribute('width'));
        const height = parseFloat(rect.getAttribute('height'));
        
        const svg = document.querySelector('svg');
        svg.setAttribute('viewBox', \`\${x} \${y} \${width} \${height * 2}\`);
      });
    });
  </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate JSON flame graph data
   */
  private generateJSON(
    data: FlameGraphData,
    _options: FlameGraphOptions,
  ): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate SVG styles
   */
  private generateSVGStyles(interactive: boolean): string {
    const styles = `  <defs>
    <style type="text/css">
      text { font-family: Verdana; }
      .frame { cursor: ${interactive ? "pointer" : "default"}; }
    </style>
  </defs>
`;
    return styles;
  }

  /**
   * Layout frames for flame graph
   */
  private layoutFrames(
    node: FlameGraphNode,
    width: number,
    height: number,
    depth: number,
  ): Array<{
    name: string;
    value: number;
    x: number;
    y: number;
    width: number;
    depth: number;
  }> {
    const frames: Array<{
      name: string;
      value: number;
      x: number;
      y: number;
      width: number;
      depth: number;
    }> = [];
    const frameHeight = 16;
    const yOffset = 60; // Offset for title

    const layout = (
      n: FlameGraphNode,
      x: number,
      y: number,
      w: number,
      d: number,
      totalValue: number,
    ) => {
      frames.push({
        name: n.name,
        value: n.value,
        x,
        y: y + yOffset,
        width: w,
        depth: d,
      });

      if (n.children && n.children.length > 0) {
        let childX = x;
        for (const child of n.children) {
          const childWidth = (child.value / n.value) * w;
          layout(child, childX, y + frameHeight, childWidth, d + 1, totalValue);
          childX += childWidth;
        }
      }
    };

    layout(node, 0, 0, width, depth, node.value);

    return frames;
  }

  /**
   * Get color for frame based on depth
   */
  private getColor(depth: number, scheme: string): string {
    const hue = (depth * 17) % 360;

    switch (scheme) {
      case "hot":
        return `hsl(${hue}, 70%, 60%)`;
      case "cold":
        return `hsl(${200 + ((depth * 10) % 160)}, 70%, 60%)`;
      case "aqua":
        return `hsl(${180 + ((depth * 10) % 60)}, 70%, 60%)`;
      case "green":
        return `hsl(${120 + ((depth * 10) % 60)}, 70%, 60%)`;
      case "red":
        return `hsl(${0 + ((depth * 10) % 60)}, 70%, 60%)`;
      default:
        return `hsl(${hue}, 70%, 60%)`;
    }
  }

  /**
   * Get text color based on background color
   */
  private getTextColor(bgColor: string): string {
    // Simple heuristic: use black text for light backgrounds
    return "rgb(0,0,0)";
  }

  /**
   * Truncate text to fit in frame
   */
  private truncateText(text: string, width: number, fontSize: number): string {
    const charWidth = fontSize * 0.6; // Approximate character width
    const maxChars = Math.floor(width / charWidth) - 2;

    if (text.length <= maxChars) {
      return text;
    }

    return `${text.substring(0, maxChars - 3)}...`;
  }

  /**
   * Parse Clinic.js flame graph data
   */
  async parseClinicFlameGraph(
    svgPath: string,
    metadata: Partial<FlameGraphMetadata>,
  ): Promise<FlameGraphData> {
    // Clinic.js generates SVG flame graphs
    // For now, we'll create a simple structure
    // In a real implementation, we would parse the SVG

    const root: FlameGraphNode = {
      name: "root",
      value: metadata.totalSamples ?? 1000,
      children: [
        {
          name: "node",
          value: metadata.totalSamples ?? 1000,
          children: [],
        },
      ],
    };

    return {
      root,
      metadata: {
        totalSamples: metadata.totalSamples ?? 1000,
        duration: metadata.duration ?? 0,
        timestamp: metadata.timestamp ?? new Date(),
        source: "clinic.js",
        tool: metadata.tool,
        pid: metadata.pid,
        command: metadata.command,
      },
    };
  }

  /**
   * Parse py-spy flame graph data
   */
  async parsePySpyFlameGraph(
    svgPath: string,
    metadata: Partial<FlameGraphMetadata>,
  ): Promise<FlameGraphData> {
    // py-spy generates SVG flame graphs
    // For now, we'll create a simple structure
    // In a real implementation, we would parse the SVG

    const root: FlameGraphNode = {
      name: "root",
      value: metadata.totalSamples ?? 1000,
      children: [
        {
          name: "python",
          value: metadata.totalSamples ?? 1000,
          children: [],
        },
      ],
    };

    return {
      root,
      metadata: {
        totalSamples: metadata.totalSamples ?? 1000,
        duration: metadata.duration ?? 0,
        timestamp: metadata.timestamp ?? new Date(),
        source: "py-spy",
        tool: "pyspy",
        pid: metadata.pid,
        command: metadata.command,
      },
    };
  }

  /**
   * Convert speedscope JSON to flame graph data
   */
  async parseSpeedscopeJSON(
    jsonPath: string,
    metadata: Partial<FlameGraphMetadata>,
  ): Promise<FlameGraphData> {
    // Speedscope uses a different format
    // This would require parsing the JSON and converting to our format

    const root: FlameGraphNode = {
      name: "root",
      value: metadata.totalSamples ?? 1000,
      children: [],
    };

    return {
      root,
      metadata: {
        totalSamples: metadata.totalSamples ?? 1000,
        duration: metadata.duration ?? 0,
        timestamp: metadata.timestamp ?? new Date(),
        source: metadata.source ?? "custom",
        tool: metadata.tool,
        pid: metadata.pid,
        command: metadata.command,
      },
    };
  }
}
