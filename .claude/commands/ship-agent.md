Spawn an agent to run the ship skill. The agent needs no context from this conversation.

Use the Agent tool with this exact call:
- description: "Ship changes"
- prompt: "Use the Skill tool with skill='ship' to build, test, commit, and push all changes to GitHub. Do not retry if anything fails — report the exact error output and stop."

Do not retry if the agent reports a failure. Return the agent's result to the user.
