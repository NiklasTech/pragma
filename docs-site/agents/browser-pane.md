# Browser Pane

The browser pane shows a web page next to your sessions, typically the dev server an agent just started. It counts as one of the eight panes in the grid.

## Open a browser pane

- **Pane layout > Open browser** adds an empty browser pane.
- **Open in browser** in a pane header opens the most recent local URL that the session printed, such as `http://localhost:5173`. The button appears once a URL from `localhost`, `127.0.0.1` or `[::1]` shows up in the output.
- Agents can open a URL themselves with their open-browser tool. The page opens in the background, so the conversation keeps focus.

If a browser pane is already open, a new URL is loaded in it instead of adding another pane. When all eight panes are in use, no browser pane can be opened.

## Using the pane

The toolbar has **Back**, **Forward**, **Reload** and an address field. Enter a URL and press `Enter`:

- Only `http` and `https` URLs are accepted.
- A bare host gets `http://` for `localhost`, `127.0.0.1` and `[::1]`, and `https://` otherwise, so `localhost:3000` opens `http://localhost:3000`.

Pages run in a sandboxed frame. Sites that forbid embedding in frames, which includes many public websites, do not load in the pane; open them in your system browser instead. Agents only open the page for you to see; they do not receive its content.
