module.exports = {
  "*.{ts,tsx,js,mjs}": ["prettier --write", "eslint --fix"],
  "*.md": ["prettier --write"],
  "!(package).json": ["eslint --fix"],
};
