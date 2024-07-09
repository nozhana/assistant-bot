const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "\\&")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
};

export default escapeHtml;
