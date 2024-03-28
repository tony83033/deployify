import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { generateSlug } from "random-word-slugs";
const prisma = new PrismaClient();
export async function POST(request: NextRequest) {
  const schema = z.object({
    name: z.string(),
    gitURL: z.string(),
  });
  const body = await request.json();
  const safeParseResult = schema.safeParse(body);
  if (!safeParseResult.success) {
    return NextResponse.json({ error: safeParseResult.error }, { status: 400 });
  }

  const { name, gitURL } = safeParseResult.data;
  const project = await prisma.project.create({
    data: {
      name,
      gitURL,
      subdomain: generateSlug(),
      customDomain: generateSlug(),
    },
  });

  return NextResponse.json(
    { status: "success", data: project },
    { status: 200 },
  );
}
