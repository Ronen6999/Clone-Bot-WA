Place WhatsApp-compatible WebP sticker files in this folder named after moods you want to support.

Supported filenames (example):
- happy.webp
- sad.webp
- angry.webp
- neutral.webp

When the bot detects the chat mood it will attempt to send the corresponding sticker after replying.

Folder layout (multiple stickers per mood)
- You can provide multiple stickers per mood by creating a subfolder named after the mood and placing `.webp` files inside. Example layout:

```
stickers/
	happy/
		1.webp
		2.webp
	sad/
		a.webp
		b.webp
	angry.webp   # single-file fallback still supported
```

The bot will pick a random `.webp` file from the mood folder when available. If the folder is missing or empty, it will fall back to `stickers/<mood>.webp`.

Notes:
- Stickers must be WebP files (WhatsApp sticker format). Use any online converter to make WebP sticker files.
- If a mood-specific sticker file is missing, the bot will skip sending a sticker.
- You can add more moods by adding files with the desired mood name (e.g., `excited.webp`) and the bot will try to use them.

Sticker probability
- By default the bot will only send a sticker sometimes. Configure the chance with the `STICKER_PROB` environment variable (value between `0` and `1`).
	- Example: `STICKER_PROB=0.5` sends a sticker 50% of the time when a mood is detected.
