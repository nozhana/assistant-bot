import { PrismaClient } from "@prisma/client";

const prismaMiddleware = () => ({ prisma: new PrismaClient() });

export default prismaMiddleware;
