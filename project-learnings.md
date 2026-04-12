

## 2026-04-12 -- Session cards: "last actor" must be human, not Claude [decision]

When showing "last person to interact" on session cards, always filter to human users only — never show "Claude" or "assistant". The AI is always working; what matters is which real person last engaged. Query path: filter `chat_messages` to `role = 'user'`, then join `chat_sessions.userId → users.name` for the human's display name. Show as "Last: Fabio 2h ago" not "Last: Claude".
