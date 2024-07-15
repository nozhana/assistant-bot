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
    "btn.new": "➕ New assistant",
    "html.assts": "🤖 <b>Assistants</b>",
    "cb.assts": "🤖 Assistants",
    "cb.new": "🤖 New assistant",
    "cb.deleted": "✅ Deleted assistant.",
    "cb.codeinterpreter.on": "🧑‍💻 Code interpreter turned ON for {{assistant}}.",
    "cb.codeinterpreter.off": "🧑‍💻 Code interpreter turned OFF for {{assistant}}.",
    "btn.name": "✏️ Name",
    "btn.inst": "✏️ Instructions",
    "btn.conv.new": "❇️ New conversation",
    "btn.codeinterpreter": "🧑‍💻 Code interpreter",
    "btn.share": "↗️ Share assistant",
    "btn.back.assts": "👈 Assistants",
    "html.asst": "🤖 <b>Name:</b> <code>{{assistant}}</code>\n\n☝️ <b>Instructions:</b>\n<pre>{{instructions}}</pre>",
    "html.asst.shared_one": "↗️ <b>Shared with {{count}} person.</b>",
    "html.asst.shared_other": "↗️ <b>Shared with {{count}} people.</b>",
    "html.asst.new.name": "🤖 Enter a new <b>name</b> for the assistant.",
    "html.asst.new.inst": "☝️ Enter the <b>instructions</b> for your assistant.",
    "html.asst.new.confirm": "👀 Create assistant with this configuration?",
    "btn.retry": "🔄 Try again",
    "btn.create": "✅ Create",
    "cb.cancelled": "❌ Cancelled.",
    "cb.restarted": "🔄 Restarted process.",
    "cb.creating": "🛜 Creating assistant...",
    "html.creating": "<i>Creating new assistant, please wait...</i>",
    "html.created": "❇️ <b>Created new assistant successfully.</b>",
    "cb.guest.missing": "🚫 Assistant doesn't seem to exist anymore.",
    "cb.guest.exists": "🚫 You already have {{assistant}} in your library.",
    "cb.guest.added": "✅ {{assistant}} added to library.",
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
    "cb.leave": "🚫 Left conversation.",
    "html.response.audio.failed": "❌ <b>Failed to encode response audio.</b>",
    "html.codeinterpreter.created": "🧑‍💻 <i>Running code...</i>",
    "html.codeinterpreter.done": "🧑‍💻 <i>Code run successfully.</i>",
    "html.codeinterpreter.logs": "<b>Console log \\></b>",
    "html.filesearch.created": "📁 <i>Searching files...</i>",
    "html.filesearch.done": "📁 <i>File search done.</i>",
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
    "html.help": "💁 <b>Help</b>\n\n/start | /help — ℹ️ Show this message\n/chat — 💬 Talk to an assistant\n/assistants — 🤖 Manage assistants\n/settings — ⚙️ Settings menu"
  },
  "conv": {
    "cb.convs.page": "💬 Conversations (page {{page}} of {{pages}})",
    "cb.convs": "💬 Conversations",
    "html.conv.missing": "Conversation {{id}} doesn't exist in the database.",
    "btn.continue": "💬 Continue",
    "btn.history": "📖 History",
    "cb.deleted": "🗑️ Deleted Conversation.",
    "tokens": "tokens",
    "cb.new": "🤖 Choose assistant",
    "html.new": "Choose an <b>assistant</b> to start a new conversation with.",
    "btn.new": "➕ New conversation",
    "html.convs": "💬 <b>Conversations</b>\n<i>Page {{page}} of {{pages}}</i>",
    "html.convs.empty": "💬 <b>You have no previous conversations.</b>"
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
  }
}

export default Resources;
