/**
 * ════════════════════════════════════════════════════════════════════════════
 * SANDRA CORE - Módulo Principal de Sandra IA 8.0
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Punto de entrada principal para el sistema de orquestación de Sandra.
 */

const SandraOrchestrator = require('./orchestrator');
const DecisionEngine = require('./decision-engine');
const ModelInvoker = require('./model-invoker');

/**
 * Crea una instancia del orquestador de Sandra
 */
function createOrchestrator(config = {}) {
  return new SandraOrchestrator(config);
}

/**
 * Crea una instancia del motor de decisión
 */
function createDecisionEngine() {
  return new DecisionEngine();
}

/**
 * Crea una instancia del invocador de modelos
 */
function createModelInvoker(config = {}) {
  return new ModelInvoker(config);
}

module.exports = {
  SandraOrchestrator,
  DecisionEngine,
  ModelInvoker,
  createOrchestrator,
  createDecisionEngine,
  createModelInvoker
};

