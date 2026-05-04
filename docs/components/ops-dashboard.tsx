"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "ready" | "running" | "review" | "blocked" | "merged" | "failed";
type Risk = "low" | "medium" | "high";

type RunTask = {
  id: string;
  title: string;
  issue: string;
  status: Status;
  agent: string;
  model: string;
  workspace: string;
  baseBranch: string;
  branch: string;
  pathScope: string;
  workMode: string;
  runtime: string;
  files: number;
  tests: "pending" | "running" | "passed" | "failed";
  risk: Risk;
  step: string;
  prompt: string;
  events: string[];
  changedFiles: string[];
};

type DirectoryEntry = {
  name: string;
  path: string;
};

type DirectoryResponse = {
  path: string;
  parent: string | null;
  roots: DirectoryEntry[];
  entries: DirectoryEntry[];
  error?: string;
};

const initialTasks: RunTask[] = [
  {
    id: "run-auth-refresh",
    title: "Fix auth token refresh loop",
    issue: "#42",
    status: "running",
    agent: "Pi",
    model: "openai-codex/gpt-5.5",
    workspace: "C:\\Users\\miyam\\dev\\sandcastle",
    baseBranch: "main",
    branch: "agent/fix-auth-refresh",
    pathScope: "src/auth",
    workMode: "New worktree",
    runtime: "12m",
    files: 6,
    tests: "running",
    risk: "medium",
    step: "Running targeted tests",
    prompt:
      "Fix the failing auth refresh loop, keep the public API stable, add a regression test, and commit the result.",
    events: [
      "Sandbox ready on docker",
      "Prompt loaded from .sandcastle/prompt.md",
      "Edited src/auth/refresh.ts",
      "Added regression test",
      "Running npm test -- auth",
    ],
    changedFiles: [
      "src/auth/refresh.ts",
      "src/auth/session.ts",
      "src/auth/refresh.test.ts",
      "docs/content/docs/configuration.mdx",
    ],
  },
  {
    id: "run-pi-default",
    title: "Default Pi to Codex GPT-5.5",
    issue: "#58",
    status: "review",
    agent: "Pi",
    model: "openai-codex/gpt-5.5",
    workspace: "C:\\Users\\miyam\\dev\\sandcastle",
    baseBranch: "main",
    branch: "agent/pi-gpt-55-default",
    pathScope: "src, README.md",
    workMode: "New worktree",
    runtime: "18m",
    files: 5,
    tests: "passed",
    risk: "low",
    step: "Awaiting merge decision",
    prompt:
      "Make Pi selectable and default it to the OpenAI Codex GPT-5.5 model route.",
    events: [
      'Generated scaffold with pi("openai-codex/gpt-5.5")',
      "Updated auth guidance",
      "Ran focused CLI tests",
      "Created patch changeset",
    ],
    changedFiles: [
      "src/InitService.ts",
      "src/cli.ts",
      "src/cli.test.ts",
      "README.md",
      ".changeset/pi-openai-codex-gpt-55.md",
    ],
  },
  {
    id: "run-worktree-lock",
    title: "Audit worktree cleanup locks",
    issue: "#63",
    status: "ready",
    agent: "Codex",
    model: "gpt-5.4",
    workspace: "C:\\Users\\miyam\\dev\\sandcastle",
    baseBranch: "main",
    branch: "agent/audit-worktree-locks",
    pathScope: "src/sandboxes",
    workMode: "Investigate only",
    runtime: "0m",
    files: 0,
    tests: "pending",
    risk: "medium",
    step: "Queued",
    prompt:
      "Inspect worktree cleanup and locking behavior. Report risks before editing.",
    events: ["Queued from Beads issue", "Branch strategy: named branch"],
    changedFiles: [],
  },
  {
    id: "run-vercel-env",
    title: "Vercel sandbox env conflict",
    issue: "#67",
    status: "blocked",
    agent: "Claude Code",
    model: "claude-opus-4-6",
    workspace: "C:\\Users\\miyam\\dev\\sandcastle",
    baseBranch: "main",
    branch: "agent/vercel-env-conflict",
    pathScope: "src/sandboxes/vercel.ts",
    workMode: "Preserve worktree",
    runtime: "7m",
    files: 2,
    tests: "failed",
    risk: "high",
    step: "Needs provider token",
    prompt:
      "Reproduce Vercel sandbox env collision and propose the smallest fix.",
    events: [
      "Sandbox creation failed",
      "Missing VERCEL_OIDC_TOKEN",
      "Worktree preserved for inspection",
    ],
    changedFiles: ["src/sandboxes/vercel.ts", "src/EnvResolver.ts"],
  },
  {
    id: "run-docs-review",
    title: "Review dashboard copy",
    issue: "#71",
    status: "merged",
    agent: "Pi",
    model: "openai-codex/gpt-5.5",
    workspace: "C:\\Users\\miyam\\dev\\sandcastle",
    baseBranch: "main",
    branch: "agent/dashboard-copy",
    pathScope: "docs/content/docs",
    workMode: "New worktree",
    runtime: "9m",
    files: 3,
    tests: "passed",
    risk: "low",
    step: "Merged to main",
    prompt:
      "Tighten dashboard labels and keep terminology aligned with the README.",
    events: ["Review passed", "Merged with no conflicts", "Branch removed"],
    changedFiles: [
      "docs/content/docs/index.mdx",
      "docs/content/docs/agents.mdx",
      "README.md",
    ],
  },
];

const columns: { id: Status; label: string }[] = [
  { id: "ready", label: "Ready" },
  { id: "running", label: "Running" },
  { id: "review", label: "Needs Review" },
  { id: "blocked", label: "Blocked" },
  { id: "merged", label: "Merged" },
  { id: "failed", label: "Failed" },
];

const statusClass: Record<Status, string> = {
  ready: "border-zinc-300 bg-zinc-50 text-zinc-700",
  running: "border-sky-300 bg-sky-50 text-sky-800",
  review: "border-amber-300 bg-amber-50 text-amber-800",
  blocked: "border-red-300 bg-red-50 text-red-800",
  merged: "border-emerald-300 bg-emerald-50 text-emerald-800",
  failed: "border-rose-300 bg-rose-50 text-rose-800",
};

const riskClass: Record<Risk, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-red-100 text-red-800",
};

const testClass: Record<RunTask["tests"], string> = {
  pending: "text-zinc-500",
  running: "text-sky-700",
  passed: "text-emerald-700",
  failed: "text-red-700",
};

export function OpsDashboard() {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedId, setSelectedId] = useState(initialTasks[0].id);
  const [agent, setAgent] = useState("Pi");
  const [template, setTemplate] = useState("Fix bug");
  const [review, setReview] = useState("Lightweight");
  const [workspace, setWorkspace] = useState(
    "C:\\Users\\miyam\\dev\\sandcastle",
  );
  const [baseBranch, setBaseBranch] = useState("main");
  const [pathScope, setPathScope] = useState("");
  const [workMode, setWorkMode] = useState("New worktree");
  const [promptText, setPromptText] = useState("");
  const [query, setQuery] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState(workspace);
  const [directoryParent, setDirectoryParent] = useState<string | null>(null);
  const [directoryRoots, setDirectoryRoots] = useState<DirectoryEntry[]>([]);
  const [directoryEntries, setDirectoryEntries] = useState<DirectoryEntry[]>(
    [],
  );
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const selected = tasks.find((task) => task.id === selectedId) ?? tasks[0];
  const visibleTasks = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return tasks;
    return tasks.filter((task) =>
      [
        task.title,
        task.issue,
        task.agent,
        task.model,
        task.workspace,
        task.baseBranch,
        task.branch,
        task.pathScope,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value),
    );
  }, [query, tasks]);

  const counts = useMemo(
    () =>
      columns.reduce(
        (acc, column) => {
          acc[column.id] = tasks.filter(
            (task) => task.status === column.id,
          ).length;
          return acc;
        },
        {} as Record<Status, number>,
      ),
    [tasks],
  );

  useEffect(() => {
    if (!browserOpen) return;

    let cancelled = false;

    async function loadDirectories() {
      setDirectoryLoading(true);
      setDirectoryError(null);

      try {
        const params = new URLSearchParams();
        if (browsePath.trim()) {
          params.set("path", browsePath.trim());
        }

        const response = await fetch(`/api/directories?${params}`);
        const data = (await response.json()) as DirectoryResponse;

        if (cancelled) return;

        if (!response.ok) {
          setDirectoryError(data.error ?? "Could not read directory");
          setDirectoryEntries([]);
          return;
        }

        setBrowsePath(data.path);
        setDirectoryParent(data.parent);
        setDirectoryRoots(data.roots);
        setDirectoryEntries(data.entries);
      } catch (error) {
        if (!cancelled) {
          setDirectoryError(
            error instanceof Error ? error.message : "Could not read directory",
          );
          setDirectoryEntries([]);
        }
      } finally {
        if (!cancelled) {
          setDirectoryLoading(false);
        }
      }
    }

    void loadDirectories();

    return () => {
      cancelled = true;
    };
  }, [browserOpen, browsePath]);

  function updateStatus(id: string, status: Status, step: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              status,
              step,
              events: [`${step}`, ...task.events].slice(0, 7),
            }
          : task,
      ),
    );
  }

  function queueRun() {
    const id = `run-${Date.now()}`;
    const finalPrompt =
      promptText.trim() ||
      `${template} using ${agent}. Work in ${workspace} from ${baseBranch}. Scope: ${
        pathScope.trim() || "whole repository"
      }. Review mode: ${review}.`;
    const title =
      promptText.trim().split(/\r?\n/)[0]?.slice(0, 86) ||
      `${template}: selected work item`;
    const next: RunTask = {
      id,
      title,
      issue: "manual",
      status: "ready",
      agent,
      model: agent === "Pi" ? "openai-codex/gpt-5.5" : "gpt-5.4",
      workspace,
      baseBranch,
      branch: `agent/${template.toLowerCase().replace(/\s+/g, "-")}`,
      pathScope: pathScope.trim() || "whole repository",
      workMode,
      runtime: "0m",
      files: 0,
      tests: "pending",
      risk: review === "Adversarial" ? "medium" : "low",
      step: "Queued",
      prompt: finalPrompt,
      events: [
        `Target: ${workspace} from ${baseBranch}`,
        `Scope: ${pathScope.trim() || "whole repository"}`,
        `Mode: ${workMode}`,
        "Queued from dashboard",
      ],
      changedFiles: [],
    };
    setTasks((current) => [next, ...current]);
    setSelectedId(id);
    setPromptText("");
  }

  function browseForDirectory() {
    setBrowsePath(workspace);
    setBrowserOpen(true);
  }

  return (
    <main className="ops-dashboard min-h-screen bg-stone-100 text-zinc-950">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-4 px-4 py-4 lg:px-6">
        <header className="flex flex-col gap-3 border-b border-zinc-300 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Sandcastle Ops
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              Agent Runs
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Metric label="Active" value={String(counts.running)} tone="sky" />
            <Metric label="Review" value={String(counts.review)} tone="amber" />
            <Metric label="Blocked" value={String(counts.blocked)} tone="red" />
            <Metric
              label="Merged"
              value={String(counts.merged)}
              tone="emerald"
            />
          </div>
        </header>

        <section className="grid gap-3 border-b border-zinc-300 pb-4">
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Agent">
                <select
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={agent}
                  onChange={(event) => setAgent(event.target.value)}
                >
                  <option>Pi</option>
                  <option>Codex</option>
                  <option>Claude Code</option>
                </select>
              </Field>
              <Field label="Template">
                <select
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                >
                  <option>Fix bug</option>
                  <option>Implement issue</option>
                  <option>Investigate only</option>
                  <option>Write tests</option>
                </select>
              </Field>
              <Field label="Review">
                <select
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={review}
                  onChange={(event) => setReview(event.target.value)}
                >
                  <option>Lightweight</option>
                  <option>Adversarial</option>
                  <option>Off</option>
                </select>
              </Field>
              <Field label="Filter">
                <input
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Branch, issue, agent"
                />
              </Field>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Directory">
                <div className="flex gap-2">
                  <input
                    className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                    value={workspace}
                    onChange={(event) => setWorkspace(event.target.value)}
                    placeholder="C:\Users\miyam\dev\sandcastle"
                  />
                  <button
                    className="h-10 min-w-28 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950 hover:bg-stone-50"
                    type="button"
                    onClick={browseForDirectory}
                  >
                    Browse
                  </button>
                </div>
              </Field>
              <Field label="Base">
                <select
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={baseBranch}
                  onChange={(event) => setBaseBranch(event.target.value)}
                >
                  <option>main</option>
                  <option>current branch</option>
                  <option>release branch</option>
                </select>
              </Field>
              <Field label="Path scope">
                <input
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={pathScope}
                  onChange={(event) => setPathScope(event.target.value)}
                  placeholder="src/auth, docs, tests"
                />
              </Field>
              <Field label="Mode">
                <select
                  className="h-10 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={workMode}
                  onChange={(event) => setWorkMode(event.target.value)}
                >
                  <option>New worktree</option>
                  <option>Current checkout</option>
                  <option>Investigate only</option>
                  <option>Preserve worktree</option>
                </select>
              </Field>
            </div>

            {browserOpen ? (
              <div className="directory-browser border border-zinc-300 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Select Directory
                    </div>
                    <div className="mt-1 truncate font-mono text-sm text-zinc-800">
                      {browsePath}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="h-10 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950 hover:bg-stone-50"
                      type="button"
                      onClick={() => {
                        setWorkspace(browsePath);
                        setBrowserOpen(false);
                      }}
                    >
                      Use Directory
                    </button>
                    <button
                      className="h-10 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950 hover:bg-stone-50"
                      type="button"
                      onClick={() => setBrowserOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 directory-browser-roots">
                  {directoryRoots.map((root) => (
                    <button
                      className="border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-950"
                      key={root.path}
                      type="button"
                      onClick={() => setBrowsePath(root.path)}
                    >
                      {root.name}
                    </button>
                  ))}
                  {directoryParent ? (
                    <button
                      className="border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-950"
                      type="button"
                      onClick={() => setBrowsePath(directoryParent)}
                    >
                      ..
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 directory-browser-list">
                  {directoryLoading ? (
                    <div className="border border-zinc-200 px-3 py-2 text-sm text-zinc-500">
                      Loading directories
                    </div>
                  ) : null}

                  {directoryError ? (
                    <div className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {directoryError}
                    </div>
                  ) : null}

                  {!directoryLoading && !directoryError
                    ? directoryEntries.map((entry) => (
                        <button
                          className="directory-entry border-b border-zinc-200 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-stone-50"
                          key={entry.path}
                          type="button"
                          onClick={() => setBrowsePath(entry.path)}
                        >
                          {entry.name}
                        </button>
                      ))
                    : null}

                  {!directoryLoading &&
                  !directoryError &&
                  directoryEntries.length === 0 ? (
                    <div className="border border-zinc-200 px-3 py-2 text-sm text-zinc-500">
                      No readable child directories
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Field label="Prompt">
              <textarea
                className="prompt-input w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder="Tell the agent exactly what to do, what to avoid, and how you want it verified."
              />
            </Field>
          </div>
          <button
            className="h-10 w-full border border-zinc-950 bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            type="button"
            onClick={queueRun}
          >
            + Queue Run
          </button>
        </section>

        <div className="grid min-h-0 flex-1 gap-4">
          <section className="workflow-board grid min-h-[580px] gap-3">
            {columns.map((column) => {
              const columnTasks = visibleTasks.filter(
                (task) => task.status === column.id,
              );
              return (
                <div
                  className="workflow-column flex min-h-0 flex-col border border-zinc-300 bg-white"
                  key={column.id}
                >
                  <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-3">
                    <h2 className="text-sm font-semibold">{column.label}</h2>
                    <span className="min-w-7 border border-zinc-200 px-2 py-1 text-center text-xs text-zinc-600">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 overflow-auto p-2">
                    {columnTasks.map((task) => (
                      <button
                        className={`run-card border p-3 text-left transition hover:border-zinc-900 ${
                          selected.id === task.id
                            ? "border-zinc-950 bg-stone-50"
                            : "border-zinc-200 bg-white"
                        }`}
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedId(task.id)}
                      >
                        <div className="run-card-main">
                          <div className="run-card-identity">
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-zinc-500">
                                {task.issue}
                              </span>
                              <span
                                className={`px-2 py-1 text-[11px] font-medium ${riskClass[task.risk]}`}
                              >
                                {task.risk}
                              </span>
                            </div>
                            <h3 className="mt-2 text-sm font-semibold leading-5">
                              {task.title}
                            </h3>
                            <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-600">
                              {task.step}
                            </p>
                          </div>

                          <div className="run-card-meta text-xs text-zinc-600">
                            <span>{task.agent}</span>
                            <span className="truncate">{task.model}</span>
                            <span className="truncate">{task.branch}</span>
                            <span className="truncate">{task.pathScope}</span>
                          </div>

                          <div className="run-card-target text-xs text-zinc-600">
                            <span className="truncate">{task.workspace}</span>
                            <span>{task.baseBranch}</span>
                            <span>{task.workMode}</span>
                          </div>

                          <div className="run-card-stats text-xs">
                            <span>{task.runtime}</span>
                            <span>{task.files} files</span>
                            <span className={testClass[task.tests]}>
                              {task.tests}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          <aside className="min-h-[580px] border border-zinc-300 bg-white">
            <div className="border-b border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span
                    className={`inline-block border px-2 py-1 text-xs font-medium ${statusClass[selected.status]}`}
                  >
                    {selected.status}
                  </span>
                  <h2 className="mt-3 text-xl font-semibold tracking-normal">
                    {selected.title}
                  </h2>
                </div>
                <span className="border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
                  {selected.issue}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {selected.prompt}
              </p>
            </div>

            <div className="grid grid-cols-2 border-b border-zinc-200 text-sm">
              <Detail label="Agent" value={selected.agent} />
              <Detail label="Model" value={selected.model} />
              <Detail label="Repository" value={selected.workspace} />
              <Detail label="Base" value={selected.baseBranch} />
              <Detail label="Branch" value={selected.branch} wide />
              <Detail label="Scope" value={selected.pathScope} wide />
              <Detail label="Mode" value={selected.workMode} wide />
              <Detail label="Runtime" value={selected.runtime} />
              <Detail label="Tests" value={selected.tests} />
            </div>

            <div className="border-b border-zinc-200 p-4">
              <h3 className="text-sm font-semibold">Run Stream</h3>
              <div className="mt-3 grid gap-2">
                {selected.events.map((event, index) => (
                  <div
                    className="grid grid-cols-[36px_1fr] items-start border border-zinc-200 bg-zinc-50 text-sm"
                    key={`${event}-${index}`}
                  >
                    <span className="border-r border-zinc-200 px-2 py-2 text-xs text-zinc-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="px-3 py-2 text-zinc-700">{event}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-zinc-200 p-4">
              <h3 className="text-sm font-semibold">Changed Files</h3>
              <div className="mt-3 grid gap-1 text-sm">
                {selected.changedFiles.length > 0 ? (
                  selected.changedFiles.map((file) => (
                    <span
                      className="truncate border border-zinc-200 px-3 py-2 font-mono text-xs text-zinc-700"
                      key={file}
                    >
                      {file}
                    </span>
                  ))
                ) : (
                  <span className="border border-zinc-200 px-3 py-2 text-zinc-500">
                    No file changes yet
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4">
              <ActionButton
                label="> Start"
                onClick={() =>
                  updateStatus(selected.id, "running", "Started from dashboard")
                }
              />
              <ActionButton
                label="|| Stop"
                onClick={() =>
                  updateStatus(selected.id, "blocked", "Stopped by operator")
                }
              />
              <ActionButton
                label="Review"
                onClick={() =>
                  updateStatus(selected.id, "review", "Review requested")
                }
              />
              <ActionButton
                label="Merge"
                onClick={() =>
                  updateStatus(selected.id, "merged", "Merged by operator")
                }
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "sky" | "amber" | "red" | "emerald";
}) {
  const toneClass = {
    sky: "border-sky-300 text-sky-800",
    amber: "border-amber-300 text-amber-800",
    red: "border-red-300 text-red-800",
    emerald: "border-emerald-300 text-emerald-800",
  }[tone];

  return (
    <div className={`h-14 min-w-28 border bg-white px-3 py-2 ${toneClass}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold leading-6">{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Detail({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`min-h-16 border-r border-t border-zinc-200 px-4 py-3 ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm text-zinc-800">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="h-10 border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950 hover:bg-stone-50"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
