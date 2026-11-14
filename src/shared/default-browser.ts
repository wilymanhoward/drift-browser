export interface DefaultBrowserStatus {
  supported: boolean;
  installed: boolean;
  isDefault: boolean;
  // Drift as the app that opens PDF files.
  pdfInstalled: boolean;
  pdfDefault: boolean;
}
