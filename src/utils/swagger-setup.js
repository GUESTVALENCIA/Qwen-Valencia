// ═══════════════════════════════════════════════════════════════════
// SWAGGER SETUP - Configuración de Swagger UI para documentación OpenAPI
// ═══════════════════════════════════════════════════════════════════

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

/**
 * Configura Swagger UI para servir la documentación OpenAPI
 */
function setupSwagger(app, openApiPath = null) {
  try {
    // Cargar especificación OpenAPI
    const openApiFile = openApiPath || path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
    const swaggerDocument = YAML.load(openApiFile);
    
    // Configuración de Swagger UI
    const swaggerOptions = {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Qwen-Valencia API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true
      }
    };
    
    // Servir documentación en /api/docs
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
    
    // Endpoint para obtener la especificación OpenAPI en JSON
    app.get('/api/docs/openapi.json', (req, res) => {
      res.json(swaggerDocument);
    });
    
    // Endpoint para obtener la especificación OpenAPI en YAML
    app.get('/api/docs/openapi.yaml', (req, res) => {
      res.setHeader('Content-Type', 'text/yaml');
      res.sendFile(openApiFile);
    });
    
    return true;
  } catch (error) {
    // Silenciar error si las dependencias no están instaladas
    // (útil para desarrollo sin Swagger)
    return false;
  }
}

module.exports = {
  setupSwagger
};

