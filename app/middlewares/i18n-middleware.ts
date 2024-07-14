import { i18n } from "i18next";
import i18next from "../i18n";
import { Context } from "telegraf";

export type I18nFlavor = {
  i18n: i18n;
  t: i18n["t"];
};

export type I18nContext = Context & I18nFlavor;

const i18nMiddleware = async (ctx: I18nContext, next: () => Promise<void>) => {
  ctx.i18n ??= i18next;
  ctx.t ??= i18next.t;
  return next();
};

export default i18nMiddleware;

export type Language = "en" | "de" | "fa";
export const languages: Language[] = ["en", "de", "fa"];
