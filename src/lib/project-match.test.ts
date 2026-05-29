import { describe, it, expect } from "vitest";
import {
  applyProjectMatching,
  matchExistingProject,
} from "@/lib/project-match";

describe("project matching", () => {
  const existing = [
    {
      id: "1",
      title: "Corporate Finance Review",
      description: "Finance chapters and exams",
    },
    {
      id: "2",
      title: "Fitness Plan",
      description: "Workouts and health",
    },
    {
      id: "3",
      title: "Podcast",
      description: "Edit and publish episodes",
    },
  ];

  it("matches similar existing project titles", () => {
    const match = matchExistingProject("corporate finance", existing);
    expect(match?.title).toBe("Corporate Finance Review");
  });

  it("assigns tasks to existing projects during extraction post-processing", () => {
    const result = applyProjectMatching(
      {
        tasks: [
          {
            title: "Study chapter 4 interest rates",
            category: "school",
            projectTitle: null,
          },
          {
            title: "Train legs",
            category: "fitness",
            projectTitle: "Gym",
          },
        ],
        projects: [{ title: "Gym", description: undefined, targetDate: null }],
      },
      existing
    );

    expect(result.tasks[0].projectTitle).toBe("Corporate Finance Review");
    expect(result.tasks[1].projectTitle).toBe("Fitness Plan");
    expect(
      result.projects.some((p) => p.title.toLowerCase() === "gym")
    ).toBe(false);
  });
});
