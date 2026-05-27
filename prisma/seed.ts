import { PrismaClient, CoachingStyle, TaskPriority, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.accountabilityEvent.deleteMany();
  await prisma.scheduleBlock.deleteMany();
  await prisma.analyticsSnapshot.deleteMany();
  await prisma.task.deleteMany();
  await prisma.habit.deleteMany();
  await prisma.project.deleteMany();
  await prisma.brainDump.deleteMany();
  await prisma.ownerProfile.deleteMany();

  const owner = await prisma.ownerProfile.create({
    data: {
      name: "Owner",
      timezone: "America/New_York",
      workStartHour: 8,
      workEndHour: 18,
      focusStartHour: 8,
      focusEndHour: 12,
      coachingStyle: CoachingStyle.STRICT,
      maxDailyMinutes: 480,
      bufferMinutes: 15,
    },
  });

  const economicsProject = await prisma.project.create({
    data: {
      ownerId: owner.id,
      title: "Economics Paper",
      description: "Finish economics research paper",
      targetDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      color: "#ef4444",
    },
  });

  const podcastProject = await prisma.project.create({
    data: {
      ownerId: owner.id,
      title: "Podcast",
      description: "Edit and publish podcast episode",
      color: "#8b5cf6",
    },
  });

  const friday = new Date();
  const day = friday.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  friday.setDate(friday.getDate() + daysUntilFriday);
  friday.setHours(23, 59, 0, 0);

  await prisma.task.createMany({
    data: [
      {
        ownerId: owner.id,
        projectId: economicsProject.id,
        title: "Finish economics paper",
        category: "school",
        priority: TaskPriority.CRITICAL,
        importance: 9,
        urgency: 9,
        cognitiveLoad: 8,
        estimatedMinutes: 180,
        deadline: friday,
        status: TaskStatus.PENDING,
      },
      {
        ownerId: owner.id,
        title: "Train legs",
        category: "fitness",
        priority: TaskPriority.MEDIUM,
        importance: 7,
        urgency: 5,
        cognitiveLoad: 3,
        estimatedMinutes: 60,
        recurrence: "3x/week",
        status: TaskStatus.PENDING,
      },
      {
        ownerId: owner.id,
        projectId: podcastProject.id,
        title: "Edit podcast episode",
        category: "creative",
        priority: TaskPriority.HIGH,
        importance: 7,
        urgency: 6,
        cognitiveLoad: 6,
        estimatedMinutes: 90,
        status: TaskStatus.PENDING,
      },
      {
        ownerId: owner.id,
        title: "Study calculus chapter 4",
        category: "school",
        priority: TaskPriority.HIGH,
        importance: 8,
        urgency: 7,
        cognitiveLoad: 9,
        estimatedMinutes: 120,
        status: TaskStatus.PENDING,
      },
      {
        ownerId: owner.id,
        title: "Call bank",
        category: "admin",
        priority: TaskPriority.MEDIUM,
        importance: 5,
        urgency: 4,
        cognitiveLoad: 2,
        estimatedMinutes: 15,
        status: TaskStatus.PENDING,
      },
    ],
  });

  await prisma.habit.createMany({
    data: [
      {
        ownerId: owner.id,
        title: "Leg training",
        category: "fitness",
        frequencyPerWeek: 3,
        estimatedMinutes: 60,
        preferredDays: ["mon", "wed", "fri"],
      },
      {
        ownerId: owner.id,
        title: "Morning deep work",
        category: "productivity",
        frequencyPerWeek: 5,
        estimatedMinutes: 120,
        preferredDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    ],
  });

  console.log("Seed complete. Owner ID:", owner.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
