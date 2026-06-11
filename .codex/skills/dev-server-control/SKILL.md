---
name: dev-server-control
description: Start, stop, and verify the CSIscore_app Next.js development server. Use when Codex needs to run `npm run dev`, provide a local URL, stop the dev server, clean up a lingering `next dev` or `next-server` process, or confirm that port 3000 has been released.
---

# Dev Server Control

## Starting

Start the development server from the repository root:

```bash
npm run dev
```

Use an interactive or long-running command session when possible so Ctrl-C can be sent later. Report the URL shown by Next.js, normally `http://localhost:3000`.

## Stopping

First try to stop the running session with Ctrl-C if the session is still open.

If stdin is closed, the session has been lost, or the user still sees the server running, check for host-side Next.js processes:

```bash
pgrep -af "next dev|next-server|npm run dev|node.*next"
```

Stop the matching process IDs:

```bash
kill <pid> [<pid> ...]
```

If a normal `kill` does not stop the process after a short wait, re-check the process list and then use a stronger signal only for the confirmed dev-server PIDs:

```bash
kill -9 <pid> [<pid> ...]
```

## Verification

Confirm that no development server remains:

```bash
pgrep -af "next dev|next-server|npm run dev|node.*next"
lsof -ti :3000
```

An exit code of `1` with no output from these confirmation commands is expected: it means no matching process or port listener was found.

When sandboxed process checks do not match what the user observes, request escalated execution for `pgrep` and `lsof` so the host-side process table is checked.
