// ═══════════════════════════════════════════════════════════════════
// METRICS - Métricas Prometheus Enterprise-Level
// Sistema de métricas para monitoreo y observabilidad
// ═══════════════════════════════════════════════════════════════════

/**
 * Sistema de métricas simple (en producción usar Prometheus client)
 */
class MetricsCollector {
  constructor(serviceName = 'qwen-valencia') {
    this.serviceName = serviceName;
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.startTime = Date.now();
  }

  /**
   * Incrementa un contador
   */
  increment(name, labels = {}, value = 1) {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Establece un gauge
   */
  setGauge(name, labels = {}, value) {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Registra un valor en un histograma
   */
  observe(name, labels = {}, value) {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    const values = this.histograms.get(key);
    values.push(value);
    
    // Mantener solo los últimos 1000 valores
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Genera key para métrica con labels
   */
  getKey(name, labels) {
    const labelStr = Object.keys(labels)
      .sort()
      .map(k => `${k}="${labels[k]}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Obtiene métricas en formato Prometheus
   */
  getPrometheusFormat() {
    const lines = [];
    
    // Contadores
    for (const [key, value] of this.counters.entries()) {
      lines.push(`# TYPE ${this.serviceName}_${key.split('{')[0]} counter`);
      lines.push(`${this.serviceName}_${key} ${value}`);
    }
    
    // Gauges
    for (const [key, value] of this.gauges.entries()) {
      lines.push(`# TYPE ${this.serviceName}_${key.split('{')[0]} gauge`);
      lines.push(`${this.serviceName}_${key} ${value}`);
    }
    
    // Histogramas (simplificado - solo suma y count)
    for (const [key, values] of this.histograms.entries()) {
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      const avg = count > 0 ? sum / count : 0;
      
      lines.push(`# TYPE ${this.serviceName}_${key.split('{')[0]}_sum counter`);
      lines.push(`${this.serviceName}_${key.split('{')[0]}_sum${key.includes('{') ? key.substring(key.indexOf('{')) : ''} ${sum}`);
      lines.push(`# TYPE ${this.serviceName}_${key.split('{')[0]}_count counter`);
      lines.push(`${this.serviceName}_${key.split('{')[0]}_count${key.includes('{') ? key.substring(key.indexOf('{')) : ''} ${count}`);
      lines.push(`# TYPE ${this.serviceName}_${key.split('{')[0]}_avg gauge`);
      lines.push(`${this.serviceName}_${key.split('{')[0]}_avg${key.includes('{') ? key.substring(key.indexOf('{')) : ''} ${avg}`);
    }
    
    // Uptime
    const uptime = (Date.now() - this.startTime) / 1000;
    lines.push(`# TYPE ${this.serviceName}_uptime_seconds gauge`);
    lines.push(`${this.serviceName}_uptime_seconds ${uptime}`);
    
    return lines.join('\n');
  }

  /**
   * Obtiene métricas en formato JSON
   */
  getJSONFormat() {
    return {
      service: this.serviceName,
      uptime: (Date.now() - this.startTime) / 1000,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => [
          key,
          {
            count: values.length,
            sum: values.reduce((a, b) => a + b, 0),
            avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
            min: values.length > 0 ? Math.min(...values) : 0,
            max: values.length > 0 ? Math.max(...values) : 0
          }
        ])
      )
    };
  }

  /**
   * Resetea todas las métricas
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.startTime = Date.now();
  }
}

/**
 * Factory para crear collectors
 */
class MetricsFactory {
  static create(serviceName) {
    return new MetricsCollector(serviceName);
  }
}

// Collector global
const globalMetrics = new MetricsCollector('qwen_valencia');

module.exports = {
  MetricsCollector,
  MetricsFactory,
  globalMetrics
};

