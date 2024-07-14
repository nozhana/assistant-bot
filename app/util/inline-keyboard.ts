import { Markup } from "telegraf";
import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
} from "telegraf/typings/core/types/typegram";

export type Hideable<B> = B & { hide?: boolean };

class InlineKeyboard implements InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][] = [];

  text(text: string, data: string, hide?: boolean) {
    if (hide) return this;
    const button = Markup.button.callback(text, data, hide);
    this.inline_keyboard.push([button]);
    return this;
  }

  url(text: string, url: string, hide?: boolean) {
    if (hide) return this;
    const button = Markup.button.url(text, url, hide);
    this.inline_keyboard.push([button]);
    return this;
  }

  switchToChat(text: string, value?: string, hide?: boolean) {
    if (hide) return this;
    const button = Markup.button.switchToChat(text, value ?? "", hide);
    this.inline_keyboard.push([button]);
    return this;
  }

  button(button: Hideable<InlineKeyboardButton>) {
    if (button.hide) return this;
    this.inline_keyboard.push([button]);
    return this;
  }

  row(...buttons: Hideable<InlineKeyboardButton>[]) {
    const row = buttons.filter((b) => !b.hide);
    if (!row.length) return this;
    this.inline_keyboard.push(row);
    return this;
  }

  rows(...rows: Hideable<InlineKeyboardButton>[][]) {
    const aggregation = rows
      .map((row) => row.filter((b) => !b.hide))
      .filter((row) => row.length);
    this.inline_keyboard.push(...aggregation);
    return this;
  }

  static text = Markup.button.callback;

  static url = Markup.button.url;

  static switchToChat = Markup.button.switchToChat;
}

export default InlineKeyboard;
