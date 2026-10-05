// pdfkit 0.20's browser build exports these, but @types/pdfkit doesn't describe them yet.
declare module "pdfkit" {
  export function registerStdFonts(...fonts: object[]): void;
}

declare module "pdfkit/standard-fonts/*" {
  const font: object;
  export default font;
}
