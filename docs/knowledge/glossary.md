| Term | Context | Meaning | Avoid | Code name | Rules |
|---|---|---|---|---|---|
| Startup context | Context audit | What an agent tool puts in context when a session starts, before the first prompt, from the project's files | initial context, preload | `startupSet` | BR-0001 |
| Folder-scoped file | Context audit | An instruction file below the project root, loaded only when the agent works in its folder | nested context | `folderScoped` | BR-0002 |
| Budget | Context audit | The most tokens a tool's startup context may hold before the audit fails | limit, quota | `budget` | BR-0001 |
