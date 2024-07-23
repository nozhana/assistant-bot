interface Resources {
  "admin": {
    "btn.menu": "👑 Admin menu",
    "btn.users": "👥 All Users",
    "btn.broadcast": "📣 Broadcast",
    "html.menu": "👑 <b>Management</b>",
    "cb.menu": "👑 Management",
    "cb.users": "👥 All Users (page {{page}} of {{pages}})",
    "html.users": "👥 <b>All Users</b>\n<i>Page {{page}} of {{pages}}</i>",
    "cb.user": "👤 User {{id}}",
    "html.user": "👤 <b>User details</b>\n\n🧑 First name: <code>{{firstName}}</code>\n#️⃣ Telegram ID: <code>{{id}}</code>\n💬 Conversations: <code>{{convLength}} conversations</code>\n🤖 Assistants: <code>{{asstLength}} assistants</code>\n\n<a href=\"tg://user?id={{id}}\">🔗 Go to user profile</a>",
    "cb.user.deleted": "🗑️ Deleted user {{user}} and all their data.",
    "cb.broadcast": "📣 Broadcast",
    "html.broadcast": "📣 <b>Send a message to broadcast to all users.</b>",
    "html.broadcast.confirm": "📨 <b>Confirm broadcast?</b>\n⚠️ <b>Warning:</b> Proceed with caution.",
    "html.broadcast.failed.user": "❌ Failed to deliver to <b>{{user}} - {{userId}}</b>",
    "html.broadcast.done": "✅ <b>Broadcast finished.</b>"
  },
  "asst": {
    "btn.new": "➕ Create",
    "html.assts": "🤖 <b>Assistants</b>",
    "cb.assts": "🤖 Assistants",
    "cb.new": "🤖 New assistant",
    "cb.deleted": "✅ Deleted assistant.",
    "cb.codeinterpreter.on": "🧑‍💻 Code interpreter turned ON for {{assistant}}.",
    "cb.codeinterpreter.off": "🧑‍💻 Code interpreter turned OFF for {{assistant}}.",
    "cb.rss.on": "⏬ RSS reader turned ON for {{assistant}}.",
    "cb.rss.off": "⏬ RSS reader turned OFF for {{assistant}}.",
    "cb.weather.on": "🌦️ Weather tool turned ON for {{assistant}}.",
    "cb.weather.off": "🌦️ Weather tool turned OFF for {{assistant}}.",
    "cb.google.on": "🔎 Google search turned ON for {{assistant}}.",
    "cb.google.off": "🔎 Google search turned OFF for {{assistant}}.",
    "cb.public.off": "🔒 Made {{assistant}} private.",
    "cb.public.on": "🌍 Made {{assistant}} public.",
    "btn.name": "✏️ Name",
    "btn.inst": "✏️ Instructions",
    "btn.greeting": "✏️ Greeting",
    "btn.no.greeting": "🗑️ Remove greeting",
    "btn.conv.new": "❇️ New conversation",
    "btn.files": "🗃️ Files",
    "btn.codeinterpreter": "🧑‍💻 Code interpreter",
    "btn.rss": "⏬ RSS reader",
    "btn.weather": "🌦️ Weather",
    "btn.google": "🔎 Google",
    "btn.share": "↗️ Share assistant",
    "btn.revoke": "🚯 Revoke access",
    "btn.revoke.all": "🚯 Revoke all access",
    "btn.public.off": "🔒 Make private",
    "btn.public.on": "🌍 Make public",
    "btn.back.assts": "👈 Assistants",
    "html.asst": "🤖 <b>Name:</b> <code>{{assistant}}</code>\n\n☝️ <b>Instructions:</b>\n<pre>{{instructions}}</pre>\n\n 💬 <b>Greeting message:</b>\n<pre>{{greeting}}</pre>",
    "html.revoke": "🚯 <b>Revoke access</b>\n\nChoose a user below to revoke their access to <b>{{assistant}}</b>.",
    "html.inst.toolong": "Instructions too long to print.",
    "html.greeting.toolong": "Greeting too long to print.",
    "html.asst.shared_one": "↗️ <b>Shared with {{count}} person.</b>",
    "html.asst.shared_other": "↗️ <b>Shared with {{count}} people.</b>",
    "cb.name": "🤖 New name",
    "cb.inst": "☝️ New instructions",
    "cb.greeting": "💬 New greeting",
    "cb.greeting.del": "🗑️ Removed greeting for {{assistant}}.",
    "html.asst.new.name": "🤖 Enter a new <b>name</b> for the assistant.\n\nCurrent name:\n<code>{{name}}</code>",
    "html.asst.new.inst": "☝️ Enter the <b>instructions</b> for your assistant.\n\nCurrent instructions:\n<pre>{{instructions}}</pre>",
    "html.asst.new.greeting": "💬 Enter the <b>greeting message</b> for your assistant. <i>(Max. 512 characters)</i>\n💁 <b>Note:</b> <i>You can use these two placeholders to be replaced with corresponding values automatically during chat. These values will be unique per user, and will be automatically updated if the assistant's name is changed:</i>\n<code>{{user}}</code> 👉 <i>User's first name</i>\n<code>{{char}}</code> 👉 <i>Assistant name</i>\n\nCurrent greeting message:\n<pre>{{greeting}}</pre>",
    "html.asst.new.name.toolong": "❌ <b>The name entered is too long.</b>\n<i>Enter a name no longer than 64 characters.</i>",
    "html.asst.new.inst.toolong": "❌ <b>The instructions are too long.</b>\n<i>Enter a text no longer than 3072 characters.</i>",
    "html.asst.new.greeting.toolong": "❌ <b>The greeting message is too long.</b>\n<i>Enter a greeting message of max. 512 characters.</i>",
    "html.asst.new.confirm": "👀 Create assistant with this configuration?",
    "btn.retry": "🔄 Try again",
    "btn.create": "✅ Create",
    "cb.cancelled": "❌ Cancelled.",
    "cb.restarted": "🔄 Restarted process.",
    "cb.creating": "🛜 Creating assistant...",
    "html.creating": "<i>Creating new assistant, please wait...</i>",
    "html.created": "❇️ <b>Created new assistant successfully.</b>",
    "html.imported": "⬇️ <b>Imported new assistant successfully.</b>",
    "btn.import": "⬇️ Import",
    "cb.import": "⬇️ Import assistant",
    "html.import": "⬇️ <b>Import an assistant from online character libraries</b>\n⚠️ <i>Only <b>chub.ai</b> characters are supported for now.</i>\n\n🔗 Enter a valid character URL to import.\n\n<i>Example:</i>\n<pre>https://chub.ai/characters/characterizerfin/adrielle-12131f79</pre>",
    "html.import.url.notsupported": "❌ This URL isn't supported.",
    "html.import.url.invalid": "❌ This isn't a URL. Please enter a valid character URL from a supported online library.",
    "cb.guest.missing": "🚫 Assistant doesn't seem to exist anymore.",
    "cb.guest.exists": "🚫 You already have {{assistant}} in your library.",
    "cb.guest.added": "✅ {{assistant}} added to library.",
    "cb.revoke": "🚯 Revoke access",
    "cb.revoke.user": "🚯 {{user}} no longer has access to this assistant.",
    "cb.revoke.all": "🚯 {{assistant}} is no longer shared with anyone.",
    "html.guest.added": "✅ Assistant added to library successfully.\n🤖 <b>Name:</b> <code>{{assistant}}</code>\n☝️ <b>Instructions:</b>\n<pre>{{instructions}}</pre>",
    "inline.html.guest": "Here, try out this new assistant I created!\n🤖 <b>Name:</b> <code>{{assistant}}</code>\n☝️ <b>Instructions:</b>\n<pre>{{instructions}}</pre>",
    "inline.article.no.inst": "No instructions",
    "inline.btn.asst.add": "⬇️ Add {{assistant}} to assistants"
  },
  "chat": {
    "cb.chatting": "💬 Chatting",
    "html.chatting": "You're now talking to <b>{{assistant}}</b>.",
    "btn.leave": "🚫 Leave",
    "html.transcription.failed": "❌ <b>Transcription failed.</b>",
    "html.doc.upload.failed": "❌ <b>Failed to upload document.</b>",
    "html.doc.upload.success": "📎 Attached document to assistant.\n📁 <b>Filename:</b> <code>{{filename}}</code>\n\n⏳ This file is set to expire after <b>{{count}} days</b> of inactivity.",
    "html.photo.upload.success": "🏞️ Attached photo to code interpreter for assistant.\n📁 <b>Filename:</b> <code>{{filename}}</code>\n\n⏳ This photo is set to expire after <b>{{count}} days</b> of inactivity.",
    "cb.leave": "🚫 Left conversation.",
    "html.response.audio.failed": "❌ <b>Failed to encode response audio.</b>",
    "html.codeinterpreter.created": "🧑‍💻 <i>Running code...</i>",
    "html.codeinterpreter.done": "✅ <i>Code run successfully.</i>",
    "html.codeinterpreter.logs": "<b>Console log \\></b>",
    "html.filesearch.created": "📁 <i>Searching files...</i>",
    "html.filesearch.done": "✅ <i>File search done.</i>",
    "html.rss.created": "⏬ <i>Fetching RSS feed:</i>\n<code>{{url}}</code>",
    "html.rss.done": "✅ <i>RSS data fetched successfully.</i>",
    "html.weather.created": "🌦️ <i>Fetching weather data:</i> <code>{{query}}</code>",
    "html.weather.done": "🌦️ <i>Weather data fetched successfully.</i>",
    "html.google.created": "🔎 <i>Googling:</i>\n<code>{{query}}</code>",
    "html.google.filter.filetype": "📎 <i>Only</i> <code>{{fileType}}</code> <i>files</i>",
    "html.google.filter.page": "📖 <i>Page {{page}} of results</i>",
    "html.google.filter.site.include": "🌐 <i>Only including results from</i>\n<code>{{site}}</code>",
    "html.google.filter.site.exclude": "🚫 <i>Excluding results from</i>\n<code>{{site}}</code>",
    "html.google.done": "🔎 <i>Fetched Google results.</i>",
    "html.usage": "🗨️ <b>Prompt:</b> <code>{{promptTokens}} tokens</code>\n💬 <b>Completion:</b> <code>{{completionTokens}} tokens</code>\n\n💸 <b>Total:</b> <code>{{totalTokens}} tokens</code>",
    "html.rename": "✨ Renamed conversation:"
  },
  "common": {
    "btn.back": "👈 Back",
    "btn.prev": "⬅️ Page {{page}}",
    "btn.next": "Page {{page}} ➡️",
    "btn.delete": "🗑️ Delete",
    "btn.confirm": "✅ Confirm",
    "btn.cancel": "❌ Cancel",
    "cb.cancelled": "❌ Cancelled.",
    "lang.feedback": "Language changed to 🇬🇧 English.",
    "coming.soon": "👟 Coming soon",
    "html.wait": "<i>Please wait...</i>",
    "html.help": "💁 <b>Help</b>\n\n/start | /help — ℹ️ Show this message\n/chat — 💬 Talk to an assistant\n/assistants — 🤖 Manage assistants\n/settings — ⚙️ Settings menu\n/wallet - 🐷 Wallet",
    "cb.error": "❌ There was an error handling your request. Please try again."
  },
  "conv": {
    "cb.convs.page": "💬 Conversations (page {{page}} of {{pages}})",
    "cb.convs": "💬 Conversations",
    "html.conv.missing": "Conversation {{id}} doesn't exist in the database.",
    "btn.continue": "💬 Continue",
    "btn.history": "📖 History",
    "btn.del.all": "🗑️ Delete all conversations",
    "cb.del.all": "🗑️ Deleted all conversations.",
    "cb.deleted": "🗑️ Deleted conversation.",
    "tokens": "tokens",
    "cb.new": "🤖 Choose assistant",
    "html.new": "Choose an <b>assistant</b> to start a new conversation with.",
    "btn.new": "➕ New conversation",
    "html.convs": "💬 <b>Conversations</b>\n<i>Page {{page}} of {{pages}}</i>",
    "html.convs.empty": "💬 <b>You have no previous conversations.</b>"
  },
  "files": {
    "cb.files": "🗃️ {{assistant}}'s files",
    "cb.file": "📁 File details",
    "cb.files.page": "🗃️ {{assistant}}'s files - page {{page}}",
    "btn.del.all": "🗑️ Delete all files",
    "html.empty": "📂 <b>You haven't uploaded any files yet.</b>\n❇️ <i>Start by uploading files to your assistant in chat.</i>",
    "html.list": "🗃️ <b>{{assistant}}'s files</b>\n\n💁 <i>Tap on a filename to view details.</i>",
    "btn.codeinterpreter": "🧑‍💻 Code interpreter",
    "btn.filesearch": "🔎 File search",
    "html.file": "#️⃣ <b>ID:</b> <code>{{id}}</code>\n\n📁 <b>Filename:</b> <code>{{filename}}</code>\n\n🤖 <b>Assistant:</b> <code>{{assistant}}</code>",
    "cb.code.off": "🧑‍💻 File removed from code interpreter storage.",
    "cb.code.on": "🧑‍💻 File added to code interpreter storage.",
    "cb.filesearch.unavailable": "❌ You cannot change the File search functionality.",
    "cb.deleted": "🗑️ {{file}} deleted successfully.",
    "cb.deleted.all": "🗑️ All files deleted successfully."
  },
  "settings": {
    "btn.response.text": "💬 Switch to text response",
    "btn.response.voice": "🔈 Switch to voice response",
    "btn.voice": "🗣️ Change voice",
    "html.settings": "⚙️ <b>Settings</b>",
    "cb.settings": "⚙️ Settings",
    "cb.response.text": "💬 Switched to text response.",
    "cb.response.voice": "🔈 Switched to voice response.",
    "html.voice": "🗣️ Selected voice: <b>{{voice}}</b>",
    "cb.voice": "🗣️ Voices",
    "cb.voice.changed": "🗣️ Voice set to {{voice}}",
    "html.lang.change": "🌐 <b>Change bot language</b>",
    "cb.lang.change": "🌐 Change language"
  },
  "wallet": {
    "lit.token.count_zero": "no tokens",
    "lit.token.count_one": "{{count}} token",
    "lit.token.count_other": "{{count}} tokens",
    "html.wallet_one": "🐷 <b>Wallet</b>\n\n👋 Hello, {{user}}.\n<b>Token balance:</b> <code>{{balance}}</code> token",
    "html.wallet_other": "🐷 <b>Wallet</b>\n\n👋 Hello, {{user}}.\n<b>Token balance:</b> <code>{{count}}</code> tokens",
    "cb.wallet": "🐷 Wallet",
    "btn.topup": "💳 Top up",
    "btn.gift": "🎁 Gift",
    "cb.topup": "💳 Top up",
    "html.topup": "💳 <b>Top up your balance.</b>\n\n👇 <i>Choose one of the plans offered below.\nYou'll be redirected to a crypto payment gateway to complete your order.</i>"
  }
}

export default Resources;
