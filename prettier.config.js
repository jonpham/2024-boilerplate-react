/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const prettierConfig = {
  plugins: ['prettier-plugin-tailwindcss'],
  semi: true,
  singleQuote: true,
  tailwindStylesheet: './src/application/style/index.css',
  trailingComma: 'es5',
};

export default prettierConfig;
