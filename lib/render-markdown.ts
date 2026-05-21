// Minimal markdown → plain-text sanitizer for terminal-style UI.
// Strips formatting markers without adding HTML — keeps the mono/terminal aesthetic.
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')        // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')             // *italic* → italic
    .replace(/^#{1,6}\s+/gm, '')             // ## heading → heading
    .replace(/^[-*+]\s+/gm, '• ')           // - list → • list
    .replace(/`(.+?)`/g, '$1')               // `code` → code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')     // [text](url) → text
    .trim()
}
