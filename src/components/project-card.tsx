"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deleteProject,
  removeTaskFromProject,
  updateProject,
} from "@/app/actions";
import { formatDuration } from "@/lib/utils";
import type { Project, Task } from "@prisma/client";

export function ProjectCard({
  project,
}: {
  project: Project & { tasks: Task[] };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [color, setColor] = useState(project.color);
  const [targetDate, setTargetDate] = useState(
    project.targetDate
      ? format(project.targetDate, "yyyy-MM-dd")
      : ""
  );

  const completed = project.tasks.filter((t) => t.status === "COMPLETED").length;
  const total = project.tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const save = () =>
    startTransition(async () => {
      await updateProject({
        projectId: project.id,
        title,
        description,
        color,
        targetDate: targetDate || null,
      });
      setEditing(false);
    });

  const remove = () =>
    startTransition(async () => {
      if (
        !confirm(
          `Delete project "${project.title}"? Tasks will become unassigned.`
        )
      ) {
        return;
      }
      await deleteProject(project.id);
    });

  const unassignTask = (taskId: string, taskTitle: string) =>
    startTransition(async () => {
      if (!confirm(`Remove "${taskTitle}" from this project?`)) return;
      await removeTaskFromProject(taskId);
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: editing ? color : project.color }}
            />
            <CardTitle>{editing ? "Edit Project" : project.title}</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Close" : "Edit"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={remove}
            >
              Delete
            </Button>
          </div>
        </div>
        {!editing && project.description && (
          <CardDescription>{project.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {editing && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor={`title-${project.id}`}>Title</Label>
              <Input
                id={`title-${project.id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`desc-${project.id}`}>Description</Label>
              <Input
                id={`desc-${project.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`date-${project.id}`}>Target date</Label>
                <Input
                  id={`date-${project.id}`}
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`color-${project.id}`}>Color</Label>
                <Input
                  id={`color-${project.id}`}
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={pending}
                  className="h-10 p-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending}>
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setTitle(project.title);
                  setDescription(project.description ?? "");
                  setColor(project.color);
                  setTargetDate(
                    project.targetDate
                      ? format(project.targetDate, "yyyy-MM-dd")
                      : ""
                  );
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {completed}/{total} tasks · {pct}% complete
          {project.targetDate && ` · Due ${format(project.targetDate, "MMM d")}`}
        </p>
        {project.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          project.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-lg border p-2 text-sm"
            >
              <span>{task.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDuration(task.estimatedMinutes)}
                </span>
                <Badge variant="outline">{task.status}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => unassignTask(task.id, task.title)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
