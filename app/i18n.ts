import i18next from "i18next";

import admin from "../locales/en/admin.json";
import asst from "../locales/en/asst.json";
import chat from "../locales/en/chat.json";
import common from "../locales/en/common.json";
import conv from "../locales/en/conv.json";
import files from "../locales/en/files.json";
import settings from "../locales/en/settings.json";
import wallet from "../locales/en/wallet.json";

import deAdmin from "../locales/de/admin.json";
import deAsst from "../locales/de/asst.json";
import deChat from "../locales/de/chat.json";
import deCommon from "../locales/de/common.json";
import deConv from "../locales/de/conv.json";
import deFiles from "../locales/de/files.json";
import deSettings from "../locales/de/settings.json";
import deWallet from "../locales/de/wallet.json";

import faAdmin from "../locales/fa/admin.json";
import faAsst from "../locales/fa/asst.json";
import faChat from "../locales/fa/chat.json";
import faCommon from "../locales/fa/common.json";
import faConv from "../locales/fa/conv.json";
import faFiles from "../locales/fa/files.json";
import faSettings from "../locales/fa/settings.json";
import faWallet from "../locales/fa/wallet.json";

i18next.init({
  // debug: true,
  fallbackLng: "en",
  defaultNS: "common",
  fallbackNS: "common",
  resources: {
    en: {
      admin,
      asst,
      chat,
      common,
      conv,
      files,
      settings,
      wallet,
    },
    de: {
      admin: deAdmin,
      asst: deAsst,
      chat: deChat,
      common: deCommon,
      conv: deConv,
      files: deFiles,
      settings: deSettings,
      wallet: deWallet,
    },
    fa: {
      admin: faAdmin,
      asst: faAsst,
      chat: faChat,
      common: faCommon,
      conv: faConv,
      files: faFiles,
      settings: faSettings,
      wallet: faWallet,
    },
  },
});

export default i18next;
