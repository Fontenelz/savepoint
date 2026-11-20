// Função serverless da Vercel: todas as rotas são reescritas para cá (ver vercel.json).
// O código vem do build do Nest (dist/), compilado pelo tsc com os metadados de decorators.
module.exports = require('../dist/serverless.js').default;
