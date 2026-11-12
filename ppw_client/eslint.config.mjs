import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // 1. Ignorar pastas de build e dependências
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),

  // 2. Trazer as configurações base do Next.js
  ...nextVitals,
  ...nextTs,
  prettierRecommended,
  // 3. Adicionar regras específicas de TypeScript para maior controle
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Isso ajuda o ESLint a entender o contexto do projeto para regras avançadas
        project: "./tsconfig.json",
      },
    },
    rules: {
      // Desabilita a regra de 'any' para facilitar o seu HATEOAS e Redirects
      "@typescript-eslint/no-explicit-any": "off",

      // Desabilita avisos de 'unsafe' para quando você lida com retornos dinâmicos da API
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",

      // Organização de imports e variáveis não usadas
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Regras de boas práticas
      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Garante que você trate promessas, mas sem ser restritivo demais
      "@typescript-eslint/no-floating-promises": "warn",
      "prettier/prettier": "error",
    },
  },
]);

export default eslintConfig;
