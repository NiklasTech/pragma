# Local Tasks

The task board is a small to-do list for agent work, kept per workspace on your machine. Each task can be handed to an agent with one click, and the agent's result is written back to the task.

Open the board with **Tasks** at the top of the thread list.

## Columns

| Column      | Meaning                                |
| ----------- | -------------------------------------- |
| Todo        | Not started                            |
| In progress | An agent session is working on it      |
| In review   | The session finished; check the result |
| Done        | Finished and accepted                  |

Drag a card to another column to change its status, or set the status in the task dialog.

## Create a task

Select **New task** and fill in:

| Field  | Notes                                                                     |
| ------ | ------------------------------------------------------------------------- |
| Title  | 1 to 120 characters                                                       |
| Notes  | Details, constraints and links, up to 8000 characters                     |
| Status | The column the task starts in                                             |
| Agent  | **Built-in agent** or one of your [named agents](./named-agents.md)       |
| Result | What came out of the work, up to 4000 characters; filled in automatically |

## Run a task

**Run** in the card menu starts a new agent session for the task, titled after it, and sends the title and notes as the first message. The task moves to **In progress** and is linked to the session.

When the session finishes successfully, the task moves to **In review**. For the built-in agent, its completion summary is stored as the result.

Further actions on a running or finished task:

- **Stop** stops the linked session.
- **Resume** sends "Continue the task." to the linked session, for example after you stopped it or it hit the step limit.
- **Edit** opens the task dialog, which also shows the linked session.

Only one session runs at a time, so **Run** and **Resume** are disabled while another session is busy.

## Storage

Tasks are stored per workspace in `pragma/tasks/<workspace hash>.json` inside Pragma's application data directory. They are not part of the repository.
