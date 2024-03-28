import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generateSlug } from "random-word-slugs";
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
import { headers } from "next/headers";
const prisma = new PrismaClient();
const config = {
  CLUSTER: process.env.DEPLOYIFY_AWS_CLUSTER!,
  TASK_DEFINITION: process.env.DEPLOYIFY_AWS_TASK_DEFINITION!,
};
const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_IAM_ACCESSKEY,
    secretAccessKey: process.env.AWS_IAM_SECRETKEY,
  },
});
export async function POST(request: NextRequest) {
  const body = await request.json();
  const headersList = headers();
  const schema = z.object({
    projectID: z.string(),
  });
  const safeParseResult = schema.safeParse(body);
  if (!safeParseResult.success) {
    return NextResponse.json({ error: safeParseResult.error }, { status: 400 });
  }
  const { projectID } = safeParseResult.data;
  const project = await prisma.project.findUnique({
    where: {
      id: projectID,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // checking if project is already running or not progress must not be in QUEUED | IN PROGRESS
  const deployment = await prisma.deployment.findFirst({
    where: {
      projectId: projectID,
      status: "QUEUED",
    },
  });

  if (deployment) {
    return NextResponse.json(
      { error: "Deployment already in progress" },
      { status: 400 },
    );
  }
  // run a container in ecs to build project
  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK_DEFINITION,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [
          "subnet-059782448d033ed26",
          "subnet-08fdd16eeace3b911",
          "subnet-0d655f6c6d206772f",
        ],
        securityGroups: ["sg-016fd9f6cf8775a6d"],
        assignPublicIp: "ENABLED",
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "builder-image",
          environment: [
            {
              name: "GIT_REPO_URL",
              value: project.gitURL,
            },
            {
              name: "PROJECT_ID",
              value: projectID,
            },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);
  const subdomain = project.subdomain;
  const domain = headersList.get("host");
  return NextResponse.json(
    {
      status: "queued",
      data: { subdomain, url: `http://${subdomain}.${domain}` },
    },
    { status: 200 },
  );
}
