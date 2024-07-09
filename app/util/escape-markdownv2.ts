const escapeMarkdownV2 = (unsafe: string) => {
  unsafe
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/./g, "\\.")
    .replace(/!/g, "\\!")
    .replace(/~/g, "\\~")
    .replace(/|/g, "\\|")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/>/g, "\\>")
    .replace(/</g, "\\<");
};
