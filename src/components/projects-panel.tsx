"use client";

import { useState, useTransition } from "react";
import { ProjectCard } from "@/components/project-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  assignTaskToProject,
  clearUnassignedTasks,
  createProject,
  createUnassignedTask,
  deleteUnassignedTask,
} from "@/app/actions";
import type { Project, Task } from "@prisma/client";

export function ProjectsPanel({
  projects,
  unassigned,
}: {
  projects: (Project & { tasks: Task[] })[];
  unassigned: Task[];
}) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignByTask, setAssignByTask] = useState<Record<string, string>>({});
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleCreate = () =>
    startTransition(async () => {
      if (!title.trim()) return;
      await createProject({ title, description });
      setTitle("");
      setDescription("");
      setShowCreate(false);
    });

  const handleAddTask = () =>
    startTransition(async () => {
      if (!newTaskTitle.trim()) return;
      await createUnassignedTask({ title: newTaskTitle });
      setNewTaskTitle("");
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowCreate((v) => !v)}
          disabled={pending}
        >
          {showCreate ? "Cancel" : "New Project"}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-project-title">Title</Label>
              <Input
                id="new-project-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-project-desc">Description</Label>
              <Input
                id="new-project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
              />
            </div>
            <Button onClick={handleCreate} disabled={pending || !title.trim()}>
              Create Project
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Unassigned Tasks</CardTitle>
          {unassigned.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (
                  !confirm(
                    `Delete all ${unassigned.length} unassigned task(s)? This cannot be undone.`
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  await clearUnassignedTasks();
                });
              }}
            >
              Clear all
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">Add task</p>
            <div className="flex gap-2">
              <Input
                placeholder="New task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTask();
                  }
                }}
              />
              <Button
                size="sm"
                disabled={pending || !newTaskTitle.trim()}
                onClick={handleAddTask}
              >
                Add
              </Button>
            </div>
          </div>

          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No unassigned tasks. Add one above, then assign it to a project.
            </p>
          ) : (
            unassigned.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <span>{t.title}</span>
                  <Badge>{t.priority}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {projects.length > 0 && (
                    <>
                      <select
                        className="h-9 min-w-[140px] flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm sm:max-w-[200px]"
                        value={assignByTask[t.id] ?? ""}
                        onChange={(e) =>
                          setAssignByTask((prev) => ({
                            ...prev,
                            [t.id]: e.target.value,
                          }))
                        }
                        disabled={pending}
                      >
                        <option value="">Assign to project…</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || !assignByTask[t.id]}
                        onClick={() =>
                          startTransition(async () => {
                            const projectId = assignByTask[t.id];
                            if (!projectId) return;
                            await assignTaskToProject(t.id, projectId);
                            setAssignByTask((prev) => {
                              const next = { ...prev };
                              delete next[t.id];
                              return next;
                            });
                          })
                        }
                      >
                        Assign
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`Delete "${t.title}"?`)) return;
                      startTransition(async () => {
                        await deleteUnassignedTask(t.id);
                      });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
