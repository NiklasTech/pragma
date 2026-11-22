# Voice dictation

Dictate messages instead of typing them, in the chat composer and in coding CLI terminal panes. Configure dictation in **Settings > Agents > Voice input**.

## Set it up

Voice input is on by default: the chat composer shows a microphone button. To set it up:

1. Open **Settings > Agents > Voice input**.
2. Check that **Enable** is on. The **Microphone access** row below it shows whether Pragma may use the microphone and asks for access when needed.
3. Keep the default engine, **Parakeet (local)**, or choose another one.

Click the microphone to start recording and click it again (**Stop dictation**) to insert the transcript at the cursor. Nothing is sent until you send the message yourself.

On macOS, dictation is only available when Pragma runs as the installed app bundle, because macOS asks for microphone access per app.

## Engines

| Engine           | Runs                                  | Platforms                                      |
| ---------------- | ------------------------------------- | ---------------------------------------------- |
| Web Speech       | Speech service of the system web view | All, depending on the web view                 |
| Whisper (local)  | whisper.cpp on your CPU               | Windows x64, Linux x64                         |
| Parakeet (local) | Parakeet V3 on your CPU               | macOS on Apple Silicon, Windows x64, Linux x64 |

The local engines keep the audio on your machine. They need a one-time download, which **Settings > Agents > Voice input** offers for the selected engine, with a progress bar and a cancel button. Parakeet is the default engine. Where it has no build, such as on Intel Macs, dictation uses Web Speech instead, and the settings say so.

Web Speech uses the speech service of the system web view. Depending on the system, the audio may be sent to its provider, for example Apple, for transcription.

## Model choice

Each local engine shows the model it uses and how much memory it needs while transcribing.

| Model                  | Engine   | Memory  | Notes                                                                                                   |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Parakeet V3 Compact    | Parakeet | ~0.9 GB | 4-bit weights. German and English are as accurate as the full model; some other languages lose a little |
| Parakeet V3            | Parakeet | ~1.4 GB | 8-bit weights. Full accuracy in all 25 languages                                                        |
| Whisper Large V3 Turbo | Whisper  | ~0.9 GB | The most accurate local model, but on the CPU it takes about as long as the recording                   |

Pragma reads the installed memory and marks one Parakeet model as **recommended**: the full Parakeet V3 from 12 GB of RAM, the compact model below that. Parakeet is much faster than Whisper and the better default for most machines.

Downloaded engines and models are stored in Pragma's application data directory, under `parakeet/` and `stt/`.

## Hold to dictate

Bind **Hold to Dictate** in **Settings > Keys** to record only while a key combination is held. It has no default binding.

- In the chat composer, recording stops when you release the keys and the transcript is inserted at the cursor.
- In a [coding CLI terminal pane](./coding-clis.md), the transcript is typed into the terminal without pressing `Enter`, so you can review it before you submit.

When several composers or panes are open, the one that had focus last owns the shortcut.
