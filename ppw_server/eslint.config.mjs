// Importa as regras de qualidade padrão oficiais do JavaScript fornecidas pelo ESLint
import eslint from '@eslint/js';

// Importa o conjunto de ferramentas e utilitários de linting específicos para TypeScript
import tseslint from 'typescript-eslint';

// Importa a integração que junta as regras do Prettier com o ESLint para formatação de código
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

// Importa definições de variáveis globais conhecidas em diferentes ambientes (como Node.js e Jest)
import globals from 'globals';

// Exporta a configuração padrão utilizando a função utilitária do typescript-eslint
export default tseslint.config(
  // Bloco 1: Define quais arquivos e pastas o ESLint DEVE IGNORAR totalmente
  {
    ignores: [
      'eslint.config.mjs', // Ignora o próprio arquivo de configuração do ESLint
      'dist/',             // Ignora a pasta de build/compilação do NestJS
      'node_modules/',     // Ignora as bibliotecas e dependências de terceiros instaladas
    ],
  },

  // Bloco 2: Aplica o conjunto básico e recomendado de regras para código JavaScript
  eslint.configs.recommended,

  // Bloco 3: Aplica regras avançadas para TypeScript baseadas na análise de tipos do código
  ...tseslint.configs.recommendedTypeChecked,

  // Bloco 4: Aplica o plugin do Prettier para acusar erros de formatação (espaços, aspas, etc.)
  eslintPluginPrettierRecommended,

  // Bloco 5: Configurações sobre como o código deve ser lido/interpretado pelo analisador
  {
    languageOptions: {
      // Define as variáveis globais disponíveis no projeto sem causar aviso de "variável não definida"
      globals: {
        ...globals.node, // Habilita variáveis do Node.js (ex: process, __dirname, Buffer)
        ...globals.jest, // Habilita variáveis de testes do Jest (ex: describe, test, expect)
      },

      // Define que o código usa módulos modernizados do ES6 (comandos import e export)
      sourceType: 'module',

      // Opções detalhadas do interpretador de sintaxe do TypeScript (parser)
      parserOptions: {
        // Usa o serviço automático de gerenciamento de projetos do TypeScript para checar tipos
        projectService: true,
        // Define a pasta raiz do projeto apontando onde o arquivo tsconfig.json está localizado
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Bloco 6: Regras customizadas do projeto (onde ativamos, desativamos ou alteramos comportamentos)
  {
    rules: {
      // --- Regras do TypeScript desativadas para facilitar a Injeção de Dependências e DTOs do NestJS ---
      "@typescript-eslint/no-unsafe-assignment": "off",          // Permite atribuir valores com tipo flexível/desconhecido
      "@typescript-eslint/no-explicit-any": "off",               // Permite o uso do tipo 'any' explicitamente
      "@typescript-eslint/no-floating-promises": "warn",         // Avisa se uma Promise não tiver 'await' ou tratar erros
      "@typescript-eslint/no-unsafe-argument": "off",            // Permite passar argumentos de tipo flexível para funções
      "@typescript-eslint/interface-name-prefix": "off",         // Desativa obrigatoriedade de prefixo 'I' em interfaces
      "@typescript-eslint/explicit-function-return-type": "off", // Não obriga declarar o tipo de retorno de toda função
      "@typescript-eslint/explicit-module-boundary-types": "off",// Não obriga declarar tipos em métodos públicos exportados
      "@typescript-eslint/no-unsafe-call": "off",                // Permite chamar funções cujos tipos não foram definidos
      "@typescript-eslint/no-unsafe-member-access": "off",       // Permite acessar propriedades de objetos com tipo incerto
      "@typescript-eslint/no-unsafe-return": "off",              // Permite retornar valores cujos tipos não foram validados
      "@typescript-eslint/no-redundant-type-constituents": "off",// Permite criar combinações de tipos redundantes em tipos união

      // --- Boas Práticas Gerais do JavaScript/TypeScript ---
      "no-console": ["warn", { allow: ["warn", "error"] }],      // Avisa no console.log(), mas permite console.warn() e error()
      "no-dupe-args": "error",                                    // Proíbe nomes de parâmetros duplicados nas funções
      "no-duplicate-imports": "error",                            // Proíbe importar a mesma biblioteca em múltiplas linhas
      "prefer-const": "error",                                    // Obriga o uso de 'const' para variáveis que nunca mudam
      "no-multiple-empty-lines": ["error", { max: 1 }],           // Permite no máximo 1 linha em branco consecutiva no código

      // Configura erro para variáveis declaradas sem uso (mas ignora se começarem com underline, ex: _req)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
    "prettier/prettier": [
     "error",
      { 
       "singleQuote": true,
       "parser": "flow"
     }
  ]
  },
);